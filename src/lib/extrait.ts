/**
 * Troncature d'un texte à la fin d'un mot.
 *
 * POURQUOI CETTE RÈGLE VIT ICI ET NON DANS LA CARTE
 * -------------------------------------------------
 * Elle vivait dans `AnnonceCard.tsx`, à côté du rendu. Un composant qui importe
 * React ne se charge pas sous `node --test` : la règle n'était donc éprouvable
 * par rien, alors qu'elle décide de la première chose qu'un parent lit.
 *
 * Ce fichier n'importe RIEN — c'est ce qui le rend chargeable, comme
 * `responsable.ts` et `adresse-reponse.ts`.
 *
 * LA RÈGLE, ET SON REPLI
 * ----------------------
 * L'extrait se coupe à la fin d'un mot : une coupure au milieu se lit comme une
 * faute de frappe, et c'est la première chose qu'un parent voit.
 *
 * Le repli existe pour un cas précis : quand aucun espace ne tombe dans les
 * derniers 40 % de la longueur demandée — un segment de plus de `max * 0.4`
 * caractères, une adresse web recopiée dans le corps par exemple —, couper au
 * dernier espace trouvé donnerait un extrait de quelques caractères, ce qui ne
 * renseigne sur rien. Dans ce seul cas, la coupe se fait au caractère.
 *
 * L'en-tête de `AnnonceCard.tsx` affirmait la règle sans son repli, et se
 * trouvait donc faux sur ce cas. La règle et son exception sont maintenant au
 * même endroit, tenues par `tests/extrait.test.ts`.
 *
 * CE QU'ELLE NE FAIT PAS
 * ----------------------
 * Elle ne respecte pas les paragraphes : toute suite de blancs — espaces,
 * tabulations, sauts de ligne — devient une seule espace. L'extrait s'affiche
 * sur deux lignes, où un saut de paragraphe ne se verrait pas.
 *
 * Elle ne devine pas les phrases : elle ne coupe pas après un point, parce que
 * les corps d'actualité contiennent des abréviations et des adresses, où le
 * point ne termine rien.
 */

/**
 * Le texte, ramené à une ligne et coupé à la fin d'un mot.
 *
 * `max` compte les caractères du texte retenu, sans le `…` final. Un texte plus
 * court que `max` est rendu tel quel, ses blancs normalisés.
 */
export function extraire(corps: string, max = 180): string {
  const propre = corps.replace(/\s+/g, ' ').trim();
  if (propre.length <= max) {
    return propre;
  }

  const coupe = propre.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(' ');
  const base = dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  return `${base.trimEnd()}…`;
}
