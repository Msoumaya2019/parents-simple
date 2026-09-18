/**
 * L'état d'un chargement, et la question du geste de rafraîchissement.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `useAsyncData` répond à deux questions, et les écrans n'en posaient qu'une :
 *
 *   - « qu'est-ce que j'affiche ? » ;
 *   - « la demande en cours est-elle terminée ? ».
 *
 * La seconde était répondue par `etat.statut === 'chargement'`. Or un
 * rechargement ne change pas la clé de la demande, donc l'ancien résultat reste
 * affiché : `etat.statut` vaut `succes` pendant tout le rechargement. La
 * condition était donc **toujours fausse** après le premier chargement, et
 * `enRafraichissement = attente && faux` valait faux : le parent tirait vers le
 * bas, les données se rechargeaient, et **rien ne le lui montrait**. Le geste
 * fonctionnait sans retour visible.
 *
 * Aucun contrôle existant ne regardait cela : le typecheck ne voit rien (les
 * deux expressions sont des booléens), les tests ne chargeaient pas le hook, et
 * l'écran ne se plaint pas — il n'affiche simplement pas d'indicateur.
 *
 * POURQUOI LES RÈGLES SONT DANS `@/lib/chargement`
 * -----------------------------------------------
 * Un banc ne peut pas charger `useAsyncData.ts`, qui importe React. Les deux
 * dérivations vivent donc dans un module qui n'importe rien — même raison, et
 * même mesure, que `message-liste.ts` côté administration et `responsable.ts`
 * ici. La partie 1 interroge les règles ; la partie 2 exige que les écrans
 * passent la bonne.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la roue s'affiche à l'écran. La partie 2 lit des sources, pas un rendu :
 * elle établit que chaque écran passe `enCours` au geste, et non que React
 * Native en fasse une roue visible. Le maillon qui manquait était le premier.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { chargementEnCours, etatDerive, type ResultatMemorise } from '@/lib/chargement';

const RACINE = process.cwd();
const DOSSIER_APP = join(RACINE, 'app');
const HOOK = join(RACINE, 'src', 'hooks', 'useAsyncData.ts');

/**
 * Les écrans qui offrent le geste de rafraîchissement. Liste CLOSE, et vérifiée
 * plus bas : sans la prémisse, un sixième écran pourrait naître hors du banc.
 */
const ECRANS_A_GESTE = [
  '(tabs)/agenda.tsx',
  '(tabs)/cantine.tsx',
  '(tabs)/index.tsx',
  '(tabs)/plus.tsx',
  'documents.tsx',
] as const;

/** Un résultat arrivé : le succès, pour la clé `filtre-a`, tentative 0. */
const ARRIVE: ResultatMemorise<readonly string[]> = {
  cle: 'filtre-a',
  tentative: 0,
  etat: { statut: 'succes', donnees: ['un'] },
};

/** Le même résultat, mais un rechargement a été demandé depuis. */
const RECHARGEMENT_DEMANDE: ResultatMemorise<readonly string[]> = ARRIVE;

/** Tous les fichiers de `app/`, récursivement, en chemins relatifs POSIX. */
function fichiersSous(dossier: string, prefixe = ''): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(join(dossier, prefixe), { withFileTypes: true })) {
    const chemin = prefixe === '' ? entree.name : `${prefixe}/${entree.name}`;
    if (entree.isDirectory()) {
      trouves.push(...fichiersSous(dossier, chemin));
    } else {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/** Les écrans qui appellent le geste, d'après le disque. */
function ecransQuiAppellentLeGeste(): readonly string[] {
  return fichiersSous(DOSSIER_APP)
    .filter((chemin) => chemin.endsWith('.tsx'))
    .filter((chemin) =>
      readFileSync(join(DOSSIER_APP, chemin), 'utf8').includes('useRafraichissement('),
    )
    .sort();
}

/**
 * Le texte de l'appel au geste, du nom de la fonction jusqu'à la parenthèse qui
 * le ferme.
 *
 * C'est la PORTÉE du contrôle : chercher `statut === 'chargement'` dans tout le
 * fichier le trouverait dans les conditions d'affichage, qui sont légitimes. Ce
 * qui est fautif est de le passer AU GESTE.
 */
function argumentDuGeste(source: string): string {
  const debut = source.indexOf('useRafraichissement(');
  assert.ok(debut >= 0, 'aucun appel à useRafraichissement dans cet écran');
  const fin = source.indexOf(');', debut);
  assert.ok(fin > debut, 'appel à useRafraichissement non terminé — analyse impossible');
  return source.slice(debut, fin);
}

describe('etatDerive — ce que l’écran affiche', () => {
  it('n’affiche rien tant qu’aucun résultat n’est arrivé', () => {
    assert.deepEqual(etatDerive(null, 'filtre-a'), { statut: 'chargement' });
  });

  it('affiche le résultat de la demande courante', () => {
    assert.deepEqual(etatDerive(ARRIVE, 'filtre-a'), { statut: 'succes', donnees: ['un'] });
  });

  it('ne montre pas le résultat d’une AUTRE demande', () => {
    // Le filtre a changé : afficher l'ancien résultat donnerait à lire des
    // menus d'une autre semaine sous l'en-tête de celle-ci.
    assert.deepEqual(etatDerive(ARRIVE, 'filtre-b'), { statut: 'chargement' });
  });

  it('garde l’ancien résultat pendant un rechargement, et c’est voulu', () => {
    // La liste ne doit pas disparaître pendant qu'on la rafraîchit.
    assert.deepEqual(etatDerive(RECHARGEMENT_DEMANDE, 'filtre-a'), {
      statut: 'succes',
      donnees: ['un'],
    });
  });
});

describe('chargementEnCours — la question du geste', () => {
  it('est en cours tant qu’aucun résultat n’est arrivé', () => {
    assert.equal(chargementEnCours(null, 'filtre-a', 0), true);
  });

  it('n’est plus en cours quand la demande courante a rendu son résultat', () => {
    assert.equal(chargementEnCours(ARRIVE, 'filtre-a', 0), false);
  });

  it('EST en cours pendant un rechargement, bien que l’écran affiche déjà quelque chose', () => {
    // Le défaut corrigé, et la seule ligne qui le distingue : la clé n'a pas
    // changé, mais la tentative a été incrémentée par `recharger()`. Répondre
    // avec `etat.statut === 'chargement'` rendait faux ici.
    assert.equal(chargementEnCours(ARRIVE, 'filtre-a', 1), true);
  });

  it('EST en cours quand la clé a changé, même sans rechargement demandé', () => {
    assert.equal(chargementEnCours(ARRIVE, 'filtre-b', 0), true);
  });

  it('redevient terminé quand le rechargement a rendu son résultat', () => {
    const rendu: ResultatMemorise<readonly string[]> = { ...ARRIVE, tentative: 1 };
    assert.equal(chargementEnCours(rendu, 'filtre-a', 1), false);
  });

  it('les deux questions se répondent différemment, et c’est le cœur du sujet', () => {
    // Ce que ce banc existe pour figer : sur ce cas, `etatDerive` dit « affiche
    // le succès » et `chargementEnCours` dit « oui, c'est en cours ». Confondre
    // les deux était possible, et donnait un geste sans indicateur.
    assert.equal(etatDerive(ARRIVE, 'filtre-a').statut, 'succes');
    assert.equal(chargementEnCours(ARRIVE, 'filtre-a', 1), true);
  });
});

describe('accord avec les écrans — c’est `enCours` qui est passé au geste', () => {
  it('couvre tous les écrans qui offrent le geste, et eux seuls', () => {
    // Sans cette prémisse, un sixième écran qui passerait `etat.statut` ne
    // serait vu par personne : la liste close ne vaut que vérifiée.
    assert.deepEqual(ecransQuiAppellentLeGeste(), [...ECRANS_A_GESTE].sort());
  });

  it('aucun écran ne passe l’état d’affichage au geste de rafraîchissement', () => {
    const fautifs: string[] = [];

    for (const chemin of ECRANS_A_GESTE) {
      const source = readFileSync(join(DOSSIER_APP, chemin), 'utf8');
      const appel = argumentDuGeste(source);

      // La question du geste n'est pas celle de l'affichage. Un rechargement
      // laisse `statut` à `succes`, donc cette condition-là vaut toujours faux.
      if (appel.includes("statut === 'chargement'")) {
        fautifs.push(chemin);
      }
    }

    assert.deepEqual(
      fautifs,
      [],
      `Ces écrans passent l’état d’affichage au geste de rafraîchissement : ` +
        `${fautifs.join(', ')}. Un rechargement n’y repasse jamais en ` +
        `« chargement », donc l’indicateur ne s’afficherait jamais.`,
    );
  });

  it('chaque écran à geste passe bien `enCours`', () => {
    for (const chemin of ECRANS_A_GESTE) {
      const source = readFileSync(join(DOSSIER_APP, chemin), 'utf8');

      assert.ok(
        argumentDuGeste(source).includes('enCours'),
        `${chemin} ne passe pas \`enCours\` à useRafraichissement.`,
      );
    }
  });

  it('le hook rend bien `enCours`, dérivé de la règle éprouvée', () => {
    const source = readFileSync(HOOK, 'utf8');

    assert.ok(
      source.includes('chargementEnCours('),
      'useAsyncData ne dérive plus `enCours` avec chargementEnCours : la règle ' +
        'éprouvée plus haut n’est plus celle qui sert.',
    );
    assert.ok(
      source.includes('{ etat, enCours, recharger }'),
      'useAsyncData ne rend plus `enCours` : les écrans ne peuvent plus poser ' +
        'la bonne question au geste.',
    );
  });
});
