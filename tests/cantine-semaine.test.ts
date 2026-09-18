/**
 * La semaine que l'écran de la cantine ouvre.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * L'en-tête justifie la maille hebdomadaire par une question précise : « un
 * parent consulte la cantine pour répondre à une question précise : “qu'est-ce
 * qu'il mange demain ?” […] La semaine est la décision qu'on prend en préparant
 * les affaires du lendemain. »
 *
 * L'écran ouvrait sur `lundiDeLaSemaine(new Date())`. Mesuré sur les sept jours
 * d'une semaine, cela laisse « demain » hors de la semaine affichée **le
 * dimanche** — le seul jour dont le lendemain quitte la semaine. Ce jour-là, six
 * des sept cartes étaient déjà atténuées, et la semaine que le parent venait
 * préparer se trouvait derrière la flèche « suivante », sans que rien ne le dise.
 *
 * La règle vit dans `src/utils/date.ts` (`semaineDeCantine`) : un banc ne peut
 * pas charger `app/(tabs)/cantine.tsx`, qui importe React Native. Même raison et
 * même mesure que `chargement.ts`, `responsable.ts`, `adresse-reponse.ts` et
 * `diagnostic.ts`.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La partie 1 interroge la règle sur les quatorze jours de deux semaines
 * consécutives, et exige la propriété qui porte la promesse : **« demain » est
 * dans la semaine ouverte, tous les jours**. Elle exige aussi que la semaine
 * ouverte contienne aujourd'hui les six autres jours, et qu'elle n'avance que
 * d'une semaine le dimanche — sans quoi « la semaine dernière » ne serait plus
 * la bonne.
 *
 * La partie 2 lit la source de l'écran : il n'ouvre plus sur
 * `lundiDeLaSemaine(new Date())`.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Ce que la base rend pour la semaine demandée. Il établit quelle semaine est
 * demandée, pas qu'elle porte des menus.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { decalerJours, lundiDeLaSemaine, semaineDeCantine, versJourCivil } from '@/utils/date';

const ECRAN = join(process.cwd(), 'app', '(tabs)', 'cantine.tsx');

const NOMS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

function nom(jour: Date): string {
  return NOMS[jour.getDay()] ?? '';
}

/** Une date LOCALE, comme l'écran la construit — jamais lue en UTC. */
function local(annee: number, mois: number, jour: number): Date {
  return new Date(annee, mois - 1, jour, 12);
}

/**
 * Quatorze jours de suite, à cheval sur une fin de mois.
 *
 * Le 27 septembre 2026 et le 4 octobre 2026 sont deux dimanches, et ils ne
 * tombent pas au même endroit du mois : c'est ce qu'un décalage de sept jours
 * doit traverser sans se tromper.
 */
const JOURS: readonly Date[] = Array.from({ length: 14 }, (_, index) =>
  decalerJours(local(2026, 9, 21), index),
);

/**
 * Vrai si un instant tombe dans la semaine qui commence à `lundi`.
 *
 * L'intervalle est SEMI-OUVERT : du premier instant du lundi au premier instant
 * du lundi suivant, exclu. Comparer à minuit le dernier jour ferait sortir de la
 * semaine tout instant de ce jour-là après minuit — le corpus porte justement
 * des dates de midi, pour que la règle ne dépende pas de l'heure.
 */
function dansLaSemaine(lundi: Date, jour: Date): boolean {
  const instant = jour.getTime();
  return instant >= lundi.getTime() && instant < decalerJours(lundi, 7).getTime();
}

describe('semaineDeCantine — la semaine que l’écran ouvre', () => {
  it('le corpus porte deux fois chaque jour, dimanche compris', () => {
    // Sans ce contrôle, un corpus décalé d'un jour passerait le banc sans rien
    // éprouver : le dimanche est le seul cas qui distingue la règle.
    const jours = JOURS.map((jour) => jour.getDay());
    for (let attendu = 0; attendu < 7; attendu += 1) {
      assert.equal(
        jours.filter((jour) => jour === attendu).length,
        2,
        `le corpus ne porte pas deux ${NOMS[attendu] ?? ''}`,
      );
    }
  });

  it('ouvre toujours sur un lundi, à minuit', () => {
    for (const jour of JOURS) {
      const lundi = semaineDeCantine(jour);
      assert.equal(lundi.getDay(), 1, `un ${nom(jour)} : la semaine n’ouvre pas sur un lundi`);
      assert.equal(lundi.getHours(), 0, `un ${nom(jour)} : la semaine ouvre à une heure`);
      assert.equal(lundi.getMinutes(), 0);
    }
  });

  it('contient « demain », tous les jours de la semaine', () => {
    // La promesse de l'en-tête, mise en propriété. Le dimanche est le cas qui
    // échouait : « demain » y est le lundi suivant, donc hors de la semaine qui
    // se termine.
    for (const jour of JOURS) {
      const lundi = semaineDeCantine(jour);
      assert.ok(
        dansLaSemaine(lundi, decalerJours(jour, 1)),
        `« demain » n’est pas dans la semaine ouverte un ${nom(jour)} ` +
          `(${versJourCivil(lundi)} – ${versJourCivil(decalerJours(lundi, 6))})`,
      );
    }
  });

  it('contient aujourd’hui, sauf le dimanche', () => {
    // Le décalage ne doit pas déplacer la semaine tous les jours : six jours sur
    // sept, l'écran continue d'ouvrir sur la semaine en cours.
    for (const jour of JOURS) {
      const attendu = jour.getDay() !== 0;
      assert.equal(
        dansLaSemaine(semaineDeCantine(jour), jour),
        attendu,
        `un ${nom(jour)} : aujourd’hui ${attendu ? 'devrait' : 'ne devrait pas'} être ` +
          'dans la semaine ouverte',
      );
    }
  });

  it('ouvre sur la semaine d’aujourd’hui les six autres jours', () => {
    // Le décalage ne doit pas déplacer la semaine tous les jours : c'est ce qui
    // rend « la semaine dernière » et « la semaine prochaine » utilisables.
    for (const jour of JOURS) {
      if (jour.getDay() === 0) continue;
      assert.equal(
        versJourCivil(semaineDeCantine(jour)),
        versJourCivil(lundiDeLaSemaine(jour)),
        `un ${nom(jour)} : la semaine ouverte devrait être celle qui contient aujourd’hui`,
      );
    }
  });

  it('avance d’une semaine, et d’une seule, le dimanche', () => {
    // « Une seule » compte : deux semaines d'avance sauteraient celle que le
    // parent vient de vivre, et il ne pourrait plus y revenir d'un cran.
    for (const jour of JOURS) {
      if (jour.getDay() !== 0) continue;
      assert.equal(
        versJourCivil(semaineDeCantine(jour)),
        versJourCivil(decalerJours(lundiDeLaSemaine(jour), 7)),
        'un dimanche : la semaine ouverte devrait être celle qui commence demain',
      );
    }
  });

  it('laisse « la semaine dernière » atteindre la semaine d’aujourd’hui', () => {
    // Le décalage déplace la semaine de départ : le dimanche, la semaine qui
    // contient aujourd'hui est donc celle du cran d'avant. Elle doit rester
    // atteignable, sinon le parent ne peut plus revenir sur le dimanche qu'il
    // vient de vivre.
    const dimanche = local(2026, 9, 27);
    assert.equal(dimanche.getDay(), 0, 'prémisse : la date choisie est un dimanche');

    assert.ok(
      dansLaSemaine(decalerJours(semaineDeCantine(dimanche), -7), dimanche),
      'la semaine contenant aujourd’hui n’est plus atteignable depuis le dimanche',
    );
  });
});

describe('accord avec l’écran', () => {
  const source = readFileSync(ECRAN, 'utf8');

  it('ouvre sur la semaine de la règle', () => {
    assert.match(
      source,
      /const base = semaineDeCantine\(\)/,
      'L’écran n’ouvre plus sur `semaineDeCantine()` : le dimanche, il rouvre sur la ' +
        'semaine révolue, et « demain » n’y est pas.',
    );
    assert.doesNotMatch(
      source,
      /lundiDeLaSemaine\(\s*new Date\(\)\s*\)/,
      'L’écran est revenu à `lundiDeLaSemaine(new Date())` : la semaine ouverte est de ' +
        'nouveau celle qui contient l’instant courant.',
    );
  });

  it('décale la semaine ouverte, et non le libellé', () => {
    // Le libellé et les flèches partent du même `decalage`, et c'est lui qui
    // porte le sens de « semaine prochaine ». Le décalage de départ ne doit pas
    // s'y glisser, sinon les deux se cumuleraient.
    assert.match(
      source,
      /decalerJours\(\s*base\s*,\s*decalage \* 7\s*\)/,
      'la semaine ouverte n’est plus décalée de `decalage * 7` : les flèches ne ' +
        'parcourent plus les semaines.',
    );
  });

  it('construit ses sept jours depuis la semaine ouverte', () => {
    assert.match(
      source,
      /versJourCivil\(\s*decalerJours\(\s*lundi\s*,\s*index\s*\)\s*\)/,
      'les jours affichés ne sont plus construits depuis `lundi` : la semaine affichée ' +
        'pourrait ne plus être celle qui a été demandée.',
    );
  });
});
