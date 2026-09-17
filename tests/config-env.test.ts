/**
 * Tests du refus des clés à privilèges.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * Ce contrôle est la seule barrière entre une clé `service_role` et un paquet
 * distribué. Il ne produit aucun symptôme visible : si on le casse, rien ne
 * plante, aucun écran ne change, et l'application se construit exactement de la
 * même façon. Le seul moment où l'erreur se verrait est celui où quelqu'un
 * aurait déjà extrait la clé du paquet — c'est-à-dire trop tard.
 *
 * Un contrôle dont la défaillance est silencieuse doit être éprouvé par un
 * test, pas par une relecture.
 *
 * CE QUE CES TESTS NE PROUVENT PAS
 * --------------------------------
 * Ils s'exécutent sous Node, où `atob` existe pour ses propres raisons. Ils ne
 * peuvent donc pas établir que `atob` existe sur Hermes, le moteur réel du
 * téléphone. Ce point repose sur la note de version de Hermes — `atob` et
 * `btoa` y ont été ajoutés en 2024 et livrés à partir de React Native 0.74 — et
 * non sur une mesure faite ici. Autrement dit : le décodage du JWT est éprouvé
 * ici, sa disponibilité à l'exécution est seulement documentée.
 *
 * CE QUE LE TEST DU SEUIL DE LONGUEUR PROTÈGE
 * -------------------------------------------
 * La version antérieure du contrôle était :
 *
 *     anonKey.split('.').length === 3 && anonKey.length > 200
 *
 * Autrement dit : « c'est une clé à privilèges si c'est un JWT de plus de
 * 200 caractères ». Un JWT `service_role` plus court passait donc sans être
 * refusé. Le cas est éprouvé explicitement plus bas, sous le nom « court » :
 * c'est le seul test du fichier qui échouerait sur l'ancien code, et il existe
 * pour que le seuil ne revienne pas sous une autre forme.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { construire } from '@/config/env';

const ADRESSE = 'https://exemple.supabase.co';

type NomVariable =
  'EXPO_PUBLIC_SUPABASE_URL' | 'EXPO_PUBLIC_SUPABASE_ANON_KEY' | 'EXPO_PUBLIC_APP_ENV';

const VARIABLES: readonly NomVariable[] = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_APP_ENV',
];

/** Encode en base64url, la forme qu'utilisent les JWT. */
function base64url(texte: string): string {
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
 * Un test qui signerait vraiment ne prouverait rien de plus.
 */
function jeton(charge: Record<string, unknown>): string {
  const entete = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const corps = base64url(JSON.stringify(charge));
  return `${entete}.${corps}.${base64url('signature-factice')}`;
}

/** Un JWT de clé publique, tel que Supabase en émet pour `anon`. */
function jetonAnon(): string {
  return jeton({ iss: 'supabase', ref: 'exemple', role: 'anon', iat: 1_760_000_000 });
}

/** Exécute `construire()` sur un environnement choisi, puis le remet en place. */
function surEnvironnement(valeurs: Partial<Record<NomVariable, string>>, action: () => void): void {
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
    // La restauration passe par `finally` : un test qui échoue ne doit pas
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

/** Vrai si la configuration a été refusée. */
function refusee(cle: string): boolean {
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

describe('refus des clés à privilèges', () => {
  it('refuse la clé secrète au format actuel, `sb_secret_…`', () => {
    // Cette forme n'est pas un JWT. Un contrôle qui ne saurait décoder que des
    // JWT ne la verrait pas passer — or c'est la forme que Supabase met
    // aujourd'hui en avant, et sa documentation indique qu'elle contourne les
    // politiques RLS.
    assert.equal(refusee('sb_secret_AbCdEf0123456789'), true);
  });

  it('refuse un jeton d’accès personnel, `sbp_…`', () => {
    // Il ne fonctionnerait pas comme clé d'application : le refus sert ici à
    // nommer la cause, plutôt qu'à laisser échouer la première requête.
    assert.equal(refusee('sbp_AbCdEf0123456789'), true);
  });

  it('refuse un JWT dont le rôle est `service_role`', () => {
    const cle = jeton({ iss: 'supabase', ref: 'exemple', role: 'service_role' });
    assert.equal(refusee(cle), true);
  });

  it('refuse un JWT `service_role` court — le cas que l’ancien seuil laissait passer', () => {
    const cle = jeton({ role: 'service_role' });

    // Prémisse explicite : si la clé fabriquée dépassait 200 caractères, le
    // test cesserait de démontrer quoi que ce soit sur l'ancien seuil. Le
    // contrôle est donc fait ici, et non supposé.
    assert.ok(cle.length < 200, `prémisse : la clé doit rester courte (mesurée : ${cle.length})`);

    assert.equal(refusee(cle), true);
  });

  it('nomme la cause et la clé à utiliser à la place', () => {
    let message = '';

    surEnvironnement(
      { EXPO_PUBLIC_SUPABASE_URL: ADRESSE, EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_x' },
      () => {
        message = construire().configError ?? '';
      },
    );

    // Le message est ce que l'utilisateur lira à la place de l'application. Il
    // doit dire les deux choses utiles : ce qui ne va pas, et quoi mettre.
    assert.match(message, /privilèges/);
    assert.match(message, /publishable/);
  });
});

describe('clés acceptées', () => {
  it('accepte un JWT dont le rôle est `anon`', () => {
    const cle = jetonAnon();

    surEnvironnement(
      { EXPO_PUBLIC_SUPABASE_URL: ADRESSE, EXPO_PUBLIC_SUPABASE_ANON_KEY: cle },
      () => {
        const configuration = construire();
        assert.equal(configuration.configError, null);
        assert.equal(configuration.supabase?.anonKey, cle);
      },
    );
  });

  it('accepte une clé `anon` courte : aucun seuil de longueur ne doit exister', () => {
    // Un seuil de longueur ne peut que désactiver le contrôle sur des clés plus
    // courtes. La clé réelle de ce projet mesure 208 caractères : un seuil à
    // 200 n'aurait que huit caractères de marge. Le contrôle porte donc sur la
    // forme, jamais sur la taille.
    const cle = jeton({ role: 'anon' });
    assert.ok(cle.length < 200, `prémisse : la clé doit rester courte (mesurée : ${cle.length})`);

    surEnvironnement(
      { EXPO_PUBLIC_SUPABASE_URL: ADRESSE, EXPO_PUBLIC_SUPABASE_ANON_KEY: cle },
      () => {
        assert.equal(construire().configError, null);
      },
    );
  });

  it('ne refuse pas une clé illisible, et ne lève pas', () => {
    // Une clé mal recopiée ne doit pas empêcher l'application de s'ouvrir : le
    // refus est réservé aux formes dont on peut prouver qu'elles sont à
    // privilèges. Sur une clé incompréhensible, on laisse partir la requête —
    // l'erreur réseau qui suivra est visible, elle.
    assert.doesNotThrow(() => {
      surEnvironnement(
        {
          EXPO_PUBLIC_SUPABASE_URL: ADRESSE,
          EXPO_PUBLIC_SUPABASE_ANON_KEY: 'ceci.n-est-pas-un-jwt',
        },
        () => {
          assert.equal(construire().configError, null);
        },
      );
    });
  });
});

describe('contrôles voisins', () => {
  it('signale l’absence des deux variables', () => {
    surEnvironnement({}, () => {
      const configuration = construire();
      assert.equal(configuration.supabase, null);
      assert.match(configuration.configError ?? '', /pas encore reliée/);
    });
  });

  it('signale une adresse mal formée, sans laisser passer une barre oblique finale', () => {
    surEnvironnement(
      {
        EXPO_PUBLIC_SUPABASE_URL: `${ADRESSE}/`,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: jetonAnon(),
      },
      () => {
        const configuration = construire();
        assert.equal(configuration.supabase, null);
        assert.match(configuration.configError ?? '', /forme attendue/);
      },
    );
  });
});
