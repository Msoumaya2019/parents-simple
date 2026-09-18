/**
 * Ce que l'écran Réglages dit de la liaison avec la base.
 *
 * POURQUOI CETTE RÈGLE EXISTE
 * ---------------------------
 * La section « État de l'application » annonçait, en tête de `app/reglages.tsx`,
 * répondre à cette question : « quand l'application n'affiche aucune donnée, la
 * première question est de savoir si c'est l'école qui n'a rien publié ou
 * l'application qui n'est pas reliée à sa base ».
 *
 * Elle n'y répondait pas. Elle affichait une coche verte devant « Base de
 * données » dès que l'adresse était renseignée — c'est-à-dire dès que
 * l'application était CONFIGURÉE. Or « configurée » et « joignable » sont deux
 * faits différents : un téléphone sans réseau, ou un projet momentanément
 * indisponible, laissaient la coche verte en place. Le parent concluait que tout
 * allait bien, et donc que l'école n'avait rien publié.
 *
 * C'est la même faute que dans `useAsyncData`, où `etat.statut === 'chargement'`
 * répondait à « qu'est-ce que j'affiche ? » au lieu de « la demande est-elle
 * finie ? ». Une réponse dérivée n'est utile que si c'est la question posée.
 *
 * LA RÈGLE, ET CE QU'ELLE REFUSE DE DIRE
 * --------------------------------------
 * Trois états, et chacun ne dit que ce qui est établi :
 *
 *   - la sonde n'a pas encore rendu → on ne sait pas, et on le dit ;
 *   - la sonde a réussi → la base répond. C'est alors, et seulement alors, qu'une
 *     page vide s'explique par une absence de publication ;
 *   - la sonde a échoué → la base n'a pas répondu. On ne devine PAS la cause :
 *     deviner une cause à partir d'un message d'erreur produit un jour un message
 *     faux, et un message faux est pire qu'un message vague.
 *
 * Et un cas qui domine les trois autres : sans base configurée, il n'y a rien à
 * sonder. Annoncer « la base ne répond pas » serait faux — elle n'a jamais été
 * appelée.
 *
 * Le module n'importe RIEN, pour qu'un banc puisse le charger : un écran, lui,
 * importe React Native.
 */

/** Le statut d'une demande, tel que `useAsyncData` le rend. */
export type EtatSonde = 'chargement' | 'succes' | 'erreur';

/** Les tons sémantiques de la palette — voir `src/theme/index.ts`. */
export type TonDiagnostic = 'neutre' | 'succes' | 'alerte' | 'danger';

export interface DiagnosticConnexion {
  readonly libelle: string;
  readonly ton: TonDiagnostic;
  /** Ce qu'on ajoute sous la ligne, ou `null` s'il n'y a rien à ajouter. */
  readonly aide: string | null;
}

/**
 * Ce que lit un parent devant la ligne « Connexion ».
 *
 * @param baseConfiguree Vrai si l'application a une adresse de base et une clé.
 * @param etatSonde      Où en est la sonde de joignabilité.
 */
export function diagnosticConnexion(
  baseConfiguree: boolean,
  etatSonde: EtatSonde,
): DiagnosticConnexion {
  // Ce cas passe avant les autres : sans base, la sonde n'a rien pu éprouver, et
  // son échec ne dit rien de la connexion du téléphone.
  if (!baseConfiguree) {
    return {
      libelle: 'Non vérifiable',
      ton: 'alerte',
      aide:
        "Aucune base n'est configurée : l'application ne peut rien afficher. " +
        'Le détail figure juste en dessous.',
    };
  }

  switch (etatSonde) {
    case 'chargement':
      return { libelle: 'Vérification…', ton: 'neutre', aide: null };

    case 'succes':
      return {
        libelle: 'La base répond',
        ton: 'succes',
        aide:
          "L'application est bien reliée. Si l'accueil reste vide, c'est que rien " +
          "n'a encore été publié — ce n'est pas un problème de connexion.",
      };

    case 'erreur':
      return {
        libelle: 'La base ne répond pas',
        ton: 'danger',
        aide:
          "L'application n'a pas pu joindre la base. Vérifiez la connexion du " +
          'téléphone, puis réessayez ; si cela persiste, la base est peut-être ' +
          'momentanément indisponible.',
      };
  }
}
