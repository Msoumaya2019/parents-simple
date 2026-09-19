/**
 * Messages adressés au bureau.
 *
 * L'envoi passe par la fonction `envoyer_message()` et non par une insertion
 * directe. La table `messages` est fermée à la clé publique : c'est ce qui
 * garantit qu'aucun parent ne peut lire les messages des autres. La fonction,
 * elle, applique la cadence d'envoi — trois messages par quart d'heure et par
 * appareil — règle qu'un client modifié ne peut pas contourner puisqu'elle vit
 * dans la base.
 *
 * L'application ne peut donc ni lire ni écrire cette table directement, et
 * c'est exactement l'objectif.
 */

import type { NouveauMessage } from '@/types/models';
import { identifiantAppareil } from '@/lib/identifiants';
import { client, executer } from '@/services/client';

//  Les catégories et leurs libellés vivent dans `src/lib/categories-message.ts`,
//  un module qui n'importe rien à l'exécution — donc éprouvable par un banc. Ce
//  fichier-ci ne l'est pas : il importe le client Supabase et `expo-crypto`.
//  Ils sont réexportés pour que les appelants n'aient pas à connaître ce
//  déplacement.
export { CATEGORIES_MESSAGE, libelleCategorieMessage } from '@/lib/categories-message';

/**
 * Envoie un message, et rend son identifiant.
 *
 * L'identifiant n'est pas affiché : il sert uniquement à confirmer que
 * l'enregistrement a bien eu lieu. La fonction de la base lève une erreur
 * explicite si la cadence est dépassée, erreur traduite par `traduireErreur`.
 */
export async function envoyerMessage(message: NouveauMessage): Promise<string> {
  const appareil = await identifiantAppareil();

  return executer<string>(
    client().rpc('envoyer_message', {
      p_sujet: message.sujet.trim(),
      p_corps: message.corps.trim(),
      p_categorie: message.categorie,
      p_reponse_a: message.reponseA === null ? null : message.reponseA.trim(),
      p_appareil_id: appareil,
    }),
  );
}
