/**
 * Rafraîchissement par glissement vers le bas.
 *
 * POURQUOI CE HOOK EXISTE
 * -----------------------
 * Les écrans d'onglet ne se démontent pas quand on les quitte : passer de
 * Cantine à Agenda puis revenir ne relance aucun chargement. Sans ce geste, un
 * menu publié depuis le tableau de bord reste invisible jusqu'au redémarrage de
 * l'application — ce qui donne l'impression que la publication n'a pas marché.
 *
 * L'indicateur est DÉRIVÉ, jamais poussé. Le motif naturel — remettre un
 * booléen à `false` à la fin de la requête — produit un aller-retour visible :
 * la roue disparaît avant que la liste soit remplacée, et l'écran clignote. Ici
 * « en cours » vaut vrai tant qu'on a demandé un rafraîchissement **et** que le
 * chargement n'est pas terminé.
 *
 * La condition de fin est reçue en paramètre plutôt que devinée : l'écran
 * `Plus` charge deux jeux de données à la fois, et le geste n'est terminé que
 * lorsque les deux le sont.
 */

import { useCallback, useState } from 'react';

export interface Rafraichissement {
  readonly enRafraichissement: boolean;
  readonly tirerPourRafraichir: () => void;
}

/**
 * @param enChargement Vrai tant que les données de l'écran ne sont pas arrivées.
 * @param recharger    Relance le chargement. Peut être recréée à chaque rendu.
 */
export function useRafraichissement(
  enChargement: boolean,
  recharger: () => void,
): Rafraichissement {
  const [attente, setAttente] = useState(false);

  const tirerPourRafraichir = useCallback(() => {
    setAttente(true);
    recharger();
  }, [recharger]);

  const enRafraichissement = attente && enChargement;

  return { enRafraichissement, tirerPourRafraichir };
}
