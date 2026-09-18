/**
 * Ce qu'un appareil retient après la réponse de la base, quand il vote.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `voter()` en base ne lève pas d'erreur quand un appareil vote une seconde
 * fois : `on conflict (sondage_id, votant_id) do nothing` puis `v_insere :=
 * found` font qu'elle rend `false`, sans rien changer à la ligne déjà présente.
 * C'est délibéré — `docs/03-securite-et-donnees.md` le dit : « Ignore un second
 * vote du même appareil plutôt que d'échouer ».
 *
 * Or l'écran jetait cette réponse :
 *
 *     await voterEnBase(sondageId, choixId);
 *     await enregistrerVote(sondageId, choixId);
 *
 * Le choix touché était donc retenu et mis en avant quoi qu'il arrive, avec la
 * phrase « Votre réponse est enregistrée. » — alors que la base gardait l'ancien
 * vote, et que le décompte affiché, lui, venait bien de la base. Le parcours
 * n'avait rien d'exceptionnel : un parent qui a voté A, puis touche B, voyait B
 * marqué comme enregistré, et le pourcentage de B ne comptait pas son vote.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La partie 1 emploie la vraie règle de `@/lib/votes-locaux` : un refus ne rend
 * jamais le choix touché, et il laisse une trace distincte d'un identifiant de
 * choix.
 *
 * La partie 2 relit les sources privées de leurs commentaires. C'est nécessaire
 * et pas seulement commode : les commentaires de ces fichiers parlent de
 * `voteARetenir` et de `voterEnBase`, et un contrôle qui chercherait un nom sans
 * retirer les commentaires serait satisfait par une phrase — c'est-à-dire par
 * rien. Un banc ne peut pas rendre `SondageCard.tsx` ni `plus.tsx`, qui
 * importent React Native : il lit donc la forme des appels, comme
 * `tests/diagnostic.test.ts` et `tests/agenda-separation.test.ts`.
 *
 * La partie 3 tient le lecteur de la mémoire locale : il doit garder toute
 * chaîne, sans quoi la marque d'un vote sans choix serait écartée en silence et
 * le parent pourrait appuyer indéfiniment.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la base réponde, ni qu'elle rende `false`. Il tient ce que l'application
 * fait de la réponse, pas la réponse. Le chemin de succès de `voter()` n'est
 * couvert par aucun contrôle automatique — il demande une écriture — et c'est
 * `supabase/exemple-contenu.sql`, avec son sondage ouvert, qui l'éprouve à la
 * main.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { CHOIX_INCONNU, voteARetenir, voteSansChoix } from '@/lib/votes-locaux';

const RACINE = process.cwd();
const MODULE = join(RACINE, 'src', 'lib', 'votes-locaux.ts');
const ECRAN = join(RACINE, 'app', '(tabs)', 'plus.tsx');
const CARTE = join(RACINE, 'src', 'components', 'SondageCard.tsx');

/**
 * Des identifiants de choix, de la forme que la base produit.
 *
 * Le corpus sert à vérifier que la marque d'un vote sans choix ne peut pas être
 * confondue avec un choix réel : elle doit être reconnaissable parmi eux.
 */
const CHOIX: readonly string[] = [
  '2f1c9a54-0b6e-4f1a-9d3c-7a5e8b2f0c14',
  '8d4b7e02-5c19-4a83-b0f6-1e9d3a7c5b28',
  'c05a3f81-9e27-4d6b-8a41-2f7b9c0e6d53',
];

/** Le source privé de ses commentaires, avant toute recherche de motif. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function lire(chemin: string): string {
  return sansCommentaires(readFileSync(chemin, 'utf8'));
}

const SOURCE_MODULE = lire(MODULE);
const SOURCE_ECRAN = lire(ECRAN);
const SOURCE_CARTE = lire(CARTE);

describe('voteARetenir — la réponse de la base décide', () => {
  for (const choix of CHOIX) {
    it(`retient le choix touché quand la base l'a enregistré (${choix.slice(0, 8)}…)`, () => {
      assert.equal(voteARetenir(choix, true), choix);
    });

    it(`ne retient jamais le choix touché quand la base refuse (${choix.slice(0, 8)}…)`, () => {
      const retenu = voteARetenir(choix, false);

      assert.notEqual(
        retenu,
        choix,
        'un refus de la base ne peut pas devenir un vote enregistré à l’écran',
      );
      assert.equal(retenu, CHOIX_INCONNU);
      assert.ok(
        voteSansChoix(retenu),
        'le refus doit laisser une trace reconnaissable, sans quoi l’écran ne peut rien dire',
      );
    });
  }

  it('rend toujours quelque chose : après une réponse de la base, on sait', () => {
    for (const choix of CHOIX) {
      for (const enregistre of [true, false]) {
        const retenu = voteARetenir(choix, enregistre);
        assert.equal(typeof retenu, 'string');
        assert.notEqual(retenu, null);
        assert.notEqual(retenu, undefined);
      }
    }
  });
});

describe('voteSansChoix — distinguer « a voté » de « on ne sait rien »', () => {
  it('reconnaît la marque du vote sans choix', () => {
    assert.equal(voteSansChoix(CHOIX_INCONNU), true);
    assert.equal(voteSansChoix(voteARetenir(CHOIX[0]!, false)), true);
  });

  it('ne confond ni un choix connu ni l’absence de mémoire', () => {
    for (const choix of CHOIX) {
      assert.equal(
        voteSansChoix(choix),
        false,
        `${choix.slice(0, 8)}… est un choix, pas une marque`,
      );
    }
    assert.equal(voteSansChoix(null), false);
  });
});

describe('La marque d’un vote sans choix ne peut pas être prise pour un choix', () => {
  it('n’a pas la forme d’un identifiant', () => {
    const formeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    assert.equal(
      formeUuid.test(CHOIX_INCONNU),
      false,
      'la marque doit rester hors de la forme des identifiants de choix',
    );
    for (const choix of CHOIX) {
      assert.ok(formeUuid.test(choix), 'le corpus doit bien porter des identifiants');
      assert.notEqual(choix, CHOIX_INCONNU);
    }
  });
});

describe('L’écran lit la réponse de la base', () => {
  it('lie le résultat de voterEnBase au lieu de le laisser tomber', () => {
    const appel = /const\s+(\w+)\s*=\s*await\s+voterEnBase\s*\(/.exec(SOURCE_ECRAN);

    assert.ok(
      appel !== null,
      'plus.tsx doit retenir la réponse de voterEnBase : un appel sans affectation la jette, ' +
        'et c’est précisément ce qui faisait afficher un vote non enregistré.',
    );

    const nom = appel[1]!;
    assert.match(
      SOURCE_ECRAN,
      new RegExp(`voteARetenir\\s*\\(\\s*\\w+\\s*,\\s*${nom}\\s*\\)`),
      `la réponse « ${nom} » doit être passée à voteARetenir, et non seulement reçue`,
    );
  });

  it('n’écrit plus le choix touché dans la mémoire locale', () => {
    assert.doesNotMatch(
      SOURCE_ECRAN,
      /enregistrerVote\s*\(\s*sondageId\s*,\s*choixId\s*\)/,
      'écrire le choix touché sans consulter la base est exactement le défaut que ce banc tient',
    );
    assert.match(SOURCE_ECRAN, /enregistrerVote\s*\(\s*sondageId\s*,\s*retenu\s*\)/);
  });
});

describe('La carte ne propose pas un vote que la base ignorerait', () => {
  it('désactive les choix dès qu’un vote est connu', () => {
    const drapeau = /const\s+inactif\s*=\s*([^;]*);/.exec(SOURCE_CARTE);

    assert.ok(
      drapeau !== null,
      'SondageCard doit nommer une fois la condition d’inactivité, et non la répéter',
    );
    assert.match(
      drapeau[1]!,
      /\baVote\b/,
      'la condition d’inactivité doit tenir compte du vote déjà déposé',
    );
    assert.match(
      SOURCE_CARTE,
      /desactive=\{inactif\}/,
      'les lignes de choix doivent employer cette condition, sinon elle ne désactive rien',
    );
  });

  it('applique la même condition dans le garde-fou de l’appui', () => {
    assert.match(
      SOURCE_CARTE,
      /if\s*\(\s*inactif\s*\)\s*\{\s*return;/,
      'un appui ne doit pas partir là où l’écran l’interdit',
    );
  });

  it('dit ce qu’elle sait, et pas plus', () => {
    assert.match(SOURCE_CARTE, /Votre réponse est enregistrée\./, 'le choix connu se dit');
    assert.match(
      SOURCE_CARTE,
      /Un vote a déjà été enregistré depuis cet appareil\./,
      'le vote sans choix connu doit se dire aussi, sinon l’écran ne montre rien et se tait',
    );
    assert.match(SOURCE_CARTE, /\{mentionVote\}/, 'la mention doit être employée sous le décompte');
  });
});

describe('Le lecteur de la mémoire locale garde la marque', () => {
  it('n’écarte pas une valeur qui n’est pas un identifiant', () => {
    assert.match(
      SOURCE_MODULE,
      /typeof valeur === 'string'/,
      'le lecteur doit garder toute chaîne, marque comprise',
    );
    assert.doesNotMatch(
      SOURCE_MODULE,
      /FORME_UUID/,
      'un lecteur qui exigerait la forme d’un identifiant écarterait la marque en silence',
    );
  });
});
