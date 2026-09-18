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
 * CE QUE CE FICHIER NE FAIT PLUS, ET OÙ C'EST ALLÉ
 * ------------------------------------------------
 * La mécanique d'environnement — poser les variables, appeler `construire()`,
 * restaurer même en cas d'échec — vit désormais dans `tests/aide/environnement.ts`,
 * parce qu'un second banc en a besoin : `cles-refusees.test.ts` confronte ce
 * refus à celui de la page d'administration. Les témoins, eux, restent ici :
 * c'est ce banc qui éprouve le refus de l'application pour lui-même, l'autre
 * n'éprouvant que l'accord entre les deux listes.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { construire } from '@/config/env';

import { ADRESSE, jeton, refuseeParLApplication, surEnvironnement } from './aide/environnement.ts';

/** Un JWT de clé publique, tel que Supabase en émet pour `anon`. */
function jetonAnon(): string {
  return jeton({ iss: 'supabase', ref: 'exemple', role: 'anon', iat: 1_760_000_000 });
}

describe('refus des clés à privilèges', () => {
  it('refuse la clé secrète au format actuel, `sb_secret_…`', () => {
    // Cette forme n'est pas un JWT. Un contrôle qui ne saurait décoder que des
    // JWT ne la verrait pas passer — or c'est la forme que Supabase met
    // aujourd'hui en avant, et sa documentation indique qu'elle contourne les
    // politiques RLS.
    assert.equal(refuseeParLApplication('sb_secret_AbCdEf0123456789'), true);
  });

  it('refuse un jeton d’accès personnel, `sbp_…`', () => {
    // Il ne fonctionnerait pas comme clé d'application : le refus sert ici à
    // nommer la cause, plutôt qu'à laisser échouer la première requête.
    assert.equal(refuseeParLApplication('sbp_AbCdEf0123456789'), true);
  });

  it('refuse un JWT dont le rôle est `service_role`', () => {
    const cle = jeton({ iss: 'supabase', ref: 'exemple', role: 'service_role' });
    assert.equal(refuseeParLApplication(cle), true);
  });

  it('refuse un JWT `service_role` court — le cas que l’ancien seuil laissait passer', () => {
    const cle = jeton({ role: 'service_role' });

    // Prémisse explicite : si la clé fabriquée dépassait 200 caractères, le
    // test cesserait de démontrer quoi que ce soit sur l'ancien seuil. Le
    // contrôle est donc fait ici, et non supposé.
    assert.ok(cle.length < 200, `prémisse : la clé doit rester courte (mesurée : ${cle.length})`);

    assert.equal(refuseeParLApplication(cle), true);
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
  it('accepte la clé publique au format actuel, `sb_publishable_…`', () => {
    // Le miroir des tests de refus, et le plus important des tests
    // d'acceptation : `sb_publishable_…` et `sb_secret_…` partagent le préfixe
    // `sb_`. Un « refusons tout ce qui commence par sb_ » — la simplification
    // qu'on écrirait sans réfléchir — passerait tous les tests de refus et
    // rendrait l'application inutilisable, avec pour seul symptôme une erreur
    // de configuration à l'ouverture.
    //
    // La clé publishable est bien celle qu'il faut ici : elle porte le rôle
    // `anon` tant qu'aucun utilisateur n'est connecté, et cette application
    // n'en connecte aucun.
    const cle = 'sb_publishable_AbCdEf0123456789';

    surEnvironnement(
      { EXPO_PUBLIC_SUPABASE_URL: ADRESSE, EXPO_PUBLIC_SUPABASE_ANON_KEY: cle },
      () => {
        const configuration = construire();
        assert.equal(configuration.configError, null);
        assert.equal(configuration.supabase?.anonKey, cle);
      },
    );
  });

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
