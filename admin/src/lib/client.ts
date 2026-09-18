import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ConfigSupabase } from './config';
import type { BaseDonnees } from './types';

/**
 * Le client Supabase de la page d'administration.
 *
 * Il se sert de la clé publishable — publique par construction — et de la
 * session de la personne connectée. Aucune clé à privilèges n'entre ici, et
 * `lib/config.ts` refuse de construire un client si on lui en fournit une.
 *
 * CONSÉQUENCE, ET C'EST LE POINT IMPORTANT
 * ----------------------------------------
 * Cette page n'a aucun pouvoir propre. Tout ce qu'elle peut faire est décidé
 * par les politiques de `supabase/migrations/` : une personne connectée qui ne
 * figure pas dans `membres_bureau` obtient un refus, quoi qu'affiche l'écran.
 * Réécrire cette page ne changerait donc rien à ce qui est permis — c'est ce
 * qui rend une page publique acceptable.
 *
 * La session est conservée dans le stockage local du navigateur et le jeton est
 * rafraîchi automatiquement. Il n'y a pas de serveur : la page est un ensemble
 * de fichiers statiques, donc rien à héberger, rien à mettre à jour, et pas de
 * cookie de session qu'un cache intermédiaire pourrait servir à quelqu'un
 * d'autre.
 */
export type Client = SupabaseClient<BaseDonnees>;

export function creerClient(config: ConfigSupabase): Client {
  return createClient<BaseDonnees>(config.url, config.cle, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Il n'y a pas de lien de confirmation à intercepter : les comptes du
      // bureau sont créés à la main depuis le tableau de bord. Laisser cette
      // option active ferait chercher dans l'adresse un jeton qui n'y est
      // jamais, et consommerait le paramètre `code` d'une éventuelle URL.
      detectSessionInUrl: false,
    },
  });
}

/**
 * Demande à la base si la personne connectée est du bureau.
 *
 * C'est LA MÊME fonction que celle appelée par les politiques d'écriture. Ce
 * n'est pas un détail : l'écran et la base ne peuvent donc pas être en
 * désaccord. Un contrôle refait ici, en JavaScript, aurait pu diverger de la
 * règle réelle — et donner à voir un formulaire qui refuse tout, ou pire,
 * l'inverse.
 */
export async function estMembreBureau(client: Client): Promise<boolean> {
  const { data, error } = await client.rpc('est_membre_bureau');

  if (error !== null) {
    // Un échec ici n'est pas « pas membre » : c'est un problème de réseau, de
    // configuration, ou une fonction absente parce que la migration n'a pas
    // été appliquée. Confondre les deux ferait chercher un compte manquant
    // alors que la base n'est pas à jour.
    throw new Error(`La base n'a pas pu dire si ce compte est membre du bureau : ${error.message}`);
  }

  return data === true;
}
