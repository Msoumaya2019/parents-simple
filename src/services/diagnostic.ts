/**
 * Sonde de joignabilité de la base.
 *
 * POURQUOI UNE REQUÊTE POUR SI PEU
 * --------------------------------
 * `appConfig` dit si l'application est CONFIGURÉE — une adresse et une clé
 * présentes, et de forme plausible. Il ne dit rien de la seule chose qui compte
 * pour un parent devant un écran vide : la base répond-elle ? Seule une requête
 * réelle répond à cette question-là.
 *
 * La requête est choisie pour être la plus petite possible et la moins
 * bavarde : une colonne, une ligne au plus, sur `annonces` — la table que
 * `scripts/verifier-requetes-app.mjs` interroge déjà de la même façon, et dont
 * la lecture publique est accordée à `anon`. Une table vide n'est pas un échec :
 * PostgREST répond `200` avec une liste vide, et la sonde réussit.
 *
 * ELLE NE DOIT PAS AVALER SES ERREURS
 * -----------------------------------
 * Une sonde qui avale son échec répond toujours « tout va bien » : elle ne
 * prouve plus rien, et c'est précisément le défaut qu'elle est censée révéler.
 * Le passage par `executer` est donc le point essentiel de ce fichier — il lève
 * une `AppError` en français, que `useAsyncData` transforme en état d'erreur.
 */

import { client, executer } from '@/services/client';

/** Les colonnes lues : la plus étroite possible, jamais `*`. */
const COLONNE = 'id';

/**
 * Éprouve que la base répond, et rend la main sans rien.
 *
 * Ne rend rien, et c'est voulu : ce qui compte n'est pas le résultat, c'est
 * l'absence d'erreur. L'appelant lit `etat.statut`.
 */
export async function verifierJoignabilite(): Promise<void> {
  await executer<readonly { id: string }[]>(client().from('annonces').select(COLONNE).limit(1));
}
