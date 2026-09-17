/**
 * Résolution de l'alias `@/` pour les tests exécutés par Node.
 *
 * Les tests tournent avec le lanceur intégré de Node (`node --test`), sans
 * transpileur ni exécuteur de tests supplémentaire. Node 22 sait lire du
 * TypeScript directement, à condition que le code n'utilise que des
 * constructions effaçables — pas d'`enum`, pas de `namespace`, pas de
 * propriétés de constructeur. C'est le cas ici.
 *
 * Reste le problème de l'alias : `import { x } from '@/utils/date'` n'est pas
 * une adresse que Node sait résoudre. D'où ce greffon, qui traduit `@/` vers
 * `src/` et complète l'extension.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const SOURCE = path.join(RACINE, 'src');

/** Extensions essayées, dans l'ordre. */
const EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs', '.json'];

function resoudreFichier(cheminSansExtension) {
  for (const extension of EXTENSIONS) {
    const candidat = `${cheminSansExtension}${extension}`;
    if (fs.existsSync(candidat) && fs.statSync(candidat).isFile()) {
      return candidat;
    }
  }

  // Un dossier : on cherche son `index`.
  for (const extension of EXTENSIONS) {
    const candidat = path.join(cheminSansExtension, `index${extension}`);
    if (fs.existsSync(candidat) && fs.statSync(candidat).isFile()) {
      return candidat;
    }
  }

  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (!specifier.startsWith('@/')) {
    return nextResolve(specifier, context);
  }

  const cible = path.join(SOURCE, specifier.slice(2));
  const fichier = resoudreFichier(cible);

  if (fichier === null) {
    // On laisse échouer la résolution normale : le message d'erreur de Node
    // indique le fichier introuvable, ce qui est plus utile qu'un message
    // inventé ici.
    return nextResolve(specifier, context);
  }

  return {
    url: `file://${fichier.replace(/\\/g, '/')}`,
    shortCircuit: true,
  };
}
