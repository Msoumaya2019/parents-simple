/**
 * Applique une migration Supabase par l'API Management, c'est-à-dire par le
 * même point d'entrée que l'éditeur SQL du tableau de bord.
 *
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 *
 * POURQUOI CET OUTIL EXISTE
 * -------------------------
 * Dans ce projet, les migrations se collent à la main : c'est la seule étape
 * sans contrôle. Elle échoue dans le sens qui coûte cher — la migration est
 * écrite, relue, validée par les contrôles statiques, et pourtant jamais
 * appliquée. Le symptôme apparaît plus tard, dans une compilation qui s'arrête
 * sur une table absente.
 *
 * Un seul lot, pas d'historique de migration : c'est ce qui distingue cet
 * appel de `supabase db push`, qui comparerait au dépôt distant et tenterait
 * de réappliquer ce que l'historique ignore.
 *
 * LE JETON N'EST JAMAIS ÉCRIT ICI. Il vient de SUPABASE_ACCESS_TOKEN, ou du
 * fichier que `npx supabase login` dépose dans ~/.supabase/access-token. Un
 * jeton collé dans un script est un jeton compromis — et sur un dépôt public,
 * immédiatement.
 *
 * Usage : node scripts/appliquer-migration.mjs supabase/migrations/<fichier>.sql
 *
 * Un outil qui ne peut rien affirmer doit échouer : sans jeton, sans fichier,
 * ou sur une réponse non 2xx, il sort en code non nul et le dit.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// La racine se déduit de l'emplacement du script, jamais du répertoire
// courant : lancé depuis `scripts/` ou depuis ailleurs, l'outil doit lire le
// même `.env.local`. Un chemin relatif aurait marché une fois sur deux, et
// échoué sur un message qui ne dit rien de la vraie cause.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function abandon(message) {
  console.error(`[ECHEC] ${message}`);
  process.exit(1);
}

const cheminSql = process.argv[2];
if (!cheminSql) {
  abandon('usage : node scripts/appliquer-migration.mjs <chemin, depuis la racine du dépôt>');
}

// Le chemin se lit depuis la racine du dépôt, pas depuis le répertoire
// courant : l'appel est ainsi identique d'où qu'on le lance. Le message
// d'erreur doit le dire — sans quoi on cherche une faute de frappe là où il
// n'y a qu'une convention, et `../supabase/…` lancé depuis `scripts/` échoue
// pour une raison qui ne dit rien de la vraie cause.
const sql = resolve(RACINE, cheminSql);
if (!existsSync(sql)) {
  abandon(`migration introuvable : ${sql}\n        (les chemins se lisent depuis ${RACINE})`);
}

// --- Le jeton ---------------------------------------------------------------
let jeton = process.env.SUPABASE_ACCESS_TOKEN?.trim();
let origine = 'SUPABASE_ACCESS_TOKEN';
if (!jeton) {
  const fichier = join(homedir(), '.supabase', 'access-token');
  if (existsSync(fichier)) {
    jeton = readFileSync(fichier, 'utf8').trim();
    origine = fichier;
  }
}
if (!jeton) {
  abandon(
    "aucun jeton Management. Lancez d'abord, dans un terminal :\n" +
      '        npx supabase login\n' +
      '      puis relancez cette commande. (Rien sur cette machine ne peut écrire\n' +
      '      dans la base sans un canal authentifié.)',
  );
}
// Le refus porte sur la FORME, pas sur la longueur : un seuil de longueur
// désactiverait le contrôle sur les jetons plus courts, et un jeton d'une
// autre nature passerait.
if (!/^sbp_/.test(jeton)) {
  abandon(`jeton suspect : il ne commence pas par sbp_ (origine : ${origine}).`);
}
console.log(`Jeton : ${origine} (${jeton.length} caractères, non affiché)`);

// --- La référence du projet, lue dans .env.local, jamais codée en dur -------
const fichierEnv = join(RACINE, '.env.local');
if (!existsSync(fichierEnv)) abandon(`.env.local introuvable : ${fichierEnv}`);
const env = readFileSync(fichierEnv, 'utf8');
const url = /^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)?.[1]?.trim();
if (!url) abandon('EXPO_PUBLIC_SUPABASE_URL introuvable dans .env.local');
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
if (!ref) abandon(`URL inattendue dans .env.local : ${url}`);
console.log(`Projet : ${ref}`);

// --- L'envoi ---------------------------------------------------------------
const contenu = readFileSync(sql, 'utf8');
console.log(`Migration : ${sql} (${contenu.length} caractères)`);

const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${jeton}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: contenu }),
});

const texte = await reponse.text();
if (!reponse.ok) {
  console.error(`[ECHEC] HTTP ${reponse.status}`);
  console.error(texte.slice(0, 2000));
  process.exit(1);
}

console.log(`[OK] HTTP ${reponse.status}`);
console.log(texte.slice(0, 2000));

// Un `[OK]` ne dit pas que la base porte ce qu'on croit : l'API répond 200
// pour un lot vide comme pour un lot appliqué. Le contrôle qui tranche
// interroge la base réelle, et lui seul distingue « fermé » de « absent ».
console.log(
  '\nÉtape suivante — les deux contrôles qui interrogent la base réelle :\n' +
    '        npm run securite:api\n' +
    '        npm run verifier:requetes\n' +
    '      Un `404` sur la table nouvelle signifie « pas appliquée », pas « protégée ».',
);
