/**
 * L'état de la liaison avec la base, tel que l'écran Réglages le raconte.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * La section « État de l'application » annonçait répondre à cette question :
 * « quand l'application n'affiche aucune donnée, la première question est de
 * savoir si c'est l'école qui n'a rien publié ou l'application qui n'est pas
 * reliée à sa base ». Elle n'y répondait pas : une coche verte s'affichait dès
 * que l'adresse était renseignée, c'est-à-dire dès que l'application était
 * CONFIGURÉE. Sur un téléphone sans réseau, la coche restait verte, et le parent
 * en concluait que l'école n'avait rien publié.
 *
 * « Configurée » et « joignable » sont deux faits différents. Le premier se lit
 * dans la configuration, le second demande une requête — c'est le rôle de
 * `src/services/diagnostic.ts`.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La règle vit dans `src/lib/diagnostic.ts`, qui n'importe rien : un banc ne
 * peut pas charger `app/reglages.tsx`, qui importe React Native. Même raison et
 * même mesure que `chargement.ts`, `responsable.ts` et `adresse-reponse.ts`.
 *
 * La partie 1 interroge la règle. La partie 2 exige que l'écran l'emploie — et
 * notamment qu'il n'attribue plus de coche verte à la seule configuration. La
 * partie 3 exige que la sonde soit CAPABLE D'ÉCHOUER : une sonde qui avale son
 * erreur répond toujours « la base répond », et ne prouve donc plus rien.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la base réponde, ni que le réseau fonctionne : aucun banc hors ligne ne
 * peut l'établir. Il établit que la sonde est construite pour pouvoir échouer,
 * et que ce qui se lit à l'écran suit son résultat.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { diagnosticConnexion, type EtatSonde } from '@/lib/diagnostic';

const RACINE = process.cwd();
const ECRAN = join(RACINE, 'app', 'reglages.tsx');
const SONDE = join(RACINE, 'src', 'services', 'diagnostic.ts');

/** Les trois états que `useAsyncData` peut rendre. */
const ETATS: readonly EtatSonde[] = ['chargement', 'succes', 'erreur'];

/**
 * Le source privé de ses commentaires.
 *
 * Indispensable ici : ce fichier-ci explique, en prose, qu'une sonde ne doit pas
 * avaler ses erreurs. Chercher `catch` dans le texte brut trouverait cette
 * phrase et signalerait un défaut qui n'existe pas.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Le texte d'un élément JSX, de son premier attribut à sa fermeture. */
function element(source: string, ancre: string): string {
  const debut = source.indexOf(ancre);
  assert.ok(debut >= 0, `« ${ancre} » introuvable — analyse impossible`);
  const fin = source.indexOf('/>', debut);
  assert.ok(fin > debut, `l'élément « ${ancre} » n'est pas fermé — analyse impossible`);
  return source.slice(debut, fin);
}

describe('diagnosticConnexion — ce que lit un parent', () => {
  it('ne sait rien tant que la sonde n’a pas rendu', () => {
    const d = diagnosticConnexion(true, 'chargement');
    assert.equal(d.ton, 'neutre');
    assert.equal(
      d.aide,
      null,
      'Une aide est affichée avant que la sonde ait rendu son verdict : elle ' +
        'affirmerait quelque chose qui n’est pas encore établi.',
    );
  });

  it('annonce que la base répond, et en tire la seule conséquence légitime', () => {
    const d = diagnosticConnexion(true, 'succes');
    assert.equal(d.ton, 'succes');
    assert.ok(d.aide !== null, 'aucune aide alors que c’est le cas qui répond à la question');
    assert.match(
      d.aide,
      /publi/i,
      'Quand la base répond, l’aide doit dire qu’une page vide s’explique par une ' +
        'absence de publication — c’est la question que la section prétend trancher.',
    );
  });

  it('annonce que la base ne répond pas, sans deviner pourquoi', () => {
    const d = diagnosticConnexion(true, 'erreur');
    assert.equal(d.ton, 'danger');
    assert.ok(d.aide !== null, 'aucune aide alors que le parent est devant un écran vide');
    assert.match(
      d.aide,
      /Vérifiez|vérifiez/,
      'L’aide doit donner une action. Un constat sans suite laisse le parent ' +
        'aussi démuni qu’avant d’ouvrir l’écran.',
    );
  });

  it('ne confond pas « non configurée » et « ne répond pas »', () => {
    // Le défaut d'origine, sous sa forme la plus visible : sans base, rien n'a
    // été appelé. Annoncer « la base ne répond pas » serait faux, et enverrait
    // le parent chercher un problème de réseau qui n'existe pas.
    for (const etat of ETATS) {
      const d = diagnosticConnexion(false, etat);
      assert.notEqual(d.ton, 'danger', `ton « danger » annoncé pour l’état ${etat}`);
      assert.doesNotMatch(
        d.libelle,
        /ne répond pas/i,
        'Sans base configurée, la sonde n’a rien éprouvé : « ne répond pas » est faux.',
      );
    }
  });

  it('dit « non vérifiable » quelle que soit la sonde, puisqu’elle n’a pas tourné', () => {
    const resultats = ETATS.map((etat) => diagnosticConnexion(false, etat));
    for (const resultat of resultats) {
      assert.deepEqual(
        resultat,
        resultats[0],
        'Le verdict change selon la sonde alors que la base n’est pas configurée : ' +
          'la configuration doit primer, car c’est elle qui empêche la sonde de partir.',
      );
    }
    assert.equal(resultats[0]?.ton, 'alerte');
  });

  it('donne trois libellés distincts pour les trois états d’une base configurée', () => {
    const libelles = ETATS.map((etat) => diagnosticConnexion(true, etat).libelle);
    assert.equal(
      new Set(libelles).size,
      3,
      `Deux états partagent le même libellé (${libelles.join(' / ')}) : le parent ` +
        'ne peut pas distinguer « on vérifie » de « ça répond » ou de « ça ne répond pas ».',
    );
  });

  it('donne trois tons distincts pour ces trois mêmes états', () => {
    const tons = ETATS.map((etat) => diagnosticConnexion(true, etat).ton);
    assert.equal(
      new Set(tons).size,
      3,
      `Deux états partagent le même ton (${tons.join(' / ')}) : la couleur ne ` +
        'distingue plus rien.',
    );
  });
});

describe('accord avec l’écran — la règle est employée, et la coche a changé de sens', () => {
  const source = readFileSync(ECRAN, 'utf8');

  it('l’écran importe la règle et la sonde', () => {
    assert.ok(
      source.includes("from '@/lib/diagnostic'"),
      'reglages.tsx n’importe plus la règle : ce banc ne tient plus ce qui s’affiche.',
    );
    assert.ok(
      source.includes("from '@/services/diagnostic'"),
      'reglages.tsx n’importe plus la sonde : la ligne « Connexion » ne reposerait ' +
        'plus sur une requête réelle.',
    );
  });

  it('la sonde est réellement lancée, et son état passé à la règle', () => {
    assert.ok(
      /useAsyncData\([^)]*verifierJoignabilite/.test(source),
      'La sonde n’est plus lancée par l’écran : la ligne « Connexion » ne peut ' +
        'plus rien constater.',
    );
    assert.match(
      source,
      /diagnosticConnexion\(\s*adresseBase !== null\s*,\s*connexion\.etat\.statut\s*\)/,
      'La règle n’est plus appelée avec la configuration ET l’état de la sonde : ' +
        'l’un des deux faits est perdu, et c’est la confusion d’origine.',
    );
  });

  it('la ligne « Base de données » ne porte plus de coche verte', () => {
    // Le défaut, à l'endroit exact où il vivait : `correcte={adresseBase !== null}`
    // affichait une coche verte pour une simple présence d'adresse.
    const ligne = element(source, 'libelle="Base de données"');

    assert.match(
      ligne,
      /ton="neutre"/,
      'La ligne « Base de données » ne porte plus le ton neutre : elle se remet à ' +
        'juger la configuration.',
    );
    assert.doesNotMatch(
      ligne,
      /ton="succes"/,
      'La ligne « Base de données » porte de nouveau une coche verte : avoir une ' +
        'adresse ne prouve pas que la base répond.',
    );
  });

  it('la ligne « Connexion » porte le verdict de la règle', () => {
    const ligne = element(source, 'libelle="Connexion"');
    assert.match(
      ligne,
      /ton=\{diagnostic\.ton\}/,
      'La ligne « Connexion » ne prend plus son ton de la règle : la couleur ne ' +
        'suit plus le verdict.',
    );
    assert.match(
      ligne,
      /valeur=\{diagnostic\.libelle\}/,
      'La ligne « Connexion » n’affiche plus le libellé de la règle.',
    );
  });
});

describe('accord avec la sonde — elle doit pouvoir échouer', () => {
  const source = sansCommentaires(readFileSync(SONDE, 'utf8'));

  it('ne retient pas ses erreurs', () => {
    // Une sonde qui avale son échec répond toujours « la base répond ». Elle ne
    // prouve plus rien, et c'est exactement le défaut qu'elle doit révéler.
    assert.doesNotMatch(
      source,
      /\bcatch\b/,
      'La sonde attrape ses erreurs : elle ne peut plus signaler une base ' +
        'injoignable, et la ligne « Connexion » serait verte quoi qu’il arrive.',
    );
    assert.match(
      source,
      /executer[<(]/,
      'La sonde n’emploie plus `executer` : les erreurs de la base ne sont plus ' +
        'converties, et remontent sous une forme que l’écran ne sait pas lire.',
    );
  });

  it('borne sa lecture et nomme ses colonnes', () => {
    assert.match(source, /\.limit\(\s*1\s*\)/, 'la sonde ne borne plus le nombre de lignes lues');
    assert.match(source, /\.select\(/, 'la sonde ne nomme plus les colonnes lues');
    assert.doesNotMatch(source, /select\(\s*['"]\*['"]\s*\)/, 'la sonde lit `*`');
  });
});
