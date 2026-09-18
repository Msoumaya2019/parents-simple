/**
 * L'état d'un chargement, et la question « est-ce encore en cours ? ».
 *
 * POURQUOI CETTE RÈGLE VIT ICI
 * ----------------------------
 * Deux écrans, deux questions différentes, et une seule empreinte pour y
 * répondre :
 *
 *   - « qu'est-ce que j'affiche ? » — le dernier résultat, ou un indicateur de
 *     chargement ;
 *   - « est-ce que la demande en cours est terminée ? » — pour savoir si le
 *     geste de rafraîchissement doit continuer à tourner.
 *
 * Les deux se ressemblent et ne se confondent pas. Un rechargement laisse le
 * résultat précédent à l'écran — c'est voulu : la liste ne doit pas disparaître
 * pendant qu'on la rafraîchit. Mais il n'est pas terminé pour autant. Répondre à
 * la seconde question avec l'état de la première donnait « non, ce n'est pas en
 * cours » dès la première seconde, et l'indicateur de rafraîchissement ne
 * s'affichait jamais : le geste fonctionnait, mais sans aucun retour visible.
 *
 * Le module n'importe RIEN, et c'est délibéré : c'est ce qui permet à
 * `tests/chargement.test.ts` de le charger. Un banc ne peut pas charger
 * `useAsyncData.ts`, qui importe React — et c'est précisément la règle qui s'y
 * trompait.
 *
 * L'EMPREINTE, ET CE QU'ELLE PORTE
 * --------------------------------
 * Un résultat mémorisé retient deux choses : la clé de la demande (ce qui
 * distingue « charger une fois » de « recharger quand le filtre change »), et le
 * numéro de la tentative (ce qui distingue « recharger » de « ne rien faire »).
 * La clé seule ne suffisait pas : un rechargement ne la change pas, donc rien ne
 * permettait de savoir qu'une demande était repartie.
 */

/** L'état d'un chargement, tel que l'écran le lit. */
export type EtatAsync<T> =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'succes'; readonly donnees: T }
  | {
      readonly statut: 'erreur';
      readonly message: string;
      readonly technique: string | null;
    };

/** Un résultat, avec l'empreinte de la demande à laquelle il répond. */
export interface ResultatMemorise<T> {
  /** La clé de la demande : un changement de filtre relance le chargement. */
  readonly cle: string;
  /** Le numéro de la tentative : un rechargement porte un numéro de plus. */
  readonly tentative: number;
  readonly etat: EtatAsync<T>;
}

/**
 * Ce que l'écran affiche.
 *
 * Tant que le résultat mémorisé ne porte pas la clé de la demande courante,
 * l'écran est en chargement — et il l'est dès le premier rendu, sans qu'aucun
 * état n'ait eu besoin d'être poussé. Un RECHARGEMENT, lui, ne change pas la clé :
 * l'ancien résultat reste donc affiché pendant que le nouveau arrive.
 */
export function etatDerive<T>(resultat: ResultatMemorise<T> | null, cle: string): EtatAsync<T> {
  return resultat !== null && resultat.cle === cle ? resultat.etat : { statut: 'chargement' };
}

/**
 * Vrai tant que la demande courante n'a pas rendu son résultat.
 *
 * C'est la question du geste de rafraîchissement, et elle n'est PAS
 * « l'écran affiche-t-il un chargement ? » : un rechargement garde l'ancien
 * résultat à l'écran tout en étant bel et bien en cours. Répondre par
 * `etatDerive(...).statut === 'chargement'` rendait donc toujours faux, et la
 * roue ne tournait jamais.
 *
 * Trois façons d'être en cours, et une seule façon de ne pas l'être :
 *
 *   - aucun résultat encore (`resultat === null`) — le premier chargement ;
 *   - la clé a changé — le filtre a bougé, la demande est repartie ;
 *   - la tentative a changé — on a redemandé, sans changer de clé.
 */
export function chargementEnCours<T>(
  resultat: ResultatMemorise<T> | null,
  cle: string,
  tentative: number,
): boolean {
  if (resultat === null) {
    return true;
  }
  return resultat.cle !== cle || resultat.tentative !== tentative;
}
