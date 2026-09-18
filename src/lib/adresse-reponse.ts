/**
 * L'adresse de réponse d'un message adressé au bureau.
 *
 * POURQUOI CETTE RÈGLE EXISTE
 * ---------------------------
 * Le champ est facultatif : un parent peut écrire sans laisser d'adresse, et
 * c'est même ce que la page de contact lui explique — sans adresse, le bureau ne
 * pourra pas lui répondre. Mais lorsqu'il en renseigne une, la BASE impose une
 * forme plausible :
 *
 *   constraint messages_reponse_format check (
 *     reponse_a is null
 *     or reponse_a ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
 *   )
 *
 * Le formulaire, lui, ne vérifiait rien. Un parent qui écrivait son numéro de
 * téléphone à cette place remplissait tout, appuyait sur « Envoyer », et
 * recevait une erreur générique qui ne parlait ni d'adresse ni de format — et
 * qui l'invitait à réessayer, ce qui échouait à l'identique. Le commentaire de
 * l'écran annonçait pourtant l'inverse : « une adresse erronée se voit
 * immédiatement à l'absence de réponse ». C'était vrai du format, pas du refus.
 *
 * UNE SEULE NORMALISATION, ET LA RÈGLE PORTE SUR ELLE
 * ---------------------------------------------------
 * `normaliserAdresseReponse` est le SEUL endroit qui décide de ce qui part. La
 * règle de validation s'applique à sa sortie, jamais à la saisie brute : la
 * valeur jugée est donc exactement la valeur envoyée, et les deux ne peuvent
 * pas diverger.
 *
 * Ce point n'est pas théorique. La base, elle, applique `btrim` — qui ne retire
 * que des ESPACES, là où `trim()` de JavaScript retire aussi les tabulations et
 * les retours à la ligne. Une adresse précédée d'une tabulation serait acceptée
 * ici et refusée là-bas si l'on jugeait la saisie brute. En jugeant la valeur
 * normalisée, la question ne se pose plus.
 *
 * LE MOTIF EST RECOPIÉ, PAS INVENTÉ
 * ---------------------------------
 * C'est celui du schéma, transcrit pour JavaScript — `[:space:]` n'y existe pas,
 * donc la classe est écrite en toutes lettres : espace, tabulation, retour à la
 * ligne, tabulation verticale, saut de page, retour chariot. La casse est
 * ignorée des deux côtés (`~*` en SQL, `i` ici).
 *
 * Une validation PLUS stricte serait un autre défaut, et c'est la raison pour
 * laquelle le motif est repris tel quel : refuser une adresse valide décourage
 * plus qu'une adresse erronée, qui se voit à l'absence de réponse. La règle doit
 * être la MÊME des deux côtés — l'écran ne peut pas promettre ce que la base
 * refuse.
 *
 * `tests/adresse-reponse.test.ts` tient cet accord : il relit le motif dans la
 * migration et exige que les deux règles rendent le même verdict sur un corpus,
 * dans les deux sens — ni plus permissive, ni plus stricte.
 *
 * Le module n'importe RIEN, pour qu'un banc puisse le charger.
 */

/**
 * Le motif du schéma, transcrit pour JavaScript.
 *
 * `[^@ \t\n\v\f\r]` et non `[^@\s]` : `\s` de JavaScript reconnaît davantage de
 * caractères que `[:space:]` — une espace insécable, entre autres. Le formulaire
 * refuserait alors une adresse que la base aurait acceptée, c'est-à-dire une
 * adresse valide. La classe est donc écrite en toutes lettres.
 */
export const MOTIF_ADRESSE_REPONSE = /^[^@ \t\n\v\f\r]+@[^@ \t\n\v\f\r]+\.[^@ \t\n\v\f\r]+$/i;

/** Ce que lit un parent dont l'adresse ne passe pas. */
export const MESSAGE_ADRESSE_INVALIDE =
  'Cette adresse ne ressemble pas à une adresse e-mail. Écrivez-la en entier — par exemple ' +
  'prenom.nom@exemple.fr — ou laissez le champ vide pour écrire sans réponse.';

/**
 * La valeur qui partira vers la base : l'adresse nettoyée, ou `null` si le champ
 * est vide.
 *
 * Le `null` n'est pas un refus : c'est la façon dont la contrainte exprime
 * « aucune adresse », et l'écran envoie déjà `null` dans ce cas.
 */
export function normaliserAdresseReponse(texte: string): string | null {
  const propre = texte.trim();
  return propre === '' ? null : propre;
}

/**
 * Vrai si ce que l'écran s'apprête à envoyer sera accepté.
 *
 * Un champ vide est acceptable : l'adresse est facultative. Le verdict porte sur
 * la valeur NORMALISÉE — celle qui part — et non sur la saisie.
 */
export function adresseReponseAcceptable(texte: string): boolean {
  const propre = normaliserAdresseReponse(texte);
  return propre === null || MOTIF_ADRESSE_REPONSE.test(propre);
}
