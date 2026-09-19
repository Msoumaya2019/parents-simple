/**
 * Ce que l'appareil a retenu pour un sondage, tel qu'un écran doit le lire.
 *
 * POURQUOI CETTE RÈGLE EXISTE
 * ---------------------------
 * Deux écrans posent la même question — « cet appareil a-t-il répondu à ce
 * sondage ? » : l'accueil, pour choisir ses mots, et l'onglet Plus, pour savoir
 * quel choix mettre en évidence. Chacun y répondait à sa façon : `!== undefined`
 * d'un côté, `?? null` de l'autre. Les deux étaient justes, mais rien ne tenait
 * qu'elles le restent.
 *
 * Ce qui se perd n'est pas visible à l'œil : `CHOIX_INCONNU` est la chaîne
 * VIDE, et une seule des deux expressions passée à un test de vérité
 * (`|| null`, `Boolean(...)`) en ferait un « rien de connu ». L'accueil dirait
 * alors « Votre réponse est enregistrée » pendant que l'onglet Plus reproposerait
 * les choix — et le parent qui appuie n'obtiendrait rien : la base refuse un
 * second vote, `voteARetenir` rend de nouveau `CHOIX_INCONNU`, et l'écran
 * revient exactement à son état d'avant. Une boucle sans message.
 *
 * POURQUOI ELLE EST DANS SON PROPRE FICHIER
 * -----------------------------------------
 * `@/lib/votes-locaux` porte la même distinction, mais il importe
 * `AsyncStorage` à l'exécution. L'importer depuis `@/lib/sondage-accueil`
 * aurait rendu ce dernier inchargeable par un banc — sans React Native, sans
 * moteur de rendu. Ce module-ci n'importe RIEN, ni à l'exécution ni pour un
 * type : c'est ce qui lui permet d'être appelé par les deux écrans ET éprouvé
 * sur des cas. Même raison, même remède que `admin/src/lib/message-liste.ts`,
 * et `tests/choix-retenu.test.ts` tient l'accord des deux appels.
 *
 * CE QU'UNE VALEUR VEUT DIRE
 * --------------------------
 * Une entrée dans la mémoire locale, quelle qu'elle soit. `CHOIX_INCONNU` en
 * est une : l'appareil a voté, la base ne dit pas quoi. `null` veut dire « rien
 * de connu », et c'est le seul cas où un écran peut inviter à répondre.
 *
 * La mémoire locale n'est pas une preuve : elle survit à un vote effacé en base
 * par le bureau. L'erreur va dans le sens qui ne bloque rien — voir le
 * docblock de `@/lib/sondage-accueil`.
 */

/**
 * Le choix retenu pour un sondage, ou `null` si l'appareil n'a rien retenu.
 *
 * `??` et non `||` : `CHOIX_INCONNU` est la chaîne vide, qui est fausse en
 * JavaScript. Un test de vérité la confondrait avec « rien de connu », et
 * l'onglet Plus reproposerait un vote que la base refusera.
 */
export function choixRetenuPour(
  votes: Readonly<Record<string, string>>,
  sondageId: string,
): string | null {
  return votes[sondageId] ?? null;
}

/**
 * Vrai si l'appareil a voté sur ce sondage, quel que soit le choix retenu.
 *
 * Exprimée à partir de `choixRetenuPour` plutôt que d'un `in` ou d'un
 * `!== undefined` écrit ici : deux expressions de la même question pourraient
 * diverger, et c'est précisément ce que ce module existe pour empêcher.
 */
export function aRepondu(votes: Readonly<Record<string, string>>, sondageId: string): boolean {
  return choixRetenuPour(votes, sondageId) !== null;
}
