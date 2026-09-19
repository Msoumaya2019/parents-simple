/**
 * Ce que la carte de sondage de l'accueil propose, et ce qu'elle en dit.
 *
 * POURQUOI CETTE RÈGLE EXISTE
 * ---------------------------
 * La carte d'accueil invite à répondre à un sondage ouvert. Elle ne savait rien
 * des votes de l'appareil : un parent qui venait de répondre — dans l'onglet
 * Plus, le seul endroit où l'on vote — retrouvait, sur l'écran qu'il ouvre le
 * plus souvent, la même invitation qu'avant. « Votre avis nous intéresse »,
 * « Participer », et une indication qui promettait d'ouvrir le sondage « pour
 * répondre ». Pendant ce temps, la carte de l'onglet Plus disait, du même
 * sondage : « Votre réponse est enregistrée. » Deux écrans, un seul sondage,
 * deux réponses — et c'est l'accueil qui mentait.
 *
 * LE DÉFAUT N'ÉTAIT PAS SEULEMENT DANS LES MOTS
 * ---------------------------------------------
 * Changer le libellé sans savoir si l'appareil a voté n'aurait rien réglé : il
 * fallait d'abord que l'accueil LISE la mémoire locale, que `plus.tsx` était
 * seul à lire. Et il ne suffisait pas de la lire une fois au montage :
 * l'écran d'accueil reste monté quand on passe à l'onglet Plus, donc un parent
 * qui votait puis revenait en arrière retrouvait l'ancien état. C'est pourquoi
 * `app/(tabs)/index.tsx` la relit à chaque retour sur l'écran, et pourquoi la
 * règle vit ici, hors de tout composant : elle se juge sur des cas, pas à
 * l'œil.
 *
 * UN SONDAGE CLOS N'EST JAMAIS PROPOSÉ
 * ------------------------------------
 * Il n'y a plus rien à y faire, et une carte qui mène à un résultat sans
 * question ouverte apprend au parent que ce bouton-là ne sert à rien. La règle
 * qui décide « clos » est `sondageFerme()`, la même que celle qu'emploie la
 * carte de l'onglet Plus : deux définitions de « clos » auraient fini par
 * diverger, et l'écran aurait proposé un vote que la base refuse.
 *
 * CE QUE « A RÉPONDU » VEUT DIRE, ET NE VEUT PAS DIRE
 * --------------------------------------------------
 * Une entrée dans la mémoire locale, quelle qu'elle soit. `CHOIX_INCONNU` en
 * est une : l'appareil a voté, la base ne dit pas quoi. La traiter comme « rien
 * de connu » ferait réapparaître l'invitation à répondre sur un sondage déjà
 * voté — exactement le défaut que ce module corrige.
 *
 * En revanche, la mémoire locale n'est pas une preuve : elle peut survivre à un
 * vote effacé en base par le bureau. Le pire qui en sorte est une carte qui dit
 * « Votre réponse est enregistrée » sur un sondage qu'on peut encore voter — et
 * l'onglet Plus, lui, laisse voter. L'erreur est donc bénigne, et dans le sens
 * qui ne bloque rien.
 *
 * CE QUE CE MODULE IMPORTE
 * ------------------------
 * Rien à l'exécution, hors `@/utils/date` et `@/lib/choix-retenu`, qui
 * n'importent rien non plus. C'est ce qui permet à
 * `tests/sondage-accueil.test.ts` de le charger sans React ni React Native.
 */

import type { Sondage } from '@/types/models';
import { aRepondu } from '@/lib/choix-retenu';
import { sondageFerme } from '@/utils/date';

/** Ce que l'accueil montre, et les mots qui vont avec. */
export interface InvitationSondage {
  readonly sondage: Sondage;
  /** La ligne mise en capitales à l'écran, au-dessus de la question. */
  readonly accroche: string;
  /** Le libellé de la pastille. Court : la pastille partage la largeur. */
  readonly action: string;
  /** Ce que l'ouverture de la carte fait, dit à un lecteur d'écran. */
  readonly indication: string;
}

/** L'accroche d'un sondage auquel on peut encore répondre. */
export const ACCROCHE_A_REPONDRE = 'Votre avis nous intéresse';

/**
 * L'accroche d'un sondage auquel on a déjà répondu.
 *
 * C'est la phrase que la carte de l'onglet Plus écrit sous le décompte, au
 * point final près. Deux écrans qui parlent du même vote doivent dire la même
 * chose : `tests/sondage-accueil.test.ts` tient cet accord, et il se romprait
 * en silence si l'une des deux formules était reformulée seule.
 */
export const ACCROCHE_DEJA_REPONDU = 'Votre réponse est enregistrée';

/** La pastille d'un sondage auquel on peut encore répondre. */
export const ACTION_REPONDRE = 'Participer';

/**
 * « Résultats », et non « Voir les résultats ».
 *
 * La pastille partage la largeur de la carte avec la question, qui est le texte
 * qu'on vient lire. Les deux mots de plus retirent une soixantaine de points à
 * la question, qui tombe alors de trois lignes utiles à deux — et c'est la
 * question qui porte le sens de la carte, pas le bouton.
 */
export const ACTION_CONSULTER = 'Résultats';

/** L'indication d'un sondage auquel on peut encore répondre. */
export const INDICATION_REPONDRE = 'Ouvre le sondage pour répondre';

/** L'indication d'un sondage auquel on a déjà répondu. */
export const INDICATION_CONSULTER = 'Ouvre le sondage pour voir les résultats';

/**
 * Le sondage que l'accueil propose, et ce qu'il en dit.
 *
 * Rend `null` quand il n'y a rien à proposer : aucun sondage ouvert, ou aucun
 * sondage du tout. L'accueil n'affiche alors aucune carte — une invitation qui
 * ne mène à rien apprend à ne plus la voir.
 *
 * @param sondages Les sondages, du plus récent au plus ancien. C'est l'ordre
 *                 que rend `listerSondages()`, et le premier sondage ouvert
 *                 est celui que l'accueil retient.
 * @param votes    La mémoire locale : identifiant de sondage vers choix retenu.
 *                 `CHOIX_INCONNU` compte comme une réponse.
 * @param maintenant Injectable, comme dans `@/utils/date` : sans cela, un banc
 *                   ne pourrait éprouver ni la clôture par date, ni l'absence
 *                   de date de clôture.
 */
export function invitationAccueil(
  sondages: readonly Sondage[],
  votes: Readonly<Record<string, string>>,
  maintenant: Date = new Date(),
): InvitationSondage | null {
  const sondage = sondages.find(
    (candidat) => !sondageFerme(candidat.ouvert, candidat.clotureLe, maintenant),
  );

  if (sondage === undefined) {
    return null;
  }

  // La question « a-t-il répondu ? » a une seule réponse dans tout le projet,
  // et elle vit dans `@/lib/choix-retenu` : `CHOIX_INCONNU` est la chaîne vide,
  // qu'un test de vérité prendrait pour « rien de connu ». L'onglet Plus appelle
  // la même règle, ce qui interdit aux deux écrans de se contredire.
  const repondu = aRepondu(votes, sondage.id);

  return {
    sondage,
    accroche: repondu ? ACCROCHE_DEJA_REPONDU : ACCROCHE_A_REPONDRE,
    action: repondu ? ACTION_CONSULTER : ACTION_REPONDRE,
    indication: repondu ? INDICATION_CONSULTER : INDICATION_REPONDRE,
  };
}
