/**
 * Accès à la base.
 *
 * Un seul point de sortie vers Supabase, pour trois raisons :
 *
 *   - quand la configuration est absente, l'erreur est explicite et en
 *     français. Sans ce garde-fou, l'appel suivant lève une exception venue de
 *     la bibliothèque, en anglais, sans rapport visible avec la cause ;
 *   - les colonnes de la base sont converties une fois pour toutes vers les
 *     modèles de l'application. Les écrans ne voient jamais un `publiee_le` ;
 *   - une erreur de la base est traduite ici, à un seul endroit, plutôt que
 *     dans chaque écran.
 */

import { supabase } from '@/config/supabase';
import { AppError, traduireErreur } from '@/errors';

/** Le client, ou une erreur explicite. */
export function client(): NonNullable<typeof supabase> {
  if (supabase === null) {
    throw new AppError(
      "L'application n'est pas reliée à sa base de données. Vérifiez la configuration, " +
        'puis relancez-la.',
    );
  }
  return supabase;
}

/**
 * Exécute une requête Supabase et convertit toute erreur en `AppError`.
 *
 * Supabase ne lève pas d'exception : il renvoie `{ data, error }`. Oublier de
 * lire `error` est l'erreur la plus fréquente avec cette bibliothèque — le code
 * continue avec `data` à `null` et l'écran affiche « aucune donnée » alors que
 * la requête a échoué. On centralise donc la lecture ici.
 */
export async function executer<T>(
  requete: PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await requete;

  if (error !== null) {
    throw traduireErreur(error.message);
  }

  if (data === null) {
    throw new AppError('La base de données a répondu sans contenu. Réessayez dans un instant.');
  }

  return data as T;
}
