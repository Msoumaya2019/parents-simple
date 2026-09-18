/**
 * Complétude des coordonnées du responsable de traitement.
 *
 * POURQUOI CETTE RÈGLE VIT ICI ET NON DANS L'ÉCRAN
 * ------------------------------------------------
 * La page de confidentialité choisit entre deux affichages : les coordonnées
 * réelles, ou un avertissement. Le choix tient à une seule question — les trois
 * valeurs sont-elles renseignées ? — et cette question a deux propriétés qui la
 * rendent digne d'un banc :
 *
 *   - se tromper dessus est INVISIBLE. La branche « complète » rend une carte
 *     qui a l'air terminée. Si une valeur manque, le parent lit une adresse
 *     vide là où il doit écrire pour exercer ses droits, et rien ne le signale ;
 *   - elle se trompe d'un seul caractère. `=== ''` ne voit pas une valeur faite
 *     d'espaces : coller « » par accident suffit à faire passer la page pour
 *     renseignée.
 *
 * Le fichier n'importe RIEN, et c'est délibéré : c'est ce qui permet à
 * `tests/responsable-traitement.test.ts` de le charger. Un module qui importerait
 * React, ou un import relatif sans extension — ce que l'empaqueteur exige et ce
 * que Node refuse —, ne serait éprouvable que par un rendu, c'est-à-dire pas du
 * tout dans ce dépôt.
 *
 * CE QUE CETTE RÈGLE NE DIT PAS
 * -----------------------------
 * Elle ne dit pas si les valeurs sont VRAIES. Elle ne peut pas : le nom de
 * l'association, l'adresse de son siège et son adresse de contact figurent dans
 * ses statuts. Elle dit seulement si quelque chose a été renseigné — ce qui est
 * exactement ce que l'avertissement promet.
 */

/** Les trois valeurs à renseigner, dans l'ordre où la page les affiche. */
export type Responsable = {
  readonly nom: string;
  readonly siege: string;
  readonly courriel: string;
};

/** Le nom d'un des trois champs, tel qu'il se lit dans le code. */
export type ChampResponsable = keyof Responsable;

/**
 * L'ordre des champs, écrit une fois.
 *
 * Il n'est pas déduit de `Object.keys` : l'ordre d'un objet JavaScript suit
 * l'ordre d'insertion, donc une réécriture de l'objet changerait l'ordre
 * d'affichage sans que rien ne le signale.
 */
const CHAMPS: readonly ChampResponsable[] = ['nom', 'siege', 'courriel'];

/**
 * Les champs qui manquent, dans l'ordre d'affichage.
 *
 * Rendus un par un plutôt qu'un simple booléen, parce qu'un avertissement qui
 * ne dit pas CE QUI manque oblige à relire le code pour s'en servir — et parce
 * qu'un banc peut alors exiger la liste exacte, là où un booléen ne laisse
 * vérifier que sa valeur.
 *
 * `trim()` : une valeur faite d'espaces est une valeur absente. C'est la
 * différence entre « renseigné » et « non vide ».
 */
export function champsManquantsResponsable(entree: Responsable): readonly ChampResponsable[] {
  return CHAMPS.filter((champ) => entree[champ].trim() === '');
}

/** Vrai tant qu'il manque au moins une des trois valeurs. */
export function responsableIncomplet(entree: Responsable): boolean {
  return champsManquantsResponsable(entree).length > 0;
}
