/**
 * Erreurs applicatives.
 *
 * POURQUOI UNE CLASSE PLUTÔT QU'UN `Error` NU
 * -------------------------------------------
 * Supabase renvoie des erreurs en anglais, avec le nom de la table et le code
 * PostgreSQL. Ces messages sont précieux dans les journaux et inutiles à
 * l'écran : « new row violates check constraint "messages_sujet_valide" » ne
 * dit rien à un parent qui essaie d'écrire au bureau.
 *
 * `AppError` porte donc deux niveaux :
 *   - `message`, en français, destiné à l'écran ;
 *   - `technique`, le détail d'origine, affiché uniquement en développement.
 *
 * La traduction se fait à un seul endroit — `traduireErreur` — pour qu'aucun
 * écran n'ait à interpréter un code d'erreur lui-même. Deux écrans qui
 * traduisent la même erreur finissent toujours par diverger.
 */

import { appConfig } from '@/config/env';

export class AppError extends Error {
  /** Détail d'origine, pour les journaux. Jamais affiché en production. */
  readonly technique: string | null;

  constructor(message: string, technique?: string | null) {
    super(message);
    this.name = 'AppError';
    this.technique = technique ?? null;
  }
}

/** Message affichable pour n'importe quelle erreur, y compris inconnue. */
export function messagePourUtilisateur(erreur: unknown): string {
  if (erreur instanceof AppError) {
    return erreur.message;
  }

  if (erreur instanceof Error) {
    return traduireErreur(erreur.message).message;
  }

  return 'Une erreur inattendue est survenue. Réessayez dans un instant.';
}

/** Détail technique, ou `null` en production. */
export function detailTechnique(erreur: unknown): string | null {
  if (!appConfig.appEnv || appConfig.appEnv === 'production') {
    return null;
  }

  if (erreur instanceof AppError) {
    return erreur.technique;
  }

  if (erreur instanceof Error) {
    return erreur.message;
  }

  return null;
}

/**
 * Traduit une erreur Supabase en message lisible.
 *
 * Les correspondances sont volontairement peu nombreuses et explicites. Une
 * correspondance devinée à partir d'une sous-chaîne produit, un jour, un
 * message faux — et un message faux est pire qu'un message générique, parce
 * qu'il envoie l'utilisateur chercher une cause qui n'existe pas.
 */
export function traduireErreur(brut: string): AppError {
  const texte = brut.toLowerCase();

  if (texte.includes('failed to fetch') || texte.includes('network request failed')) {
    return new AppError(
      'Impossible de joindre le serveur. Vérifiez votre connexion internet, puis réessayez.',
      brut,
    );
  }

  if (texte.includes('trop de messages')) {
    return new AppError(
      'Vous avez envoyé plusieurs messages coup sur coup. Merci de réessayer dans quelques minutes.',
      brut,
    );
  }

  if (texte.includes('ce sondage est fermé')) {
    return new AppError('Ce sondage est maintenant fermé.', brut);
  }

  if (texte.includes('le choix ne fait pas partie de ce sondage')) {
    return new AppError(
      'Ce sondage a changé entre-temps. Rechargez la page pour voir les réponses à jour.',
      brut,
    );
  }

  if (texte.includes('jwt') || texte.includes('invalid api key')) {
    return new AppError(
      "L'application n'est pas correctement configurée. Contactez la personne qui l'a installée.",
      brut,
    );
  }

  // Le code PostgreSQL 42501 est un refus de privilège : la requête est
  // légitime du point de vue de l'écran, mais la base la refuse. Cela signifie
  // presque toujours qu'une politique RLS manque, ou qu'une opération a été
  // écrite côté application alors qu'elle devait passer par une fonction.
  if (texte.includes('permission denied') || texte.includes('42501')) {
    return new AppError(
      "Cette action n'est pas autorisée. Si le problème persiste, signalez-le.",
      brut,
    );
  }

  // Dernier recours : la cause n'a pas été reconnue. Deux exigences, et elles
  // se contredisent presque.
  //
  // Il ne doit nommer AUCUNE phase. Le même repli sert à la lecture et à
  // l'envoi ; « pendant le chargement » était donc faux pour un message qui
  // n'est jamais parti, et il envoyait le parent chercher une panne de réseau
  // qui n'existait pas.
  //
  // Il ne doit pas non plus inventer une cause — c'est la règle de ce fichier.
  // Il dit donc seulement qu'il ne sait pas, et propose la seule action qui
  // reste. Un message générique est décevant ; un message faux est pire.
  return new AppError('Une erreur est survenue. Réessayez dans un instant.', brut);
}
