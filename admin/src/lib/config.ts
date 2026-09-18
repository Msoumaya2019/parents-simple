import { cleInterdite } from './cle';

/**
 * Lecture de la configuration, et messages d'erreur qui disent quoi faire.
 *
 * POURQUOI CE FICHIER EXISTE SÉPARÉMENT
 * -------------------------------------
 * La fonction de construction est exportée et prend ses valeurs en paramètre,
 * exactement comme `construire()` dans `src/config/env.ts`. C'est la seule
 * façon d'éprouver le refus d'une clé à privilèges : lue directement depuis
 * `import.meta.env`, la configuration serait figée au chargement du module, et
 * aucun test ne pourrait la faire varier sans recharger le module entier.
 *
 * Une erreur de configuration ne doit pas produire un écran blanc. Elle doit
 * produire une phrase compréhensible par la personne qui déploie — qui, très
 * souvent, n'est pas celle qui a écrit ce code.
 */

/** Les variables telles que Vite les expose. `VITE_` est obligatoire : seules les variables ainsi préfixées sont insérées dans la page. */
export interface VariablesAdmin {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

export interface ConfigSupabase {
  readonly url: string;
  readonly cle: string;
}

export interface ConfigLue {
  readonly supabase: ConfigSupabase | null;
  /** Explication en français, affichée à l'écran. `null` si tout va bien. */
  readonly erreur: string | null;
}

function nettoyer(valeur: string | undefined): string | null {
  const propre = typeof valeur === 'string' ? valeur.trim() : '';
  return propre === '' ? null : propre;
}

export function construire(variables: VariablesAdmin): ConfigLue {
  const url = nettoyer(variables.VITE_SUPABASE_URL);
  const cle = nettoyer(variables.VITE_SUPABASE_PUBLISHABLE_KEY);

  if (url === null && cle === null) {
    return Object.freeze({
      supabase: null,
      erreur:
        "Cette page n'est pas encore reliée à sa base de données. Les variables " +
        'VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY sont absentes. ' +
        'Voir la section « Déployer » de docs/05-administration.md.',
    });
  }

  if (url === null) {
    return Object.freeze({
      supabase: null,
      erreur:
        "L'adresse de la base de données est absente. Renseignez VITE_SUPABASE_URL " +
        '(elle ressemble à https://xxxxx.supabase.co).',
    });
  }

  if (cle === null) {
    return Object.freeze({
      supabase: null,
      erreur:
        'La clé publique de la base de données est absente. Renseignez ' +
        'VITE_SUPABASE_PUBLISHABLE_KEY — la clé « publishable » (anciennement « anon ») ' +
        'du tableau de bord, dans Settings → API Keys.',
    });
  }

  // Contrôle de forme, pas de validité : une adresse mal recopiée — une barre
  // oblique finale, un espace — produit sinon une erreur réseau obscure au
  // premier chargement, difficile à relier à sa cause.
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(url)) {
    return Object.freeze({
      supabase: null,
      erreur:
        "L'adresse de la base de données n'a pas la forme attendue. Elle doit " +
        'ressembler à https://xxxxx.supabase.co, sans barre oblique finale.',
    });
  }

  // Refus, et non avertissement. Une clé à privilèges dans cette page
  // contournerait toutes les politiques RLS : elle ouvrirait la lecture des
  // messages adressés au bureau, et l'écriture de tout le contenu publié.
  if (cleInterdite(cle)) {
    return Object.freeze({
      supabase: null,
      erreur:
        'La valeur fournie est une clé à privilèges : elle donne tous les droits et ' +
        'contourne les politiques de sécurité. Elle ne doit jamais être placée ici. ' +
        'Utilisez la clé « publishable » (ou « anon ») : sa portée est entièrement ' +
        'définie par les politiques de la base, et c’est la liste des membres du ' +
        'bureau qui décide qui peut publier.',
    });
  }

  return Object.freeze({
    supabase: Object.freeze({ url, cle }),
    erreur: null,
  });
}
