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

/**
 * Construit la configuration à partir de l'environnement courant.
 *
 * Exportée pour que les tests puissent l'appeler avec des variables
 * d'environnement choisies. C'est la seule façon d'éprouver le refus des clés à
 * privilèges : `appConfig`, en bas de ce fichier, n'est que le résultat pour
 * l'environnement réel, calculé une fois au chargement du module — un test ne
 * peut pas le faire varier sans recharger le module entier.
 */
export function construire(): AppConfig {
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
      // Le message ne dit plus « elle commence par eyJ ». Supabase déprécie les
      // clés JWT pour la fin de 2026 et met en avant `sb_publishable_…`, qui
      // n'en est pas un : la documentation officielle avertit elle-même que
      // « si un outil, un tutoriel ou un assistant vous dit de copier une
      // longue clé commençant par eyJ, c'est qu'il a été écrit pour les clés
      // historiques ». Décrire une forme qui n'est plus celle du tableau de
      // bord enverrait chercher une clé qui ne s'y trouve plus.
      configError:
        'La clé publique de la base de données est absente. Renseignez ' +
        'EXPO_PUBLIC_SUPABASE_ANON_KEY — la clé « publishable » (anciennement ' +
        '« anon ») du tableau de bord. Voir la section « Configuration » du README.',
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

  // Refus, et non avertissement : laisser démarrer l'application avec une clé
  // à privilèges reviendrait à publier l'ensemble des messages adressés au
  // bureau, et personne ne s'en apercevrait avant de les lire.
  if (cleInterdite(anonKey)) {
    return Object.freeze({
      appEnv,
      supabase: null,
      configError:
        'La valeur fournie est une clé à privilèges : elle donne tous les droits et ' +
        'contourne les politiques de sécurité. Elle ne doit jamais être placée dans ' +
        'une application distribuée. Utilisez la clé « publishable » (ou « anon »), ' +
        'dont la portée est entièrement définie par les politiques RLS.',
    });
  }

  return Object.freeze({
    appEnv,
    supabase: Object.freeze({ url, anonKey }),
    configError: null,
  });
}

/**
 * Vrai si cette valeur ne doit jamais être embarquée dans l'application.
 *
 * TROIS FORMES SONT REFUSÉES, ET LA PREMIÈRE EST LA PLUS RÉCENTE
 * --------------------------------------------------------------
 * Supabase déprécie `anon` et `service_role` à la fin de 2026 et les remplace
 * par `sb_publishable_…` et `sb_secret_…`. La clé secrète **n'est pas un JWT** :
 * un contrôle qui ne saurait décoder que des JWT ne la verrait pas passer, et
 * l'application embarquerait une clé qui contourne toutes les politiques RLS —
 * exactement ce que ce garde-fou existe pour empêcher.
 *
 *   - `sb_secret_…` — la clé secrète actuelle, qui contourne la RLS ;
 *   - un JWT dont la charge utile porte `role: service_role` — la forme
 *     historique de la même clé ;
 *   - `sbp_…` — un jeton d'accès personnel à l'API de gestion. Il ne
 *     fonctionnerait pas comme clé d'application, mais l'échec serait un refus
 *     obscur au premier chargement plutôt qu'une phrase qui nomme la cause.
 */
function cleInterdite(valeur: string): boolean {
  if (/^sb_secret_/i.test(valeur) || /^sbp_/i.test(valeur)) {
    return true;
  }

  // Aucune condition de longueur ici. La clé réelle de ce projet mesure 208
  // caractères : un seuil à 200 n'aurait que huit caractères de marge, et son
  // seul effet possible serait de désactiver le contrôle sur une clé un peu
  // plus courte — un garde-fou qui s'éteint tout seul ne garde rien.
  return decoderChargeUtile(valeur)?.role === 'service_role';
}

/**
 * Décode la charge utile d'un JWT, sans vérifier sa signature.
 *
 * Utile uniquement pour lire le champ `role` et refuser une clé à privilèges.
 * Le résultat n'a aucune valeur d'authentification : il ne sert qu'à produire
 * un message d'erreur. Rend `null` pour tout ce qui n'est pas un JWT — une clé
 * `sb_secret_…`, par exemple, dont le découpage ne donne qu'un seul morceau.
 */
function decoderChargeUtile(jeton: string): { role?: string } | null {
  const parties = jeton.split('.');
  const charge = parties[1];
  if (charge === undefined) {
    return null;
  }

  try {
    // `atob` existe bien ici : Hermes l'implémente depuis React Native 0.74
    // (ticket `facebook/hermes#1178`, implémenté en 2024), et ce projet ne
    // demande pas JSC — `app.json` ne fixe aucun `jsEngine`. Un commentaire
    // antérieur affirmait l'inverse ; il était faux.
    //
    // Mais attention à ne pas lire ce typage comme une preuve : si TypeScript
    // accepte `globalThis.atob`, c'est uniquement parce que `tsconfig.json`
    // déclare `types: ["node"]`. C'est `@types/node` qui fournit la
    // déclaration, et il décrit Node, pas Hermes. Le typage ne dit donc rien
    // de la disponibilité réelle sur le téléphone.
    //
    // La normalisation qui suit reste nécessaire dans tous les cas : `atob`
    // n'accepte ni `-`/`_` (base64url) ni l'absence de remplissage.
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
