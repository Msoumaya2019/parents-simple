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
 * @param enCours   Vrai tant que la demande courante n'a pas rendu son résultat.
 *                  Ce n'est PAS « l'écran affiche-t-il un chargement ? » : un
 *                  rechargement laisse l'ancien résultat à l'écran, donc
 *                  `etat.statut === 'chargement'` vaut faux dès qu'un premier
 *                  chargement a abouti — la roue ne tournait alors jamais.
 *                  C'est `enCours`, rendu par `useAsyncData`, qu'il faut passer.
 * @param recharger Relance le chargement. Peut être recréée à chaque rendu.
 */
export function useRafraichissement(enCours: boolean, recharger: () => void): Rafraichissement {
  // `attente` reste vrai après le premier geste, et c'est voulu : il ne sert
  // qu'à distinguer « l'écran charge tout seul » de « l'utilisateur a demandé un
  // rafraîchissement ». Une fois le premier geste fait, il ne les distingue plus :
  // l'indicateur suit alors `enCours` seul, et un rechargement que personne n'a
  // demandé — changer de semaine dans la Cantine — fait tourner la roue, puisque
  // `Screen` la commande par `rafraichissement.enCours`. Défaut d'affichage mineur
  // et assumé : le corriger demanderait de remettre `attente` à faux à la fin du
  // chargement, donc d'écrire un état dans un effet, ce que la règle
  // `react-hooks/set-state-in-effect` refuse — et c'est cette règle qui a fait
  // choisir une condition dérivée.
  const [attente, setAttente] = useState(false);

  const tirerPourRafraichir = useCallback(() => {
    setAttente(true);
    recharger();
  }, [recharger]);

  const enRafraichissement = attente && enCours;

  return { enRafraichissement, tirerPourRafraichir };
}
