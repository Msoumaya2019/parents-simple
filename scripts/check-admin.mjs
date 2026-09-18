/**
 * Contrôle d'accord entre la page d'administration et le schéma de la base.
 *
 * POURQUOI CE SCRIPT EXISTE
 * -------------------------
 * La page d'administration nomme en clair des choses que la base décide : des
 * tables, des colonnes, des bornes de longueur, des valeurs d'énumération, des
 * compartiments de stockage. Aucune de ces listes n'est reliée à sa source par
 * la langue.
 *
 * Le cas le plus coûteux est celui des colonnes, et il mérite d'être écrit :
 * le client Supabase déduit le type d'une ligne de la TABLE, jamais de la
 * chaîne passée à `select`. Une colonne mal orthographiée dans `COLONNES_*`
 * traverse donc `tsc`, `eslint` et la construction sans être vue, et n'échoue
 * qu'à l'exécution — devant le bureau, au moment précis où il croit avoir
 * publié. Aucun autre contrôle du projet ne regarde cet endroit.
 *
 * C'est le même motif que `scripts/check-sql.mjs`, appliqué de l'autre côté :
 * là-bas on vérifie que le schéma tient ses promesses de sécurité ; ici, que
 * l'écran qui le saisit n'invente rien.
 *
 * CE QU'IL LIT, ET OÙ
 * -------------------
 * Les valeurs de l'administration sont IMPORTÉES, pas relues dans du texte.
 * `admin/src/lib/contenu.ts` n'importe `client.ts` que comme type, et Node
 * efface les imports de type : le module se charge donc sans jamais toucher à
 * `@supabase/supabase-js`. Une valeur importée ne peut pas mentir sur son
 * propre contenu, contrairement à un motif qui cesserait de correspondre.
 *
 * Deux exceptions, assumées : les écrans `.tsx`, que Node ne charge pas, et le
 * texte de `contenu.ts` lui-même, d'où l'on relève les noms de tables. Chacune
 * porte un garde-fou d'extraction, sans quoi un motif mort rendrait le contrôle
 * vert en ne comparant rien.
 *
 * CE QU'IL NE FAIT PAS
 * --------------------
 * Il ne valide pas la syntaxe PostgreSQL, comme `check-sql.mjs`. Et il ne tient
 * pas la liste des formats de fichier acceptés, qui vit à trois endroits — les
 * deux `EXTENSIONS_*` de `contenu.ts`, l'attribut `accept` des champs de
 * fichier, et `allowed_mime_types` dans la migration. Ce désaccord-là n'est pas
 * muet : la page refuse le fichier avec une phrase en français, ou le stockage
 * le refuse avec un message que l'écran affiche. Il est signalé dans
 * `docs/05-administration.md` plutôt que contrôlé ici.
 *
 * Usage : `npm run admin:check`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BORNES } from '../admin/src/lib/bornes.ts';
import {
  COLONNES_ANNONCE,
  COLONNES_DOCUMENT,
  COLONNES_EVENEMENT,
  COLONNES_MENU,
} from '../admin/src/lib/contenu.ts';
import { CATEGORIES_ANNONCE, CATEGORIES_DOCUMENT } from '../admin/src/lib/types.ts';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');
const SOURCE_ADMIN = path.join(RACINE, 'admin', 'src');

/**
 * Les tables que la page écrit, et la constante qui les nomme.
 *
 * Cette table de correspondance est déclarée ici, et non déduite : rien ne
 * relie le nom d'une table à celui d'une constante, sinon une convention de
 * nommage. Le contrôle vérifie donc en plus que cette liste est COMPLÈTE, en
 * relevant les appels `client.from('…')` du fichier de requêtes : une
 * cinquième table ajoutée à la page fait échouer le contrôle tant qu'elle n'est
 * pas déclarée ici.
 */
const TABLES_ECRITES = [
  { table: 'annonces', constante: 'COLONNES_ANNONCE', colonnes: COLONNES_ANNONCE },
  { table: 'cantine_menus', constante: 'COLONNES_MENU', colonnes: COLONNES_MENU },
  { table: 'agenda_events', constante: 'COLONNES_EVENEMENT', colonnes: COLONNES_EVENEMENT },
  { table: 'documents', constante: 'COLONNES_DOCUMENT', colonnes: COLONNES_DOCUMENT },
];

/** Les énumérations que la page propose, et le type énuméré qui les définit. */
const ENUMERATIONS = [
  { type: 'annonce_categorie', liste: CATEGORIES_ANNONCE, constante: 'CATEGORIES_ANNONCE' },
  { type: 'document_categorie', liste: CATEGORIES_DOCUMENT, constante: 'CATEGORIES_DOCUMENT' },
];

const problemes = [];
const verifications = [];

function signaler(message) {
  problemes.push(message);
}

function verifier(condition, description) {
  verifications.push(description);
  if (!condition) {
    signaler(description);
  }
}

// ---------------------------------------------------------------------------
//  Lecture des migrations
// ---------------------------------------------------------------------------

if (!fs.existsSync(MIGRATIONS)) {
  console.error(`Dossier introuvable : ${MIGRATIONS}`);
  process.exit(1);
}

const fichiers = fs
  .readdirSync(MIGRATIONS)
  .filter((nom) => nom.endsWith('.sql'))
  .sort();

if (fichiers.length === 0) {
  console.error('Aucune migration SQL trouvée.');
  process.exit(1);
}

const sql = fichiers.map((nom) => fs.readFileSync(path.join(MIGRATIONS, nom), 'utf8')).join('\n');

/**
 * Retire les commentaires `--` avant toute analyse.
 *
 * Sans cela, un commentaire qui MENTIONNE une colonne ou une contrainte serait
 * pris pour une vraie déclaration. Les migrations de ce projet sont très
 * commentées — elles citent des noms de contraintes et des valeurs
 * d'énumération en prose — donc ce n'est pas un cas théorique.
 */
const normalise = sql
  .split('\n')
  .map((ligne) => {
    const index = ligne.indexOf('--');
    return index === -1 ? ligne : ligne.slice(0, index);
  })
  .join('\n')
  .toLowerCase();

/**
 * La même chose, espaces et sauts de ligne réduits à une espace.
 *
 * Les instructions `alter table` sont écrites sur plusieurs lignes. Les
 * analyser ligne à ligne demanderait un automate ; les aplatir suffit ici, et
 * c'est fait APRÈS le retrait des commentaires — sans quoi un commentaire en
 * fin de ligne avalerait la suite de l'instruction.
 */
const plat = normalise.replace(/\s+/g, ' ');

/** Contenu des parenthèses ouvertes à `position`, imbrication comprise. */
function contenuParenthese(texte, position) {
  let profondeur = 0;

  for (let index = position; index < texte.length; index += 1) {
    const caractere = texte[index];
    if (caractere === '(') {
      profondeur += 1;
    } else if (caractere === ')') {
      profondeur -= 1;
      if (profondeur === 0) {
        return texte.slice(position + 1, index);
      }
    }
  }

  return null;
}

/** Découpe sur les virgules de premier niveau, sans couper dans les parenthèses. */
function decouper(texte) {
  const morceaux = [];
  let profondeur = 0;
  let debut = 0;

  for (let index = 0; index < texte.length; index += 1) {
    const caractere = texte[index];
    if (caractere === '(') {
      profondeur += 1;
    } else if (caractere === ')') {
      profondeur -= 1;
    } else if (caractere === ',' && profondeur === 0) {
      morceaux.push(texte.slice(debut, index));
      debut = index + 1;
    }
  }

  morceaux.push(texte.slice(debut));
  return morceaux;
}

const tables = new Map();
const contraintes = new Map();
const enums = new Map();
const compartiments = new Set();

function colonnesDe(nom) {
  if (!tables.has(nom)) {
    tables.set(nom, new Set());
  }
  return tables.get(nom);
}

function noterContrainte(nom, table, corps) {
  const borne = /between (\d+) and (\d+)/.exec(corps);
  contraintes.set(nom, {
    table,
    min: borne === null ? null : Number(borne[1]),
    max: borne === null ? null : Number(borne[2]),
  });
}

//  `create table` : les colonnes et les contraintes du corps.
{
  const motif = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)\s*\(/g;
  let trouve;

  while ((trouve = motif.exec(normalise)) !== null) {
    const nom = trouve[1];
    const corps = contenuParenthese(normalise, trouve.index + trouve[0].length - 1);

    if (corps === null) {
      signaler(`Le corps de la table « ${nom} » n'a pas pu être lu (parenthèse non fermée).`);
      continue;
    }

    const colonnes = colonnesDe(nom);

    for (const morceau of decouper(corps)) {
      const propre = morceau.trim();
      if (propre === '') {
        continue;
      }

      //  Une contrainte de table commence par le mot-clé `constraint` ; une
      //  colonne commence par son nom. Les autres formes — `primary key (…)`,
      //  `unique (…)` — ne portent pas de nom et ne sont donc pas retenues.
      if (propre.startsWith('constraint ')) {
        const declaration = /^constraint\s+([a-z0-9_]+)\s+check\s*\(/.exec(propre);
        if (declaration !== null) {
          const debut = propre.indexOf('(', declaration[0].length - 1);
          const corpsContrainte = contenuParenthese(propre, debut);
          if (corpsContrainte !== null) {
            noterContrainte(declaration[1], nom, corpsContrainte);
          }
        }
        continue;
      }

      if (/^(primary|unique|check|foreign|exclude)\b/.test(propre)) {
        continue;
      }

      const identifiant = /^([a-z0-9_]+)/.exec(propre);
      if (identifiant !== null) {
        colonnes.add(identifiant[1]);
      }
    }
  }
}

//  `alter table … add column` et `alter table … add constraint`.
//  Les deux comptent : `annonces.categorie` et `annonces.image_url` n'existent
//  que par un `add column`, et `annonces_image_url_valide` que par un
//  `add constraint`. Un lecteur qui ne regarderait que les `create table`
//  déclarerait ces quatre-là absentes, c'est-à-dire ferait échouer le contrôle
//  sur du code juste.
{
  const motifColonne =
    /\balter table public\.([a-z0-9_]+) add column (?:if not exists )?([a-z0-9_]+)/g;
  let trouve;
  while ((trouve = motifColonne.exec(plat)) !== null) {
    colonnesDe(trouve[1]).add(trouve[2]);
  }

  const motifContrainte =
    /\balter table public\.([a-z0-9_]+) add constraint ([a-z0-9_]+) check \(/g;
  while ((trouve = motifContrainte.exec(plat)) !== null) {
    const corps = contenuParenthese(plat, trouve.index + trouve[0].length - 1);
    if (corps === null) {
      signaler(`Le corps de la contrainte « ${trouve[2]} » n'a pas pu être lu.`);
      continue;
    }
    noterContrainte(trouve[2], trouve[1], corps);
  }
}

//  `create type … as enum`.
{
  const motif = /create\s+type\s+public\.([a-z0-9_]+)\s+as\s+enum\s*\(/g;
  let trouve;

  while ((trouve = motif.exec(normalise)) !== null) {
    const corps = contenuParenthese(normalise, trouve.index + trouve[0].length - 1);
    if (corps === null) {
      signaler(`Le corps du type « ${trouve[1]} » n'a pas pu être lu.`);
      continue;
    }

    const valeurs = decouper(corps)
      .map((morceau) => morceau.trim())
      .filter((morceau) => morceau !== '')
      .map((morceau) => /^'([^']*)'$/.exec(morceau)?.[1] ?? null)
      .filter((valeur) => valeur !== null);

    enums.set(trouve[1], valeurs);
  }
}

//  `insert into storage.buckets … values ('nom', …)`.
{
  const motif = /insert\s+into\s+storage\.buckets\s*\([^)]*\)\s*values\s*\(/g;
  let trouve;

  while ((trouve = motif.exec(normalise)) !== null) {
    const corps = contenuParenthese(normalise, trouve.index + trouve[0].length - 1);
    if (corps === null) {
      signaler("Le corps d'un `insert into storage.buckets` n'a pas pu être lu.");
      continue;
    }

    const identifiant = /^'([a-z0-9_-]+)'/.exec(corps.trim());
    if (identifiant !== null) {
      compartiments.add(identifiant[1]);
    }
  }
}

// ---------------------------------------------------------------------------
//  Lecture des sources de l'administration
// ---------------------------------------------------------------------------

const FICHIER_REQUETES = path.join(SOURCE_ADMIN, 'lib', 'contenu.ts');
const DOSSIER_ECRANS = path.join(SOURCE_ADMIN, 'ecrans');

if (!fs.existsSync(FICHIER_REQUETES) || !fs.existsSync(DOSSIER_ECRANS)) {
  console.error(`Sources de l'administration introuvables sous ${SOURCE_ADMIN}`);
  process.exit(1);
}

const requetes = fs.readFileSync(FICHIER_REQUETES, 'utf8');

/**
 * Retire les commentaires d'un fichier TypeScript.
 *
 * Les commentaires de bloc partent entièrement ; les commentaires de fin de
 * ligne ne partent que s'ils occupent la ligne. C'est délibérément partiel : un
 * retrait de `//` en fin de ligne, écrit naïvement, couperait la ligne du test
 * `/^https?:\/\//i` de `Annonces.tsx`, où `//` fait partie d'une expression
 * régulière. Le contrôle cherche des emplois de constantes, jamais des valeurs
 * citées en commentaire, donc ce qui reste ne peut pas le tromper.
 */
function sansCommentaires(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((ligne) => !ligne.trimStart().startsWith('//'))
    .join('\n');
}

const ecrans = fs
  .readdirSync(DOSSIER_ECRANS)
  .filter((nom) => nom.endsWith('.tsx'))
  .sort();

const ecransLus = ecrans.map((nom) => ({
  nom,
  source: sansCommentaires(fs.readFileSync(path.join(DOSSIER_ECRANS, nom), 'utf8')),
}));

// ---------------------------------------------------------------------------
//  0. Les garde-fous d'extraction
// ---------------------------------------------------------------------------
//  Un contrôle qui lit des fichiers peut être vert en ne lisant RIEN : chemin
//  déplacé, motif qui ne correspond plus. C'est le pire des états — un défaut
//  avec l'apparence d'une protection. Chaque lecteur doit donc dire ce qu'il a
//  trouvé, et le nombre attendu est nommé.

verifier(
  tables.has('annonces') &&
    tables.has('cantine_menus') &&
    tables.has('agenda_events') &&
    tables.has('documents'),
  `Les quatre tables écrites par la page ont été relues dans les migrations (${tables.size} table(s) au total).`,
);

for (const { table, constante } of TABLES_ECRITES) {
  verifier(
    (tables.get(table)?.size ?? 0) >= 3,
    `Les colonnes de « ${table} » ont été relues (${tables.get(table)?.size ?? 0} trouvée(s)), pour comparer à « ${constante} ».`,
  );
}

for (const { type, constante } of ENUMERATIONS) {
  verifier(
    (enums.get(type)?.length ?? 0) >= 3,
    `Les valeurs du type « ${type} » ont été relues (${enums.get(type)?.length ?? 0} trouvée(s)), pour comparer à « ${constante} ».`,
  );
}

verifier(
  compartiments.size >= 2,
  `Les compartiments de stockage ont été relus (${compartiments.size} trouvé(s) : ${[...compartiments].join(', ')}).`,
);

verifier(
  ecransLus.length >= 1,
  `Les écrans de l'administration ont été relus (${ecransLus.length} fichier(s) : ${ecrans.map((nom) => nom.replace(/\.tsx$/, '')).join(', ')}).`,
);

// ---------------------------------------------------------------------------
//  1. Les tables citées par la page existent, et la liste est complète
// ---------------------------------------------------------------------------

{
  const appelees = new Set();
  const motif = /client\s*\.\s*from\(\s*'([a-z0-9_]+)'\s*\)/g;
  let trouve;
  while ((trouve = motif.exec(requetes)) !== null) {
    appelees.add(trouve[1]);
  }

  //  Garde-fou du contrôle lui-même : sans lui, un motif qui cesse de
  //  correspondre ferait passer le contrôle de complétude en comparant deux
  //  ensembles vides.
  verifier(
    appelees.size > 0,
    `Les tables appelées par la page ont été relues (${appelees.size} : ${[...appelees].sort().join(', ')}).`,
  );

  for (const { table } of TABLES_ECRITES) {
    verifier(
      tables.has(table),
      `La table « ${table} », écrite par la page, existe dans les migrations.`,
    );
    verifier(
      appelees.has(table),
      `La table « ${table} », déclarée dans ce contrôle, est bien appelée par la page.`,
    );
  }

  const declarees = new Set(TABLES_ECRITES.map(({ table }) => table));
  const oubliees = [...appelees].filter((table) => !declarees.has(table)).sort();

  verifier(
    oubliees.length === 0,
    `Toutes les tables appelées par la page sont déclarées dans ce contrôle (à déclarer : ${oubliees.length === 0 ? 'aucune' : oubliees.join(', ')}).`,
  );
}

// ---------------------------------------------------------------------------
//  2. Chaque colonne citée existe dans sa table
// ---------------------------------------------------------------------------
//  La règle est l'INCLUSION, pas l'égalité : la page n'a pas à citer toutes les
//  colonnes — `created_at` et `updated_at` ne la regardent pas. Ce qu'il faut
//  interdire, c'est qu'elle en cite une qui n'existe pas, parce que PostgREST
//  refuserait alors la requête entière.

for (const { table, constante, colonnes } of TABLES_ECRITES) {
  const reelles = tables.get(table);

  if (reelles === undefined) {
    continue;
  }

  const citees = colonnes
    .split(',')
    .map((colonne) => colonne.trim())
    .filter((colonne) => colonne !== '');

  verifier(citees.length >= 3, `« ${constante} » nomme des colonnes (${citees.length}).`);

  for (const colonne of citees) {
    verifier(
      reelles.has(colonne),
      `La colonne « ${colonne} » de « ${constante} » existe dans « ${table} ».`,
    );
  }
}

// ---------------------------------------------------------------------------
//  3. Chaque borne reflète la contrainte qu'elle nomme
// ---------------------------------------------------------------------------
//  Le nom de la contrainte est une VALEUR de `BORNES`, et non un commentaire :
//  c'est ce qui permet de comparer sans lire de prose. La borne comparée est la
//  borne HAUTE, parce que c'est la seule que la page applique — le minimum est
//  tenu par le refus du champ vide, dans chaque écran.

const contraintesTenues = new Set();

for (const [cle, borne] of Object.entries(BORNES)) {
  const contrainte = contraintes.get(borne.contrainte);

  verifier(
    contrainte !== undefined,
    `La contrainte « ${borne.contrainte} », nommée par « ${cle} », existe dans les migrations.`,
  );

  if (contrainte === undefined) {
    continue;
  }

  contraintesTenues.add(borne.contrainte);

  verifier(
    contrainte.max !== null,
    `La contrainte « ${borne.contrainte} » porte une borne haute lisible (${contrainte.max ?? 'illisible'}).`,
  );

  verifier(
    contrainte.max === borne.max,
    `« ${cle} » vaut ${borne.max}, comme la borne haute de « ${borne.contrainte} » (${contrainte.max ?? '?'}).`,
  );
}

// ---------------------------------------------------------------------------
//  4. L'ensemble des bornes est FERMÉ
// ---------------------------------------------------------------------------
//  Comparer les bornes déclarées à leurs contraintes ne dit rien le jour où une
//  contrainte bornée APPARAÎT dans une migration : elle serait simplement
//  ignorée, et l'écran laisserait saisir au-delà. C'est le défaut le plus
//  silencieux de la famille, et c'est celui-ci qui le ferme.
//
//  La règle porte sur les contraintes écrites `between … and …` des quatre
//  tables écrites par la page. Les autres formes — `unique`, `>=`, un
//  `coalesce … <> ''` — ne sont pas des bornes de longueur et ne sont pas
//  concernées.

{
  const bornesEnBase = new Set();

  for (const [nom, contrainte] of contraintes) {
    const ecrite = TABLES_ECRITES.some(({ table }) => table === contrainte.table);
    if (ecrite && contrainte.max !== null) {
      bornesEnBase.add(nom);
    }
  }

  verifier(
    bornesEnBase.size > 0,
    `Les contraintes bornées des quatre tables ont été relues (${bornesEnBase.size} : ${[...bornesEnBase].sort().join(', ')}).`,
  );

  const manquantes = [...bornesEnBase].filter((nom) => !contraintesTenues.has(nom)).sort();
  const surnumeraires = [...contraintesTenues].filter((nom) => !bornesEnBase.has(nom)).sort();

  verifier(
    manquantes.length === 0,
    `Toute contrainte bornée des quatre tables est tenue par une borne (à ajouter à BORNES : ${manquantes.length === 0 ? 'aucune' : manquantes.join(', ')}).`,
  );

  verifier(
    surnumeraires.length === 0,
    `Toute borne de BORNES vise une contrainte bornée d'une table écrite (hors sujet : ${surnumeraires.length === 0 ? 'aucune' : surnumeraires.join(', ')}).`,
  );
}

// ---------------------------------------------------------------------------
//  5. Les valeurs d'énumération sont celles de la base, et réciproquement
// ---------------------------------------------------------------------------
//  Une valeur offerte mais absente du type ferait échouer l'enregistrement avec
//  un message de Postgres que personne ne peut lire. Une valeur du type qui
//  n'est pas offerte est plus discrète : la fonctionnalité existe en base et
//  reste inatteignable depuis la page. Les deux sens sont donc vérifiés, et le
//  message dit lequel des deux est en défaut.

for (const { type, liste, constante } of ENUMERATIONS) {
  const enBase = enums.get(type);

  if (enBase === undefined) {
    continue;
  }

  const offertes = liste.map((entree) => entree.valeur);

  const inventees = offertes.filter((valeur) => !enBase.includes(valeur)).sort();
  const inatteignables = enBase.filter((valeur) => !offertes.includes(valeur)).sort();

  verifier(
    inventees.length === 0,
    `Toute valeur de « ${constante} » existe dans le type « ${type} » (inventées : ${inventees.length === 0 ? 'aucune' : inventees.join(', ')}).`,
  );

  verifier(
    inatteignables.length === 0,
    `Toute valeur du type « ${type} » est proposée par « ${constante} » (inatteignables : ${inatteignables.length === 0 ? 'aucune' : inatteignables.join(', ')}).`,
  );
}

// ---------------------------------------------------------------------------
//  6. Chaque borne est EMPLOYÉE, et pas seulement déclarée
// ---------------------------------------------------------------------------
//  Une limite déclarée et posée sur aucun champ ne borne rien. Ce n'est pas
//  théorique : ce fichier a trouvé `courrielMembre`, déclaré pour une colonne
//  qu'aucun écran ne saisit, et qui laissait croire que la page gère la liste
//  des membres. TypeScript ne signale pas ce cas — un export est « utilisé » du
//  seul fait d'être exporté.
//
//  CONVENTION, ET LE CONTRÔLE EN DÉPEND : une borne se consomme dans un écran
//  sous la forme `BORNES.<clé>.max`. Une borne consommée autrement — recopiée
//  dans une constante locale, par exemple — fera échouer ce contrôle sans
//  qu'il y ait de défaut. C'est le prix de la seule vérification possible ici,
//  et il est écrit pour que le prochain lecteur ne cherche pas ailleurs.

{
  const texte = ecransLus.map(({ source }) => source).join('\n');

  verifier(
    texte.includes('BORNES.'),
    `Les écrans emploient « BORNES » (${ecransLus.length} fichier(s) relu(s)).`,
  );

  for (const cle of Object.keys(BORNES)) {
    verifier(
      texte.includes(`BORNES.${cle}.max`),
      `La borne « ${cle} » est employée par un écran, sous la forme « BORNES.${cle}.max ».`,
    );
  }
}

// ---------------------------------------------------------------------------
//  7. Les compartiments de stockage cités existent
// ---------------------------------------------------------------------------

{
  const cites = new Set();
  const motif = /client\s*\.\s*storage\s*\.\s*from\(\s*'([a-z0-9_-]+)'\s*\)/g;
  let trouve;
  while ((trouve = motif.exec(requetes)) !== null) {
    cites.add(trouve[1]);
  }

  verifier(
    cites.size > 0,
    `Les compartiments cités par la page ont été relus (${cites.size} : ${[...cites].sort().join(', ')}).`,
  );

  for (const compartiment of [...cites].sort()) {
    verifier(
      compartiments.has(compartiment),
      `Le compartiment « ${compartiment} », cité par la page, est déclaré par une migration.`,
    );
  }
}

// ---------------------------------------------------------------------------
//  8. L'administration est autonome
// ---------------------------------------------------------------------------
//  `admin/` est une application à part, et c'est ce qui lui permet d'être
//  déployée seule : la racine du dépôt n'est qu'un voisin. Une dépendance
//  `file:..` la rattacherait au contraire à ce voisin, dont l'absence sur
//  l'hébergeur ferait échouer l'installation.
//
//  Ce contrôle existe parce que le défaut se RECRÉE tout seul, et il a fallu le
//  mesurer pour le croire. `npm --prefix admin install` réécrit
//  `admin/package.json` et y remet la dépendance ; `cd admin && npm install` la
//  laisse partie. Les deux formes ont été comparées sur un état identique — le
//  manifeste, le verrou et le verrou caché nettoyés, le lien de `node_modules`
//  déplacé — et seule la première la fait revenir. Or c'est celle que le script
//  `admin:install` employait : une dépendance morte, qu'aucun `import` n'appelle,
//  ressuscitée à chaque `npm run verify`, et donc présente dans chaque
//  `git status` sans que personne ne l'ait ajoutée.
//
//  La propriété visée est celle du MANIFESTE, pas celle d'un fichier de verrou :
//  c'est lui qui fait foi, et les verrous s'en déduisent.

const MANIFESTE_ADMIN = path.join(RACINE, 'admin', 'package.json');
const manifesteAdmin = JSON.parse(fs.readFileSync(MANIFESTE_ADMIN, 'utf8'));

const dependancesAdmin = {
  ...manifesteAdmin.dependencies,
  ...manifesteAdmin.devDependencies,
};

// Garde-fou d'extraction : un manifeste lu de travers — chemin déplacé, clé
// renommée — rendrait le contrôle vert en n'ayant rien lu. Les deux blocs sont
// donc exigés nommément, et pas seulement un total : renommer `dependencies`
// laisserait cinq entrées dans `devDependencies` et suffirait à faire passer un
// compte.
const blocsPresents =
  manifesteAdmin.dependencies !== undefined && manifesteAdmin.devDependencies !== undefined;

verifier(
  blocsPresents && Object.keys(dependancesAdmin).length >= 5,
  `Le manifeste de l'administration a été lu, et porte ses deux blocs de dépendances (${Object.keys(dependancesAdmin).length} relevée(s)).`,
);

const sortantes = Object.entries(dependancesAdmin).filter(
  ([, specification]) => typeof specification === 'string' && specification.startsWith('file:'),
);

verifier(
  sortantes.length === 0,
  `Aucune dépendance de l'administration ne passe par un chemin hors de son dossier : ${
    sortantes.length === 0 ? 'aucune' : sortantes.map(([nom]) => nom).join(', ')
  }.`,
);

// ---------------------------------------------------------------------------
//  Rapport
// ---------------------------------------------------------------------------

console.log(
  `\nContrôle de l'administration — ${fichiers.length} migration(s), ${tables.size} table(s), ${contraintes.size} contrainte(s), ${enums.size} type(s) énuméré(s)`,
);
console.log(`${verifications.length} vérification(s) exécutée(s)\n`);

if (problemes.length === 0) {
  console.log("Aucun écart entre l'administration et le schéma.\n");
  process.exit(0);
}

console.error(`${problemes.length} écart(s) détecté(s) :\n`);
for (const probleme of problemes) {
  console.error(`  ✗ ${probleme}`);
}
console.error('');
process.exit(1);
