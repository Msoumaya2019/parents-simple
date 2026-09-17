/**
 * Active la résolution de l'alias `@/` pour les tests Node.
 *
 * Ce fichier est chargé par `node --import` avant les tests. Il n'exécute rien
 * d'autre que l'enregistrement du greffon : le travail de résolution se trouve
 * dans `alias-loader.mjs`.
 */

import { register } from 'node:module';

register('./alias-loader.mjs', import.meta.url);
