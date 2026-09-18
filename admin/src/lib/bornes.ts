/**
 * Les bornes de saisie, alignées sur les contraintes de la base.
 *
 * POURQUOI ELLES SONT ÉCRITES ICI AUSSI
 * -------------------------------------
 * La base refuse déjà tout ce qui dépasse — c'est elle qui fait autorité, et
 * aucun formulaire ne peut la contourner. Mais un formulaire qui laisse saisir
 * 9 000 caractères dans un champ limité à 8 000 ne fait pas gagner du temps : il
 * laisse écrire, puis refuse à l'enregistrement, avec un message de Postgres que
 * personne ne peut lire.
 *
 * Ces valeurs sont donc un confort d'usage, pas un contrôle. Le contrôle est
 * dans `supabase/migrations/`, et `scripts/check-admin.mjs` compare les deux
 * pour qu'une borne relevée en base ne laisse pas ce fichier mentir.
 *
 * POURQUOI LA CONTRAINTE EST UNE VALEUR, ET NON UN COMMENTAIRE
 * ------------------------------------------------------------
 * Chaque borne nommait sa contrainte d'origine dans un commentaire. Un
 * commentaire ne se relit pas : rien n'empêchait `titreAnnonce` de désigner une
 * contrainte renommée ou disparue. Pire, le contrôle automatique n'aurait alors
 * eu aucun moyen de savoir à quoi comparer 160 — il lui aurait fallu lire le
 * commentaire, c'est-à-dire croire sur parole ce qu'il prétend vérifier. Le nom
 * est donc une donnée, et c'est elle que le contrôle relit.
 *
 * SEULE LA BORNE HAUTE EST TENUE
 * ------------------------------
 * Les contraintes s'écrivent `between 1 and 160`, et cette page n'applique que
 * le 160 : le minimum, lui, est tenu par le refus du champ vide, qui vit dans
 * chaque écran. Déclarer ici un minimum que rien ne lirait reproduirait
 * exactement le défaut décrit ci-dessous.
 *
 * CE QUI A ÉTÉ RETIRÉ, ET POURQUOI
 * --------------------------------
 * Une septième borne, `courrielMembre` (320), reflétait la contrainte de
 * `membres_bureau`. Elle a été retirée : aucun écran de cette page ne saisit
 * d'adresse de membre, les comptes du bureau se créant depuis le tableau de
 * bord. Une borne posée sur aucun champ ne borne rien, et sa présence laissait
 * croire que cette page gère la liste des membres — ce qu'elle ne fait pas, et
 * ce que `docs/05-administration.md` explique.
 *
 * CE QUE CE FICHIER NE TIENT PAS
 * ------------------------------
 * Deux contraintes de la base n'ont pas de borne chiffrée, et sont donc
 * reflétées par les fonctions plus bas plutôt que par une entrée de `BORNES` :
 * `cantine_menus_contenu` (`menuRenseigne`) et `agenda_ordre_valide`
 * (`ordreDesDatesValide`). `scripts/check-admin.mjs` ne les compare pas. Leur
 * désaccord ne serait pas muet pour autant : la base refuserait
 * l'enregistrement, et l'écran afficherait son message.
 */
export const BORNES = Object.freeze({
  titreAnnonce: { contrainte: 'annonces_titre_valide', max: 160 },
  corpsAnnonce: { contrainte: 'annonces_corps_valide', max: 8000 },
  adresseImage: { contrainte: 'annonces_image_url_valide', max: 1000 },
  titreEvenement: { contrainte: 'agenda_titre_valide', max: 160 },
  titreDocument: { contrainte: 'documents_titre_valide', max: 160 },
  cheminDocument: { contrainte: 'documents_chemin_valide', max: 400 },
});

/**
 * Vrai si le menu porte au moins un plat.
 *
 * La contrainte `cantine_menus_contenu` exige qu'au moins un des trois services
 * soit renseigné : une ligne de menu entièrement vide n'apprendrait rien à un
 * parent et occuperait un jour du calendrier.
 *
 * Un texte fait uniquement d'espaces ne compte pas — la base compare sur
 * `btrim`, et ce serait une façon de la tromper qui ne tromperait personne.
 */
export function menuRenseigne(entree: string, plat: string, dessert: string): boolean {
  return [entree, plat, dessert].some((valeur) => valeur.trim() !== '');
}

/**
 * Vrai si l'ordre des dates est tenable.
 *
 * `agenda_ordre_valide` refuse une fin antérieure au début. La base l'accepte
 * pourtant si `fin_le` est nul, ce qui est le cas d'un événement sans heure de
 * fin — d'où la comparaison seulement quand la fin est renseignée.
 */
export function ordreDesDatesValide(debut: string, fin: string): boolean {
  if (fin.trim() === '') {
    return true;
  }
  return new Date(fin).getTime() >= new Date(debut).getTime();
}
