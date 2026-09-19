/**
 * Le SQL que ce projet fait appliquer à la main est-il rejouable — et les
 * documents qui en parlent disent-ils la vérité ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Deux fichiers, deux formes, une même garantie annoncée et jamais tenue.
 *
 * Le README affirmait, sans nuance :
 *
 *   « Tous les fichiers sont écrits pour pouvoir être rejoués : les relancer sur
 *     une base à jour ne produit ni erreur ni doublon. »
 *
 * C'est faux pour `20260917120000_init.sql`, et mesurable en le lisant : il crée
 * ses deux types, ses huit tables, ses sept index, ses six déclencheurs et ses
 * sept politiques sans une seule garde — zéro `if not exists`, zéro
 * `drop … if exists`, zéro bloc `do`. Relancé, il s'arrête sur sa première
 * instruction, `create type public.message_categorie as enum`, que PostgreSQL
 * refuse deux fois (`42710: type "message_categorie" already exists`).
 *
 * Et `supabase/exemple-contenu.sql` — que le README invite à exécuter, et dont
 * l'en-tête promet « le script peut être relancé sans dommage » — tient sa
 * promesse par six `on conflict`. Rien ne le vérifiait : il suffisait qu'une
 * insertion perde sa clause pour qu'une seconde exécution s'arrête sur une
 * violation de clé primaire, au moment précis où on essaie l'application.
 *
 * L'affirmation n'était pas seulement inexacte, elle était DANGEREUSE : l'outil
 * `scripts/appliquer-migration.mjs` n'a aucun historique de migration — c'est ce
 * qui le distingue de `supabase db push` — et applique exactement le fichier
 * qu'on lui nomme. Un lecteur qui croyait pouvoir renvoyer n'importe quoi pour
 * « vérifier » se heurtait à une erreur qui ne dit pas ce qu'elle est.
 *
 * C'est le défaut de ce dépôt, rencontré douze fois : un document attribue à un
 * fichier une garantie que ce fichier ne porte pas.
 *
 * CE QUE CE BANC TIENT
 * --------------------
 *   1. Toute migration du dossier est rejouable — sauf celles d'une liste
 *      FERMÉE d'exceptions, et chaque exception doit être MÉRITÉE : la règle doit
 *      réellement trouver des défauts dedans. Une exception commode qui ne
 *      couvrirait rien fait échouer le banc.
 *   2. Chaque exception est nommée dans le README, dans un paragraphe qui dit
 *      qu'elle n'est pas rejouable ET qui porte sa preuve.
 *   3. Chaque `insert` de `supabase/exemple-contenu.sql` porte sa clause
 *      `on conflict`, sans quoi la seconde exécution échoue.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Il lit des MOTIFS, il ne comprend pas le SQL. Un `create table` écrit dans un
 * bloc `do` exécuté dynamiquement lui échapperait, et il ne dit rien de la
 * rejouabilité d'un `alter table`. Le seul contrôle qui tranche sur ce qu'une
 * base porte est celui qui l'interroge : `npm run securite:api` et
 * `npm run verifier:requetes`.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const DOSSIER = new URL('../supabase/migrations/', import.meta.url);
const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

/**
 * Les migrations qui ne sont pas rejouables, et qui l'assument.
 *
 * Liste FERMÉE : une migration ajoutée demain n'y entre pas toute seule. Le
 * `readdirSync` ci-dessous mesure ce qui RESTE dans le dossier ; il ne verrait
 * pas un fichier fautif ajouté à côté des bons. C'est la liste qui l'attrape.
 */
const EXCEPTIONS = ['20260917120000_init.sql'];

/**
 * Le code d'erreur que PostgreSQL rend sur une seconde création de type, et le
 * seul mot qui, dans le README, dit qu'un fichier n'est pas rejouable.
 *
 * Ce sont les deux ancres du contrôle d'accord. Elles sont exigeantes à dessein :
 * `20260917120000_init.sql` est déjà nommé ailleurs dans le README, dans
 * l'encadré « Il ne suffit pas de coller le premier » — un contrôle qui se
 * contenterait de chercher le nom du fichier serait satisfait par cette mention
 * qui ne parle pas de rejouabilité. Mesuré, et rejoué par un essai ci-dessous.
 */
const CODE_DUPLICATE_OBJECT = '42710';
const MOTIF_NON_REJOUABLE = /ne l'est pas|n'est pas rejouable|ne sont pas rejouables/;

/** Un commentaire de ligne n'est pas une instruction : un motif cité ne compte pas. */
const sansCommentaires = (source) => source.replace(/--[^\n]*/g, '');

/** Les blocs `do $$ … $$`, avec leurs bornes, pour situer une instruction dedans. */
function blocsDo(source) {
  const blocs = [];
  const ouverture = /\bdo\s*\$\$/gi;
  let m;
  while ((m = ouverture.exec(source)) !== null) {
    const fermeture = source.indexOf('$$', ouverture.lastIndex);
    if (fermeture === -1) break;
    blocs.push({ debut: m.index, fin: fermeture, corps: source.slice(m.index, fermeture) });
    ouverture.lastIndex = fermeture + 2;
  }
  return blocs;
}

/**
 * L'instruction est-elle dans un bloc `do` qui avale `duplicate_object` ?
 *
 * `when others` ne suffit pas : il avale aussi les fautes de frappe, et une
 * migration qui masquerait une erreur de nom de colonne serait déclarée
 * rejouable à tort. L'exception doit être NOMMÉE.
 */
function dansUnBlocDoQuiAvaleLeDoublon(source, index) {
  return blocsDo(source).some(
    (bloc) => index > bloc.debut && index < bloc.fin && /duplicate_object/i.test(bloc.corps),
  );
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Ce qu'une migration doit faire pour être rejouable, et qui ne se fait pas ici.
 *
 * Rend la liste des manquements, vide si le fichier est rejouable. La règle est
 * écrite ici, dans le banc, et non dans les migrations : c'est une règle de
 * forme, elle n'a rien à faire dans du SQL.
 */
function defautsDeRejouabilite(source) {
  const texte = sansCommentaires(source);
  const defauts = [];

  const ajouter = (message, m) => defauts.push(`${message} (position ${m.index})`);

  for (const m of texte.matchAll(/\bcreate\s+table\s+(?!if\s+not\s+exists)/gi))
    ajouter('create table sans « if not exists »', m);

  for (const m of texte.matchAll(/\bcreate\s+(?:unique\s+)?index\s+(?!if\s+not\s+exists)/gi))
    ajouter('create index sans « if not exists »', m);

  for (const m of texte.matchAll(/\bcreate\s+type\b/gi))
    if (!dansUnBlocDoQuiAvaleLeDoublon(texte, m.index))
      ajouter('create type hors d’un bloc « do » qui nomme duplicate_object', m);

  for (const m of texte.matchAll(/\bcreate\s+(?:function|view)\b/gi))
    ajouter('create function/view sans « or replace »', m);

  for (const [objet, nom] of [
    ['trigger', /\bcreate\s+trigger\s+([a-zA-Z0-9_."]+)/gi],
    ['policy', /\bcreate\s+policy\s+([a-zA-Z0-9_."]+)/gi],
  ]) {
    for (const m of texte.matchAll(nom)) {
      const cible = echapper(m[1].replace(/"/g, ''));
      const avant = texte.slice(0, m.index);
      if (!new RegExp(`drop\\s+${objet}\\s+if\\s+exists\\s+"?${cible}"?`, 'i').test(avant))
        ajouter(`create ${objet} ${m[1]} sans « drop ${objet} if exists »`, m);
    }
  }

  return defauts;
}

/** Les migrations présentes, triées. */
const fichiers = readdirSync(DOSSIER)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** Les paragraphes du README : les blocs séparés par une ligne vide. */
const paragraphes = README.split(/\n\s*\n/);

describe('La règle reconnaît ce qui n’est pas rejouable', () => {
  const REFUSES = {
    'une table sans if not exists': 'create table public.t (id int);',
    'un index sans if not exists': 'create index t_idx on public.t (id);',
    'un index unique sans if not exists': 'create unique index t_idx on public.t (id);',
    'une politique sans drop préalable':
      'create policy t_lecture on public.t for select using (true);',
    'un déclencheur sans drop préalable':
      'create trigger t_maj before insert on public.t for each row execute function public.f();',
    'un type hors bloc do': "create type public.e as enum ('a');",
    'une fonction sans or replace':
      'create function public.f() returns int language sql as $$ select 1 $$;',
    'une vue sans or replace': 'create view public.v as select 1;',
    'un bloc do qui avale « others » et pas le doublon':
      "do $$ begin create type public.e as enum ('a'); exception when others then null; end $$;",
  };

  for (const [intitule, source] of Object.entries(REFUSES)) {
    it(`refuse ${intitule}`, () => {
      assert.ok(
        defautsDeRejouabilite(source).length > 0,
        `cette forme devrait être refusée : ${source}`,
      );
    });
  }

  const ACCEPTES = {
    'une table gardée': 'create table if not exists public.t (id int);',
    'un index gardé': 'create index if not exists t_idx on public.t (id);',
    'un index unique gardé': 'create unique index if not exists t_idx on public.t (id);',
    'une politique précédée de son drop':
      'drop policy if exists t_lecture on public.t;\ncreate policy t_lecture on public.t for select using (true);',
    'un déclencheur précédé de son drop':
      'drop trigger if exists t_maj on public.t;\ncreate trigger t_maj before insert on public.t for each row execute function public.f();',
    'un type dans un bloc do qui nomme duplicate_object':
      "do $$ begin\n  create type public.e as enum ('a');\nexception\n  when duplicate_object then null;\nend $$;",
    'une fonction remplacée':
      'create or replace function public.f() returns int language sql as $$ select 1 $$;',
    'une vue remplacée': 'create or replace view public.v as select 1;',
    'un motif cité dans un commentaire, jamais employé': '-- create table public.t (id int);',
    'un fichier qui ne crée rien': 'alter table public.t add column if not exists x int;',
  };

  for (const [intitule, source] of Object.entries(ACCEPTES)) {
    it(`accepte ${intitule}`, () => {
      assert.deepEqual(defautsDeRejouabilite(source), [], `cette forme devrait passer : ${source}`);
    });
  }
});

describe('L’exception est méritée, pas commode', () => {
  it('le dossier contient bien des migrations', () => {
    // Un dossier vide rendrait les deux essais suivants verts en ne lisant rien.
    assert.ok(fichiers.length >= 3, `migrations trouvées : ${fichiers.join(', ')}`);
  });

  it('chaque exception existe réellement', () => {
    for (const nom of EXCEPTIONS) {
      assert.ok(fichiers.includes(nom), `exception déclarée mais absente du dossier : ${nom}`);
    }
  });

  for (const nom of EXCEPTIONS) {
    it(`${nom} porte réellement des défauts — sinon l’exception est gratuite`, () => {
      const source = readFileSync(new URL(nom, DOSSIER), 'utf8');
      const defauts = defautsDeRejouabilite(source);
      assert.ok(
        defauts.length > 0,
        `${nom} est déclarée non rejouable, mais la règle n’y trouve aucun défaut : ` +
          'l’exception ne couvre rien, et la règle ne mesure plus ce qu’elle prétend.',
      );
    });
  }

  const rejouables = fichiers.filter((f) => !EXCEPTIONS.includes(f));
  for (const nom of rejouables) {
    it(`${nom} est rejouable`, () => {
      const source = readFileSync(new URL(nom, DOSSIER), 'utf8');
      assert.deepEqual(
        defautsDeRejouabilite(source),
        [],
        `${nom} : relancée sur une base à jour, cette migration échouerait.`,
      );
    });
  }
});

describe('Le README nomme chaque exception, et porte sa preuve', () => {
  it('le nom du fichier apparaît ailleurs sans parler de rejouabilité', () => {
    // C'est ce qui rend l'essai suivant nécessaire : une simple recherche du nom
    // du fichier serait satisfaite par l'encadré « Il ne suffit pas de coller le
    // premier », qui ne dit rien de la rejouabilité. Sans ce cas, on ne saurait
    // pas que l'ancre est porteuse.
    const mentions = paragraphes.filter((p) => p.includes(EXCEPTIONS[0]));
    assert.ok(
      mentions.some((p) => !/rejouable/i.test(p)),
      'l’encadré qui mentionne le premier fichier sans parler de rejouabilité a disparu : ' +
        'vérifier que l’ancre de l’essai suivant reste discriminante.',
    );
  });

  for (const nom of EXCEPTIONS) {
    it(`le README dit que ${nom} n’est pas rejouable, et donne le code d’erreur`, () => {
      const porteur = paragraphes.find(
        (p) =>
          p.includes(nom) &&
          /rejouable/i.test(p) &&
          MOTIF_NON_REJOUABLE.test(p) &&
          p.includes(CODE_DUPLICATE_OBJECT),
      );
      assert.ok(
        porteur !== undefined,
        `aucun paragraphe du README ne réunit les trois : le nom « ${nom} », le mot ` +
          `« rejouable » à la forme négative, et le code « ${CODE_DUPLICATE_OBJECT} ». ` +
          'Un paragraphe qui nomme le fichier sans dire qu’il n’est pas rejouable, ou qui ' +
          'l’affirme sans dire ce qui se passe, ne suffit pas.',
      );
    });
  }
});

/**
 * Le contenu d'exemple, que le README invite à coller dans l'éditeur SQL.
 *
 * Il n'est pas dans `supabase/migrations/` : `sql:check` ne le lit pas, il ne
 * s'applique jamais tout seul, et c'est le seul fichier que ce projet demande
 * explicitement à un humain d'exécuter deux fois — la première pour essayer,
 * la seconde parce qu'il doute.
 */
const CONTENU_EXEMPLE = new URL('../supabase/exemple-contenu.sql', import.meta.url);

/**
 * Les insertions qui n'ont pas de clause `on conflict`.
 *
 * Chaque `insert` du fichier porte des identifiants explicites. Sans clause de
 * conflit, une seconde exécution s'arrête sur une violation de clé primaire —
 * c'est-à-dire au moment précis où quelqu'un essaie l'application.
 *
 * La fenêtre d'examen va d'une insertion à la **suivante**, jamais jusqu'à la fin
 * du fichier : sans cette borne, la clause d'une insertion couvrirait l'absence
 * de sa voisine, et le contrôle serait muet sur le cas qu'il existe pour
 * attraper.
 */
function insertionsSansClauseDeConflit(source) {
  const texte = sansCommentaires(source);
  const departs = [...texte.matchAll(/\binsert\s+into\s+([a-z0-9_."]+)/gi)];
  const fautives = [];
  for (const [i, depart] of departs.entries()) {
    const fin = departs[i + 1]?.index ?? texte.length;
    if (!/\bon\s+conflict\b/i.test(texte.slice(depart.index, fin))) fautives.push(depart[1]);
  }
  return fautives;
}

describe('Le contenu d’exemple peut être relancé', () => {
  const source = readFileSync(CONTENU_EXEMPLE, 'utf8');

  it('le fichier porte bien des insertions à examiner', () => {
    // Un fichier vidé de ses insertions rendrait l'essai suivant vert en ne
    // lisant rien — l'état « vert en ne lisant rien », le pire des états.
    const nombre = [...sansCommentaires(source).matchAll(/\binsert\s+into\b/gi)].length;
    assert.ok(nombre >= 6, `insertions trouvées : ${nombre} — le fichier a-t-il été vidé ?`);
  });

  it('chaque insertion porte sa clause de conflit', () => {
    assert.deepEqual(
      insertionsSansClauseDeConflit(source),
      [],
      'une insertion sans `on conflict` ferait échouer la seconde exécution sur une ' +
        'violation de clé primaire.',
    );
  });

  it('la règle refuse une insertion sans clause', () => {
    // Sans ce cas, une fonction qui rendrait toujours une liste vide passerait
    // l'essai précédent sans rien mesurer.
    const fautive = "insert into public.annonces (id, titre) values (1, 'x');";
    assert.deepEqual(insertionsSansClauseDeConflit(fautive), ['public.annonces']);
  });

  it('elle ne prend pas la clause de la voisine pour la sienne', () => {
    const deux = [
      'insert into public.a (id) values (1);',
      'insert into public.b (id) values (2)',
      'on conflict do nothing;',
    ].join('\n');
    assert.deepEqual(insertionsSansClauseDeConflit(deux), ['public.a']);
  });

  it('elle reconnaît les deux formes de clause', () => {
    const lesDeux = [
      'insert into public.a (id) values (1) on conflict do nothing;',
      'insert into public.b (id) values (2) on conflict (id) do update set x = 1;',
    ].join('\n');
    assert.deepEqual(insertionsSansClauseDeConflit(lesDeux), []);
  });
});
