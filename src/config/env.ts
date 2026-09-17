/**
 * Configuration de l'application.
 *
 * Toute la configuration passe par ce fichier. Les valeurs viennent de
 * variables `EXPO_PUBLIC_*`, que l'outil de compilation **insère en clair dans
 * le paquet**. Ce n'est pas une négligence : la clé `anon` de Supabase est
 * publique par construction, et sa portée est entièrement définie par les
 * politiques RLS de `supabase/migrations/`. La clé `service_role`, elle, ne
 * doit JAMAIS apparaître ici — elle contourne la RLS et donnerait à quiconque
 * extrait le paquet le droit d'écrire et de lire l'ensemble des messages.
 *
 * POURQUOI CE FICHIER EST AUSSI VERBEUX
 * -------------------------------------
 * Une clé absente ne doit pas produire un écran blanc ni un plantage au
 * démarrage. Elle doit produire une phrase compréhensible. C'est ce que fait
 * `configError` : l'application s'ouvre, et explique ce qui manque.
 *
 * Ce choix a une seconde conséquence, et c'est la plus utile : l'intégration
 * continue peut compiler le paquet sans aucun secret configuré. Un dépôt public
 * n'a donc jamais besoin de stocker une clé Supabase pour vérifier que le code
 * se construit.
 */

export type AppEnv = 'development' | 'preview' | 'production';

export interface SupabaseConfig {
  readonly url: string;
  readonly anonKey: string;
}

export interface AppConfig {
  readonly appEnv: AppEnv;
  /** `null` quand la configuration est absente ou refusée. */
  readonly supabase: SupabaseConfig | null;
  /** Explication en français, affichée à l'écran. `null` si tout va bien. */
  readonly configError: string | null;
}

function lireEnv(nom: string): string | null {
  // `process.env` est remplacé statiquement à la compilation : l'accès doit
  // être littéral. `process.env[nom]` ne serait pas remplacé du tout, et
  // renverrait toujours `undefined` dans un paquet de production.
  const brut =
    nom === 'EXPO_PUBLIC_SUPABASE_URL'
      ? process.env.EXPO_PUBLIC_SUPABASE_URL
      : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const valeur = typeof brut === 'string' ? brut.trim() : '';
  return valeur === '' ? null : valeur;
}

function lireAppEnv(): AppEnv {
  const brut = process.env.EXPO_PUBLIC_APP_ENV;
  if (brut === 'production' || brut === 'preview') {
    return brut;
  }
  return 'development';
}

function construire(): AppConfig {
  const appEnv = lireAppEnv();
  const url = lireEnv('EXPO_PUBLIC_SUPABASE_URL');
  const anonKey = lireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (url === null && anonKey === null) {
    return Object.freeze({
      appEnv,
      supabase: null,
      configError:
        "L'application n'est pas encore reliée à sa base de données. Les variables " +
        'EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY sont absentes. ' +
        'Voir la section « Configuration » du README.',
    });
  }

  if (url === null) {
    return Object.freeze({
      appEnv,
      supabase: null,
      configError:
        "L'adresse de la base de données est absente. Renseignez " +
        'EXPO_PUBLIC_SUPABASE_URL (elle ressemble à https://xxxxx.supabase.co).',
    });
  }

  if (anonKey === null) {
    return Object.freeze({
      appEnv,
      supabase: null,
      configError:
        'La clé publique de la base de données est absente. Renseignez ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY (elle commence par « eyJ »).',
    });
  }

  // Contrôle de forme, pas de validité : une adresse mal recopiée — un `/`
  // final, un espace — produit sinon une erreur réseau obscure au premier
  // chargement, difficile à relier à sa cause.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return Object.freeze({
      appEnv,
      supabase: null,
      configError:
        "L'adresse de la base de données n'a pas la forme attendue. Elle doit " +
        'ressembler à https://xxxxx.supabase.co, sans barre oblique finale.',
    });
  }

  // Avertissement de sécurité, et non erreur bloquante : le démarrage se
  // poursuit, mais l'application ne doit jamais embarquer cette clé.
  if (anonKey.split('.').length === 3 && anonKey.length > 200) {
    // Une clé `service_role` est un JWT de même forme que la clé `anon`. On ne
    // peut pas les distinguer de façon fiable sans décoder la charge utile, ce
    // que fait le contrôle ci-dessous.
    const charge = decoderChargeUtile(anonKey);
    if (charge?.role === 'service_role') {
      return Object.freeze({
        appEnv,
        supabase: null,
        configError:
          'La clé fournie est une clé « service_role », qui donne tous les droits ' +
          'et ne doit jamais être placée dans une application distribuée. ' +
          'Utilisez la clé « anon », protégée par les politiques RLS.',
      });
    }
  }

  return Object.freeze({
    appEnv,
    supabase: Object.freeze({ url, anonKey }),
    configError: null,
  });
}

/**
 * Décode la charge utile d'un JWT, sans vérifier sa signature.
 *
 * Utile uniquement pour lire le champ `role` et refuser une clé à privilèges.
 * Le résultat n'a aucune valeur d'authentification : il ne sert qu'à produire
 * un message d'erreur.
 */
function decoderChargeUtile(jeton: string): { role?: string } | null {
  const parties = jeton.split('.');
  const charge = parties[1];
  if (charge === undefined) {
    return null;
  }

  try {
    // `atob` n'est pas disponible partout sous React Native ; `Buffer` non
    // plus. On décode donc à la main, ce qui est court et sans dépendance.
    const base64 = charge.replace(/-/g, '+').replace(/_/g, '/');
    const complete = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binaire = globalThis.atob(complete);
    const texte = decodeURIComponent(
      Array.from(binaire)
        .map((caractere) => `%${caractere.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(texte) as { role?: string };
  } catch {
    return null;
  }
}

export const appConfig: AppConfig = construire();
