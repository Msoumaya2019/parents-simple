import type { EtatChargement } from './chargement';

/**
 * Ce que dit la carte de liste quand elle n'a rien à montrer.
 *
 * POURQUOI CETTE FONCTION EXISTE
 * ------------------------------
 * Les quatre écrans écrivaient `<p>Chargement…</p>` dès que la liste était
 * absente — c'est-à-dire dans DEUX cas : la demande est en vol, ou elle a
 * échoué. Dans le second, l'écran annonçait donc un chargement qui n'arriverait
 * jamais, pendant que le message d'erreur s'affichait dans l'encadré du
 * formulaire, juste au-dessus. Deux phrases contradictoires sur le même écran.
 *
 * Le défaut était recopié quatre fois : une correction n'en aurait touché
 * qu'une. La règle est donc écrite une seule fois, ici, et les quatre écrans
 * l'appellent.
 *
 * POURQUOI CE N'EST PAS DANS `chargement.ts`
 * ------------------------------------------
 * C'était le premier endroit choisi, et il ne tenait pas : `chargement.ts`
 * importe `./erreurs` sans extension — ce qu'exige l'empaqueteur, et ce que
 * Node refuse pour un import relatif. Le banc ne pouvait donc pas charger le
 * fichier, et la fonction redevenait inéprouvable. Mesuré, pas supposé :
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module '…\admin\src\lib\erreurs'
 *       imported from …\admin\src\lib\chargement.ts
 *
 * Ce module-ci n'importe rien à l'exécution : le seul import est un
 * `import type`, que l'effacement des types retire avant que Node ne résolve
 * quoi que ce soit. C'est cette absence d'import qui rend la fonction
 * interrogeable par `tests/message-liste-absente.test.ts`, sans moteur de rendu
 * et sans React.
 *
 * Le type, lui, n'est pas redéclaré : il vient de `chargement.ts`. Deux
 * déclarations des mêmes états dériveraient, et c'est précisément l'accord que
 * le banc doit tenir.
 *
 * `succes` n'atteint pas cette fonction : l'appelant ne la consulte que si la
 * liste est absente, et une liste chargée — même vide — a son propre texte
 * (« Aucune annonce pour le moment. »), qui ne dit pas la même chose qu'un
 * échec.
 */
export function messageListeAbsente<T>(etat: EtatChargement<T>): string {
  if (etat.statut === 'erreur') {
    return 'La liste n’a pas pu être chargée. Le détail est dans l’encadré ci-dessus.';
  }
  return 'Chargement…';
}
