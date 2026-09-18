/**
 * Chargement asynchrone d'un écran.
 *
 * POURQUOI CE HOOK EXISTE
 * -----------------------
 * Le motif naturel — un booléen `chargement` poussé à `true` dans un effet —
 * a deux défauts. Le premier est visible à l'œil : au tout premier rendu, le
 * booléen vaut `false` et l'écran affiche « aucune actualité » pendant une
 * fraction de seconde, avant de basculer sur un indicateur de chargement. Un
 * parent lit ce message, et il est faux.
 *
 * Le second est un refus d'ESLint (`react-hooks/set-state-in-effect`) : écrire
 * un état de façon synchrone dans un effet provoque un second rendu immédiat,
 * et la règle le signale à juste titre.
 *
 * D'où le motif retenu : l'état de chargement n'est pas poussé, il est DÉRIVÉ.
 * Le résultat mémorisé porte l'empreinte de la demande à laquelle il répond.
 * Tant que cette empreinte ne correspond pas à la demande courante, l'écran est
 * en chargement — sans qu'aucun état n'ait eu besoin d'être écrit.
 *
 * Le compteur de génération sert à ignorer une réponse devenue obsolète : sans
 * lui, une requête lente lancée avant un changement de filtre peut se terminer
 * après la suivante et écraser un résultat plus récent.
 *
 * DEUX QUESTIONS, ET NON UNE
 * --------------------------
 * Ce hook répond à deux questions distinctes, et les confondre a coûté cher :
 *
 *   - `etat` — ce que l'écran affiche. Un rechargement garde l'ancien résultat
 *     à l'écran, pour que la liste ne disparaisse pas pendant qu'on la
 *     rafraîchit ;
 *   - `enCours` — la demande courante est-elle terminée ? Un rechargement
 *     répond NON, même si l'écran affiche déjà quelque chose.
 *
 * Les deux règles vivent dans `@/lib/chargement`, qui n'importe rien : un banc
 * ne peut pas charger ce fichier-ci, qui importe React. Les écrans passent
 * `enCours` au geste de rafraîchissement, jamais `etat.statut`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { detailTechnique, messagePourUtilisateur } from '@/errors';
import { chargementEnCours, etatDerive } from '@/lib/chargement';
import type { EtatAsync, ResultatMemorise } from '@/lib/chargement';

export type { EtatAsync } from '@/lib/chargement';

export interface ChargementAsync<T> {
  /** Ce que l'écran affiche : le dernier résultat, ou un chargement. */
  readonly etat: EtatAsync<T>;
  /**
   * Vrai tant que la demande courante n'a pas rendu son résultat — y compris
   * pendant un rechargement, alors que `etat` porte encore l'ancien résultat.
   */
  readonly enCours: boolean;
  readonly recharger: () => void;
}

/**
 * @param cle     Empreinte de la demande. Changer cette valeur relance le
 *                chargement — c'est ce qui distingue « charger une fois » de
 *                « recharger quand le filtre change ».
 * @param charger Fonction de chargement. Elle peut être recréée à chaque rendu
 *                sans conséquence : elle est lue depuis une référence, et
 *                n'entre pas dans les dépendances de l'effet.
 */
export function useAsyncData<T>(cle: string, charger: () => Promise<T>): ChargementAsync<T> {
  const [resultat, setResultat] = useState<ResultatMemorise<T> | null>(null);
  const [tentative, setTentative] = useState(0);
  const generation = useRef(0);

  // La fonction de chargement est conservée dans une référence, mise à jour à
  // chaque rendu. Sans cela, une fonction écrite en ligne dans le composant
  // changerait d'identité à chaque rendu, relancerait l'effet, qui déclencherait
  // un rendu, et ainsi de suite — une boucle de requêtes.
  const chargerRef = useRef(charger);
  useEffect(() => {
    chargerRef.current = charger;
  });

  useEffect(() => {
    const courante = generation.current + 1;
    generation.current = courante;

    void (async () => {
      try {
        const donnees = await chargerRef.current();
        if (generation.current === courante) {
          setResultat({ cle, tentative, etat: { statut: 'succes', donnees } });
        }
      } catch (erreur) {
        if (generation.current === courante) {
          setResultat({
            cle,
            tentative,
            etat: {
              statut: 'erreur',
              message: messagePourUtilisateur(erreur),
              technique: detailTechnique(erreur),
            },
          });
        }
      }
    })();
  }, [cle, tentative]);

  const recharger = useCallback(() => {
    setTentative((n) => n + 1);
  }, []);

  // C'est ici que le chargement est dérivé plutôt que poussé : tant que le
  // résultat mémorisé ne porte pas la clé de la demande courante, l'écran est
  // en chargement, et il l'est dès le premier rendu.
  const etat = etatDerive(resultat, cle);
  const enCours = chargementEnCours(resultat, cle, tentative);

  return { etat, enCours, recharger };
}
