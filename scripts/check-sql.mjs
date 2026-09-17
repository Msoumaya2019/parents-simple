/**
 * Contrôle de cohérence du schéma SQL.
 *
 * POURQUOI CE SCRIPT EXISTE
 * -------------------------
 * La sécurité de cette application ne repose sur aucune ligne de son code : elle
 * repose entièrement sur `supabase/migrations/`. Une table créée sans RLS, ou
 * dont les privilèges n'ont pas été révoqués, est lisible et modifiable par
 * quiconque possède la clé publique — c'est-à-dire par quiconque a installé
 * l'application.
 *
 * Or ces oublis ne se voient nulle part : le schéma s'applique sans erreur,
 * l'application fonctionne, et le défaut reste invisible jusqu'à ce que
 * quelqu'un l'exploite. C'est exactement le genre de faute qu'un contrôle
 * automatique doit attraper.
 *
 * CE QUE CE SCRIPT NE FAIT PAS
 * ----------------------------
 * Il ne valide pas la syntaxe PostgreSQL. Une analyse syntaxique complète
 * demanderait un moteur PostgreSQL, donc une dépendance native lourde. Les
 * contrôles portent donc sur la STRUCTURE : chaque table est-elle protégée,
 * chaque politique vise-t-elle une table réelle, les tables sensibles sont-elles
 * bien fermées. C'est le niveau où se trouvent les fautes coûteuses.
 *
 * Usage : `npm run sql:check`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');

/** Tables dont AUCUNE politique pour `anon` n'est acceptable. */
const TABLES_FERMEES = ['messages', 'sondage_votes'];

/** Tables qui doivent au contraire être lisibles par `anon`. */
const TABLES_LISIBLES = [
  'annonces',
  'cantine_menus',
  'agenda_events',
  'documents',
  'sondages',
  'sondage_choix',
];

const problemes = [];
const verifications = [];

function signaler(gravite, message) {
  problemes.push({ gravite, message });
}

function verifier(condition, description) {
  verifications.push(description);
  if (!condition) {
    signaler('erreur', description);
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
 * Sans cela, un commentaire qui MENTIONNE `create table public.x` serait pris
 * pour une vraie déclaration, et un commentaire expliquant qu'une table est
 * volontairement sans politique serait lu comme une politique. Le fichier de
 * migration est très commenté : ce n'est pas un cas théorique.
 */
const sansCommentaires = sql
  .split('\n')
  .map((ligne) => {
    const index = ligne.indexOf('--');
    return index === -1 ? ligne : ligne.slice(0, index);
  })
  .join('\n');

const normalise = sansCommentaires.toLowerCase();

/** Tous les noms de tables du schéma `public`. */
function tablesCreees() {
  const motif = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g;
  const noms = new Set();
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    noms.add(correspondance[1]);
  }
  return noms;
}

const tables = tablesCreees();

// ---------------------------------------------------------------------------
//  1. Chaque table est protégée
// ---------------------------------------------------------------------------

for (const table of tables) {
  const aRls = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
  ).test(normalise);

  verifier(aRls, `La table « ${table} » active la sécurité au niveau des lignes (RLS).`);

  const privilegesRevoques = new RegExp(
    `revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(
    privilegesRevoques,
    `Les privilèges par défaut de « ${table} » sont révoqués pour le rôle anonyme.`,
  );
}

// ---------------------------------------------------------------------------
//  2. Chaque politique vise une table qui existe
// ---------------------------------------------------------------------------

const politiques = [];
{
  const motif = /create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/g;
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    politiques.push({ nom: correspondance[1], table: correspondance[2] });
  }
}

verifier(politiques.length > 0, 'Le schéma déclare au moins une politique.');

for (const politique of politiques) {
  verifier(
    tables.has(politique.table),
    `La politique « ${politique.nom} » vise la table « ${politique.table} », qui existe.`,
  );
}

// ---------------------------------------------------------------------------
//  3. Les tables sensibles sont fermées au rôle anonyme
// ---------------------------------------------------------------------------

for (const table of TABLES_FERMEES) {
  if (!tables.has(table)) {
    signaler('erreur', `La table « ${table} » est attendue dans le schéma, mais absente.`);
    continue;
  }

  const politiquesAnon = politiques.filter((politique) => politique.table === table);

  verifier(
    politiquesAnon.length === 0,
    `Aucune politique ne s'applique à « ${table} » : la table reste inaccessible avec la clé publique.`,
  );

  const selectAccorde = new RegExp(
    `grant\\s+select\\s+on\\s+public\\.${table}\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(
    !selectAccorde,
    `Aucun droit de lecture n'est accordé sur « ${table} » au rôle anonyme.`,
  );
}

// ---------------------------------------------------------------------------
//  4. Les tables de contenu sont lisibles
// ---------------------------------------------------------------------------

for (const table of TABLES_LISIBLES) {
  if (!tables.has(table)) {
    signaler('erreur', `La table « ${table} » est attendue dans le schéma, mais absente.`);
    continue;
  }

  const lectureAccordee = new RegExp(
    `grant\\s+select\\s+on\\s+public\\.${table}\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(lectureAccordee, `La table « ${table} » est lisible avec la clé publique.`);

  const aUnePolitiqueDeLecture = politiques.some((politique) => politique.table === table);

  verifier(
    aUnePolitiqueDeLecture,
    `La table « ${table} » possède une politique, sans quoi le droit accordé resterait sans effet.`,
  );
}

// ---------------------------------------------------------------------------
//  5. Les index visent des tables qui existent
// ---------------------------------------------------------------------------

{
  const motif = /create\s+index\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/g;
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    verifier(
      tables.has(correspondance[2]),
      `L'index « ${correspondance[1]} » porte sur la table « ${correspondance[2]} », qui existe.`,
    );
  }
}

// ---------------------------------------------------------------------------
//  6. Les fonctions exposées sont exécutables par le rôle anonyme
// ---------------------------------------------------------------------------

for (const fonction of ['sondage_resultats', 'voter', 'envoyer_message']) {
  const declaree = normalise.includes(`function public.${fonction}(`);
  verifier(declaree, `La fonction « ${fonction} » est déclarée.`);

  if (!declaree) {
    continue;
  }

  const exposee = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${fonction}\\([^)]*\\)\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(exposee, `La fonction « ${fonction} » est exécutable avec la clé publique.`);

  const enSecurityDefiner = new RegExp(
    `function\\s+public\\.${fonction}\\([^)]*\\)[\\s\\S]{0,600}?security\\s+definer`,
  ).test(normalise);

  verifier(
    enSecurityDefiner,
    `La fonction « ${fonction} » s'exécute avec les droits du propriétaire (security definer).`,
  );

  const searchPathFerme = new RegExp(
    `function\\s+public\\.${fonction}\\([^)]*\\)[\\s\\S]{0,600}?set\\s+search_path\\s*=\\s*''`,
  ).test(normalise);

  verifier(
    searchPathFerme,
    `La fonction « ${fonction} » fixe un « search_path » vide, ce qui ferme le détournement de schéma.`,
  );
}

// ---------------------------------------------------------------------------
//  7. Le compartiment de stockage est déclaré
// ---------------------------------------------------------------------------

verifier(
  normalise.includes('insert into storage.buckets'),
  'Le compartiment de stockage des documents est déclaré par une migration.',
);

// ---------------------------------------------------------------------------
//  Rapport
// ---------------------------------------------------------------------------

const erreurs = problemes.filter((probleme) => probleme.gravite === 'erreur');

console.log(`\nContrôle du schéma — ${fichiers.length} migration(s), ${tables.size} table(s)`);
console.log(`${verifications.length} vérification(s) exécutée(s)\n`);

if (erreurs.length === 0) {
  console.log('Aucun défaut structurel détecté.\n');
  process.exit(0);
}

console.error(`${erreurs.length} défaut(s) détecté(s) :\n`);
for (const erreur of erreurs) {
  console.error(`  ✗ ${erreur.message}`);
}
console.error('');
process.exit(1);
