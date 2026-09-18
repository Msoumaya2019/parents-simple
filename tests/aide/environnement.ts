/**
 * L'outillage commun aux bancs qui éprouvent la configuration.
 *
 * POURQUOI CE FICHIER
 * -------------------
 * Deux bancs éprouvent le même refus — celui des clés à privilèges — depuis
 * deux côtés : `config-env.test.ts` pour l'application mobile, et
 * `cles-refusees.test.ts` pour la page d'administration. Les deux ont besoin de
 * la même mécanique : poser des variables d'environnement, appeler
 * `construire()`, puis remettre l'environnement en place — y compris quand le
 * banc échoue.
 *
 * Ce qui est partagé ici n'est PAS la valeur éprouvée : chaque banc garde ses
 * propres témoins, et c'est le principe même du second. C'est l'outillage. Une
 * restauration oubliée dans une copie laisserait un banc polluer les suivants,
 * et le symptôme apparaîtrait dans un fichier qui n'a rien à voir.
 *
 * Ce fichier n'est pas un banc : son nom ne finit pas par `.test.ts`, donc
 * `node --test` ne le ramasse pas.
 */

import { construire } from '@/config/env';

export const ADRESSE = 'https://exemple.supabase.co';

export type NomVariable =
  'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY' | 'EXPO_PUBLIC_APP_ENV';

export const VARIABLES: readonly NomVariable[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_APP_ENV',
];

/** Encode en base64url, la forme qu'utilisent les JWT. */
export function base64url(texte: string): string {
  return Buffer.from(texte, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Fabrique un JWT de la forme réelle, avec la charge utile demandée.
 *
 * La signature n'est pas valide — et c'est sans importance : le contrôle ne
 * vérifie pas les signatures, il lit le champ `role` pour produire un message.
 * Un banc qui signerait vraiment ne prouverait rien de plus.
 */
export function jeton(charge: Record<string, unknown>): string {
  const entete = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corps = base64url(JSON.stringify(charge));
  return `${entete}.${corps}.${base64url('signature-factice')}`;
}

/** Exécute `action` sur un environnement choisi, puis le remet en place. */
export function surEnvironnement(
  valeurs: Partial<Record<NomVariable, string>>,
  action: () => void,
): void {
  const sauvegarde = VARIABLES.map((nom) => [nom, process.env[nom]] as const);

  try {
    for (const nom of VARIABLES) {
      const valeur = valeurs[nom];
      if (valeur === undefined) {
        delete process.env[nom];
      } else {
        process.env[nom] = valeur;
      }
    }

    action();
  } finally {
    // La restauration passe par `finally` : un banc qui échoue ne doit pas
    // laisser derrière lui un environnement modifié pour les suivants.
    for (const [nom, valeur] of sauvegarde) {
      if (valeur === undefined) {
        delete process.env[nom];
      } else {
        process.env[nom] = valeur;
      }
    }
  }
}

/**
 * Vrai si l'APPLICATION refuse cette clé, observé par son comportement.
 *
 * Le refus passe par `construire()`, et non par la fonction interne : c'est la
 * seule voie possible, `cleInterdite` n'étant pas exportée côté application —
 * et c'est aussi la bonne, puisqu'elle mesure ce que l'utilisateur verrait.
 *
 * L'adresse est valide et la clé n'est jamais vide, de sorte que le seul motif
 * de refus possible soit la clé elle-même.
 */
export function refuseeParLApplication(cle: string): boolean {
  let refus = false;

  surEnvironnement(
    { EXPO_PUBLIC_SUPABASE_URL: ADRESSE, EXPO_PUBLIC_SUPABASE_ANON_KEY: cle },
    () => {
      const configuration = construire();
      refus = configuration.supabase === null && configuration.configError !== null;
    },
  );

  return refus;
}
