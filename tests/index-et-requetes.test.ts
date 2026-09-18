/**
 * Les index déclarés, et les requêtes qui les emploient.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * La section « Index » de `20260917120000_init.sql` promet deux choses :
 * « Chaque index correspond à une requête réellement écrite dans
 * `src/services/` », et « un index sans requête coûte à l'écriture et ne sert à
 * rien ». Aucune des deux n'était tenue par un contrôle. Un `.order` modifié
 * d'un côté seulement — ou une direction inversée dans l'index — laissait la
 * requête sans index, et rien ne le signalait : l'application continuait de
 * fonctionner, simplement plus lentement, et personne ne relit un index.
 *
 * La première promesse était en outre **inexacte** : trois des sept index
 * servent des requêtes écrites dans la migration elle-même — `sondage_resultats()`
 * et `envoyer_message()` lisent des tables que la clé publique ne peut pas
 * interroger. Un lecteur qui aurait cherché leurs usages dans `src/services/`
 * en aurait conclu qu'ils étaient inutiles.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * Pour chaque index déclaré, ses colonnes et leur sens sont relus dans la
 * migration — jamais supposés. Puis une requête doit l'employer, dans cet
 * ordre :
 *
 *   1. une suite de `.order(...)` de `src/services/` sur la même table, en
 *      commençant par la première colonne de l'index. Dans ce cas la liste des
 *      colonnes et les sens doivent coïncider **exactement** — c'est ce qui
 *      attrape une direction inversée ou une colonne oubliée ;
 *   2. à défaut, un filtre de service (`.eq`, `.gte`, `.lt`…) sur cette première
 *      colonne ;
 *   3. à défaut, une fonction de la migration qui lit cette table et nomme cette
 *      colonne.
 *
 * La liste des index est **fermée** : en ajouter un fait échouer le banc tant
 * qu'il n'a pas été inscrit ici, avec la requête qui l'emploie. C'est
 * délibéré — un index ajouté sans requête est précisément ce que la section
 * refuse.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que PostgreSQL **emploie** l'index. Le planificateur décide, et seul un
 * `explain analyze` sur la base réelle le dirait. Le banc tient l'accord entre
 * ce qui est déclaré et ce qui est écrit : c'est la condition nécessaire, pas
 * la preuve de l'emploi.
 *
 * Il ne vérifie pas non plus l'inverse — qu'une requête écrite ait un index.
 * `listerSondages` trie sur `created_at`, sans index, et c'est assumé : une
 * association publie quelques sondages par an.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const MIGRATION = join(RACINE, 'supabase', 'migrations', '20260917120000_init.sql');
const SERVICES = join(RACINE, 'src', 'services');

/**
 * Les index que la migration déclare, et que ce banc doit retrouver.
 *
 * La liste est fermée : elle sert à rendre bruyante l'arrivée d'un index
 * nouveau, qui doit alors être inscrit ici et employé par une requête.
 */
const INDEX_ATTENDUS: readonly string[] = [
  'annonces_fil_idx',
  'cantine_menus_service_date_idx',
  'agenda_events_debut_idx',
  'documents_publie_le_idx',
  'sondage_votes_sondage_idx',
  'sondage_choix_sondage_position_idx',
  'messages_appareil_created_idx',
];

interface Colonne {
  readonly nom: string;
  readonly sens: 'asc' | 'desc';
}

interface IndexDeclare {
  readonly nom: string;
  readonly table: string;
  readonly colonnes: readonly Colonne[];
}

interface TriService {
  readonly fichier: string;
  readonly colonnes: readonly Colonne[];
}

/** Le source SQL privé de ses commentaires de ligne. */
function sansCommentairesSql(source: string): string {
  return source.replace(/--[^\n]*/g, '');
}

/** Les index déclarés, tels qu'ils sont écrits. */
function lireIndex(source: string): readonly IndexDeclare[] {
  const texte = sansCommentairesSql(source);
  const motif = /create index (\w+)\s+on public\.(\w+)\s*\(([^)]*)\)/g;

  return [...texte.matchAll(motif)].map((trouve) => ({
    nom: trouve[1]!,
    table: trouve[2]!,
    colonnes: trouve[3]!.split(',').map((brut) => {
      const morceaux = brut.trim().split(/\s+/);
      const sens: 'asc' | 'desc' = (morceaux[1] ?? 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc';
      return { nom: morceaux[0]!, sens };
    }),
  }));
}

/** Le corps des fonctions de la migration, pour le troisième niveau. */
function corpsDesFonctions(source: string): string {
  const texte = sansCommentairesSql(source);
  return [...texte.matchAll(/as \$\$([\s\S]*?)\$\$;/g)].map((trouve) => trouve[1]!).join('\n');
}

function fichiersService(): readonly string[] {
  return readdirSync(SERVICES)
    .filter((nom) => nom.endsWith('.ts'))
    .map((nom) => join(SERVICES, nom));
}

/**
 * Les suites d'`.order(...)` de `src/services/`, par table.
 *
 * Deux `.order` consécutifs forment une seule requête : c'est ainsi que
 * `listerAnnonces` trie sur `epinglee` puis `publiee_le`, et c'est exactement
 * l'ordre de `annonces_fil_idx`.
 */
function trisParTable(): ReadonlyMap<string, readonly TriService[]> {
  const parTable = new Map<string, TriService[]>();

  for (const chemin of fichiersService()) {
    let table: string | null = null;
    let courante: Colonne[] | null = null;

    for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
      const depuis = /\.from\(\s*'([a-z_]+)'\s*\)/.exec(ligne);
      if (depuis !== null) {
        table = depuis[1]!;
        courante = null;
      }

      // `matchAll` et non `exec` : deux `.order` peuvent tenir sur une même ligne
      // — `printWidth` vaut 100, et deux appels courts y tiennent — et n'en
      // compter qu'un ferait échouer le banc sur du code correct.
      const ordres = [
        ...ligne.matchAll(
          /\.order\(\s*'([a-z_]+)'\s*,\s*\{\s*ascending:\s*(true|false)\s*\}\s*\)/g,
        ),
      ];
      if (ordres.length > 0 && table !== null) {
        let chaine: Colonne[] | null = courante;
        for (const ordre of ordres) {
          const colonne: Colonne = { nom: ordre[1]!, sens: ordre[2] === 'true' ? 'asc' : 'desc' };
          if (chaine === null) {
            chaine = [colonne];
            const liste = parTable.get(table) ?? [];
            liste.push({ fichier: chemin, colonnes: chaine });
            parTable.set(table, liste);
          } else {
            chaine.push(colonne);
          }
        }
        courante = chaine;
        continue;
      }

      // Toute autre ligne interrompt la suite : deux `.order` séparés par autre
      // chose ne forment plus une seule requête. Le test porte sur le motif
      // reconnu, et non sur la présence du mot : une ligne qui contient `.order(`
      // sans que le motif corresponde — une option de plus, par exemple — rompt
      // la suite au lieu de la prolonger.
      courante = null;
    }
  }

  return parTable;
}

/** Les colonnes filtrées par table, dans `src/services/`. */
function filtresParTable(): ReadonlyMap<string, readonly string[]> {
  const parTable = new Map<string, string[]>();

  for (const chemin of fichiersService()) {
    let table: string | null = null;

    for (const ligne of readFileSync(chemin, 'utf8').split('\n')) {
      const depuis = /\.from\(\s*'([a-z_]+)'\s*\)/.exec(ligne);
      if (depuis !== null) {
        table = depuis[1]!;
      }

      const filtres = [...ligne.matchAll(/\.(?:eq|neq|gt|gte|lt|lte)\(\s*'([a-z_]+)'/g)];
      if (filtres.length > 0 && table !== null) {
        const liste = parTable.get(table) ?? [];
        for (const filtre of filtres) {
          liste.push(filtre[1]!);
        }
        parTable.set(table, liste);
      }
    }
  }

  return parTable;
}

function memeColonnes(a: readonly Colonne[], b: readonly Colonne[]): boolean {
  return a.length === b.length && a.every((c, i) => c.nom === b[i]!.nom && c.sens === b[i]!.sens);
}

function decrire(colonnes: readonly Colonne[]): string {
  return colonnes.map((c) => `${c.nom} ${c.sens}`).join(', ');
}

const SOURCE_MIGRATION = readFileSync(MIGRATION, 'utf8');
const INDEX = lireIndex(SOURCE_MIGRATION);
const CORPS_FONCTIONS = corpsDesFonctions(SOURCE_MIGRATION);
const TRIS = trisParTable();
const FILTRES = filtresParTable();

describe('Lecture des index déclarés', () => {
  it('retrouve les index attendus, et rien d’autre', () => {
    assert.deepEqual(
      INDEX.map((index) => index.nom).sort(),
      [...INDEX_ATTENDUS].sort(),
      'un index ajouté ou retiré doit être inscrit dans INDEX_ATTENDUS, avec la requête qui l’emploie',
    );
  });

  it('donne à chaque index une table et au moins une colonne', () => {
    for (const index of INDEX) {
      assert.ok(index.table.length > 0, `${index.nom} ne nomme pas sa table`);
      assert.ok(
        index.colonnes.length > 0 && index.colonnes[0]!.nom.length > 0,
        `${index.nom} ne nomme aucune colonne`,
      );
    }
  });

  it('lit le sens écrit, et pas seulement les noms', () => {
    const annonces = INDEX.find((index) => index.nom === 'annonces_fil_idx');
    assert.ok(annonces !== undefined, 'annonces_fil_idx a disparu');
    assert.equal(decrire(annonces.colonnes), 'epinglee desc, publiee_le desc');
  });
});

describe('Chaque index est employé par une requête', () => {
  for (const index of INDEX_ATTENDUS) {
    it(`${index}`, () => {
      const declare = INDEX.find((candidat) => candidat.nom === index);
      assert.ok(declare !== undefined, `${index} n’est plus déclaré dans la migration`);

      const premiere = declare.colonnes[0]!.nom;
      const tris = TRIS.get(declare.table) ?? [];
      const surLaPremiereColonne = tris.filter((tri) => tri.colonnes[0]!.nom === premiere);

      if (surLaPremiereColonne.length > 0) {
        const accord = surLaPremiereColonne.some((tri) =>
          memeColonnes(tri.colonnes, declare.colonnes),
        );
        assert.ok(
          accord,
          `${index} déclare « ${decrire(declare.colonnes)} », et ` +
            `« ${surLaPremiereColonne.map((tri) => decrire(tri.colonnes)).join(' / ')} » ` +
            `est écrit dans ${surLaPremiereColonne[0]!.fichier}. ` +
            'Une colonne ou un sens qui diffère laisse la requête sans index.',
        );
        return;
      }

      const filtres = FILTRES.get(declare.table) ?? [];
      if (filtres.includes(premiere)) {
        return;
      }

      assert.match(
        CORPS_FONCTIONS,
        new RegExp(`\\b${premiere}\\b`),
        `${index} ne sert aucune requête : ni tri, ni filtre dans src/services/, ` +
          'ni colonne nommée par une fonction de la migration',
      );
      assert.match(
        CORPS_FONCTIONS,
        new RegExp(`public\\.${declare.table}\\b`),
        `${index} porte sur ${declare.table}, qu’aucune fonction de la migration ne lit`,
      );
    });
  }
});

describe('L’accord entre le tri écrit et l’index est exact', () => {
  it('le tri des annonces suit les colonnes et les sens de annonces_fil_idx', () => {
    const declare = INDEX.find((index) => index.nom === 'annonces_fil_idx');
    assert.ok(declare !== undefined);

    const tris = (TRIS.get('annonces') ?? []).filter((tri) => tri.colonnes.length > 1);
    assert.equal(
      tris.length,
      1,
      'le fil d’accueil doit être le seul tri à deux colonnes sur annonces',
    );
    assert.ok(
      memeColonnes(tris[0]!.colonnes, declare.colonnes),
      `écrit « ${decrire(tris[0]!.colonnes)} », déclaré « ${decrire(declare.colonnes)} »`,
    );
  });

  it('un tri de service sur une table indexée commence par la première colonne de l’index', () => {
    for (const [table, tris] of TRIS) {
      const indexes = INDEX.filter((index) => index.table === table);
      if (indexes.length === 0) {
        continue;
      }

      for (const tri of tris) {
        const servis = indexes.some((index) => index.colonnes[0]!.nom === tri.colonnes[0]!.nom);
        assert.ok(
          servis,
          `${tri.fichier} trie sur « ${decrire(tri.colonnes)} », et aucun index de ${table} ` +
            'ne commence par cette colonne',
        );
      }
    }
  });
});
