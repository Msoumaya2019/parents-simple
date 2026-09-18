/**
 * Le texte à montrer pour n'importe quoi d'attrapé.
 *
 * Un `catch` reçoit `unknown`, et c'est justifié : rien ne garantit qu'un
 * `throw` vienne de notre code. Mais recopier le test `instanceof Error` dans
 * chaque écran finirait par produire un écran qui affiche « [object Object] »,
 * ce qui n'aide personne à comprendre ce qui s'est passé.
 */
export function messageDe(erreur: unknown): string {
  if (erreur instanceof Error) {
    return erreur.message;
  }
  return `Erreur inattendue : ${String(erreur)}`;
}
