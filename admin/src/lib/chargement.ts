import { useCallback, useEffect, useRef, useState } from 'react';

import { messageDe } from './erreurs';

/**
 * Chargement asynchrone d'une liste.
 *
 * POURQUOI CE CROCHET EXISTE
 * --------------------------
 * C'est le pendant, pour cette page, de `src/hooks/useAsyncData.ts` de
 * l'application mobile. Les quatre écrans chargent une liste au montage et la
 * rechargent après chaque enregistrement : sans ce crochet, la même vingtaine
 * de lignes serait recopiée quatre fois, et une correction n'en toucherait
 * qu'une.
 *
 * Deux raisons de fond, et non de commodité :
 *
 *   - **L'état de chargement est DÉRIVÉ, pas poussé.** Le motif naturel — un
 *     booléen mis à `true` dans l'effet — affiche « aucune annonce » pendant
 *     une fraction de seconde avant de basculer sur « chargement ». Le bureau
 *     lit ce message, et il est faux. Ici, tant que le résultat mémorisé ne
 *     porte pas la clé de la demande courante, l'écran EST en chargement, dès
 *     le premier rendu, sans qu'aucun état n'ait été écrit.
 *
 *   - **Le compteur de génération.** Une réponse lente lancée avant un
 *     enregistrement peut se terminer après le rechargement qui a suivi, et
 *     réafficher l'ancienne liste. Le compteur fait ignorer toute réponse qui
 *     n'est plus la dernière demandée.
 *
 * L'écriture d'état se fait dans une fonction asynchrone, ce qui est aussi ce
 * que demande la règle `react-hooks/set-state-in-effect` : écrire un état de
 * façon synchrone dans un effet provoque un second rendu immédiat.
 */

export type EtatChargement<T> =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'succes'; readonly donnees: T }
  | { readonly statut: 'erreur'; readonly message: string };

export interface Chargement<T> {
  readonly etat: EtatChargement<T>;
  readonly recharger: () => void;
}

interface ResultatMemorise<T> {
  readonly cle: string;
  readonly etat: EtatChargement<T>;
}

/**
 * @param cle     Empreinte de la demande. La changer relance le chargement.
 * @param charger Fonction de chargement. Elle peut être recréée à chaque rendu
 *                sans conséquence : elle est lue depuis une référence, et
 *                n'entre donc pas dans les dépendances de l'effet.
 */
export function useChargement<T>(cle: string, charger: () => Promise<T>): Chargement<T> {
  const [resultat, setResultat] = useState<ResultatMemorise<T> | null>(null);
  const [tentative, setTentative] = useState(0);
  const generation = useRef(0);

  // La fonction de chargement est conservée dans une référence, mise à jour à
  // chaque rendu. Sans cela, une fonction écrite en ligne dans le composant
  // changerait d'identité à chaque rendu, relancerait l'effet, qui
  // déclencherait un rendu — une boucle de requêtes.
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
          setResultat({ cle, etat: { statut: 'succes', donnees } });
        }
      } catch (inattendu) {
        if (generation.current === courante) {
          setResultat({ cle, etat: { statut: 'erreur', message: messageDe(inattendu) } });
        }
      }
    })();
  }, [cle, tentative]);

  const recharger = useCallback(() => {
    setTentative((nombre) => nombre + 1);
  }, []);

  const etat: EtatChargement<T> =
    resultat !== null && resultat.cle === cle ? resultat.etat : { statut: 'chargement' };

  return { etat, recharger };
}
