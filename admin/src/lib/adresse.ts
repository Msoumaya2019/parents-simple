/**
 * Le lien « répondre » d'un message de parent.
 *
 * POURQUOI CE N'EST PAS UNE SIMPLE CONCATÉNATION
 * ----------------------------------------------
 * `reponse_a` est une valeur qu'un parent a saisie. La base lui impose une
 * forme plausible — `messages_reponse_format`, dans `20260917120000_init.sql` —
 * mais cette forme est LARGE : la classe `[^@[:space:]]+` du motif accepte
 * `?`, `&`, `=`, `#`, `/` et `,`. Une valeur telle que
 *
 *     prenom@exemple.fr?subject=Facture%20impay%C3%A9e
 *
 * est donc acceptée par la base, et une concaténation naïve en ferait un lien
 * qui ouvre le logiciel de messagerie du bureau avec un sujet et un texte déjà
 * remplis — écrits par le parent, pas par le bureau. Une virgule, de la même
 * façon, ajouterait un second destinataire.
 *
 * Ce n'est pas une faille : le bureau voit ce qu'il envoie avant de l'envoyer.
 * C'est une valeur qui se fait passer pour autre chose au moment précis où on
 * la clique, et ce projet refuse cela ailleurs — il ne voit pas de raison de
 * l'accepter ici.
 *
 * CE QUI EST REMIS TEL QUEL, ET POURQUOI
 * --------------------------------------
 * `encodeURIComponent` encode tout ce qui pourrait changer la lecture de la
 * valeur. C'est ce qu'on veut, et c'est presque toujours suffisant — mais deux
 * caractères d'une adresse ordinaire en sortent encodés sans que cela protège
 * quoi que ce soit :
 *
 *   - l'AROBASE, en `%40`. Elle est remise, et `replace` avec une chaîne ne
 *     remplace QUE la première occurrence : le motif de la base interdit de
 *     toute façon une seconde arobase (`[^@]` ne l'accepte nulle part), mais
 *     l'implémentation ne s'en remet pas à lui. Restaurer toutes les `%40`
 *     rendrait le découpage de l'adresse ambigu ;
 *   - le PLUS, en `%2B`. Il est fréquent dans les adresses — c'est le signe des
 *     étiquettes de tri — et un client qui ne décoderait pas percent-encore
 *     ouvrirait le message à la mauvaise adresse. Le remède serait alors pire
 *     que le défaut.
 *
 * Les autres caractères qu'une adresse porte réellement — le point, le tiret,
 * le souligné, le tilde, le point d'exclamation — ne sont pas encodés par
 * `encodeURIComponent`, et n'ont donc pas à être restaurés. L'apostrophe, elle,
 * reste encodée : elle est rare dans une adresse, et la laisser encodée coûte
 * moins qu'une règle de plus.
 *
 * Ce qui RESTE encodé est exactement ce qui compte : `?`, `&`, `#`, `=`, `/`,
 * `,`, `;`, les espaces, et tout caractère hors de l'ASCII imprimable — donc
 * les accents, qu'une adresse acceptée par la base peut porter.
 *
 * Le module n'importe RIEN, pour qu'un banc puisse le charger.
 */

/**
 * L'adresse d'un lien `mailto:` qui ne peut pas déborder sur ses paramètres.
 *
 * Rend une chaîne toujours exploitable : une adresse vide produit `mailto:`,
 * que le navigateur ouvre sur un message vide. L'appelant, lui, ne construit ce
 * lien que lorsqu'une adresse existe.
 */
export function lienMailto(adresse: string): string {
  return `mailto:${encodeURIComponent(adresse).replace('%40', '@').replaceAll('%2B', '+')}`;
}
