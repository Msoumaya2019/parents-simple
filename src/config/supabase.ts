/**
 * Client Supabase.
 *
 * Un seul client, créé une fois, partagé par tous les services. En créer un par
 * écran multiplierait les connexions sans rien apporter.
 *
 * PAS DE SESSION, ET C'EST VOULU
 * ------------------------------
 * L'application n'a pas de compte : il n'y a donc rien à persister, rien à
 * rafraîchir, et aucune expiration de jeton à gérer. `persistSession: false`
 * et `autoRefreshToken: false` suppriment tout un pan de code qui n'aurait
 * aucune raison d'exister ici — et qui, mal écrit, est une source classique de
 * déconnexions inexpliquées.
 *
 * `detectSessionInUrl` est désactivé pour la même raison : cette option sert au
 * retour d'un fournisseur d'identité dans un navigateur, ce qui n'arrive jamais
 * dans une application native.
 */

import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { appConfig } from '@/config/env';

/**
 * `null` lorsque la configuration est incomplète.
 *
 * Les services refusent alors de s'exécuter et rendent une erreur explicite,
 * plutôt que de laisser une exception remonter depuis la bibliothèque avec un
 * message en anglais, sans rapport avec la cause réelle.
 */
export const supabase: SupabaseClient | null =
  appConfig.supabase === null
    ? null
    : createClient(appConfig.supabase.url, appConfig.supabase.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            // Identifie l'application dans les journaux du tableau de bord
            // Supabase. Sans cela, toutes les requêtes se ressemblent, et
            // distinguer un pic d'usage normal d'un abus devient difficile.
            'x-application-name': 'freres-lumieres-parents',
          },
        },
      });
