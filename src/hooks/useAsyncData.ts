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
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import { detailTechnique, messagePourUtilisateur } from '@/errors';

export type EtatAsync<T> =
  | { readonly statut: 'chargement' }
  | { readonly statut: 'succes'; readonly donnees: T }
  | {
      readonly statut: 'erreur';
      readonly message: string;
      readonly technique: string | null;
    };

interface ResultatMemorise<T> {
  readonly cle: string;
  readonly etat: EtatAsync<T>;
}

export interface ChargementAsync<T> {
  readonly etat: EtatAsync<T>;
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
          setResultat({ cle, etat: { statut: 'succes', donnees } });
        }
      } catch (erreur) {
        if (generation.current === courante) {
          setResultat({
            cle,
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
  const etat: EtatAsync<T> =
    resultat !== null && resultat.cle === cle ? resultat.etat : { statut: 'chargement' };

  return { etat, recharger };
}
