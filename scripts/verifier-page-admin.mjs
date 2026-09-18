/**
 * Vérifie la page d'administration TELLE QU'ELLE EST CONSTRUITE.
 *
 * POURQUOI CE CONTRÔLE EXISTE
 * ---------------------------
 * `check-admin.mjs` lit les sources : il dit si la configuration *décrit* un
 * `base` relatif. Il ne dit pas ce que la construction en *fait*. Or le défaut
 * mesuré était justement un écart entre les deux : le commentaire de
 * `vite.config.ts` promettait des chemins relatifs, la clé `base` n'existait
 * plus, et le `index.html` produit référençait `/assets/…` en absolu. La page
 * fonctionnait à la racine d'un domaine et aurait échoué dans un sous-dossier,
 * en silence — les fichiers sont là, le navigateur les cherche ailleurs.
 *
 * Un contrôle de source aurait pu être vert pendant tout ce temps si le motif
 * avait trouvé la phrase du commentaire. Celui-ci ne lit aucune prose : il lit
 * le fichier qui part chez l'hébergeur.
 *
 * Un contrôle qui ne peut rien affirmer doit échouer : si `dist/index.html` est
 * absent, la construction n'a pas eu lieu et ce script le dit, plutôt que de
 * parcourir une liste vide et de rendre un vert qui ne prouve rien.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = join(RACINE, 'admin', 'dist', 'index.html');

const problemes = [];
const verifications = [];

function verifier(condition, description) {
  verifications.push(description);
  if (!condition) {
    problemes.push(description);
  }
}

if (!existsSync(PAGE)) {
  console.error(`[ECHEC] page construite introuvable : ${PAGE}`);
  console.error('        Lancer `npm run admin:build` avant ce contrôle.');
  process.exit(1);
}

const html = readFileSync(PAGE, 'utf8');

// Garde-fou d'extraction : sans cette exigence, un fichier tronqué, vide ou
// remplacé par autre chose passerait le contrôle en n'ayant aucune référence à
// examiner — un vert obtenu en ne regardant rien.
verifier(
  html.includes('id="racine"') && html.includes('<title>'),
  "Le fichier lu est bien la page de l'administration, et non un fichier vide ou étranger.",
);

// Les références locales : `src="…"` et `href="…"`, moins les adresses
// absolues par nature — une URL externe ou une donnée encodée n'a pas à être
// relative.
const references = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((correspondance) => correspondance[1])
  .filter((valeur) => !/^(?:https?:|data:|mailto:|#)/i.test(valeur));

verifier(
  references.length >= 2,
  `La page référence ses ressources (${references.length} trouvée(s)).`,
);

const absolues = references.filter((valeur) => valeur.startsWith('/'));

verifier(
  absolues.length === 0,
  `Aucune ressource de la page n'est référencée depuis la racine du domaine : ${
    absolues.length === 0 ? 'aucune' : absolues.join(', ')
  }.`,
);

// Le script et la feuille de style sont attendus nommément : une page qui
// n'aurait plus que l'un des deux serait déployable et sans style, ou sans
// code — un défaut que « aucune référence absolue » ne verrait pas.
verifier(
  references.some((valeur) => valeur.endsWith('.js')),
  'La page référence son script.',
);
verifier(
  references.some((valeur) => valeur.endsWith('.css')),
  'La page référence sa feuille de style.',
);

console.log(`\nContrôle de la page construite — ${references.length} référence(s)`);
console.log(`${verifications.length} vérification(s) exécutée(s)\n`);

if (problemes.length === 0) {
  console.log("La page se déploie à la racine d'un domaine comme dans un sous-dossier.\n");
  process.exit(0);
}

console.error(`${problemes.length} écart(s) détecté(s) :\n`);
for (const probleme of problemes) {
  console.error(`  ✗ ${probleme}`);
}
console.error('');
process.exit(1);
