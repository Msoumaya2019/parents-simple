/**
 * Ce que le projet dit du type des paramètres d'adresse est-il vrai du paquet
 * installé ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * L'en-tête de `app/annonce/[id].tsx` justifiait son découpage par une
 * affirmation sur expo-router :
 *
 *   « Le type générique du crochet, lui, est contraint à `string` : on ne peut
 *     donc pas lui demander la forme exacte attendue. »
 *
 * Les deux moitiés sont fausses, et lisibles dans le paquet installé :
 *
 *   - la contrainte est `Record<string, string | string[]>` — le type ADMET le
 *     tableau, il ne le refuse pas ;
 *   - le crochet a une seconde surcharge qui prend le chemin de la route et
 *     rend la forme déclarée : `useLocalSearchParams<'/annonce/[id]'>()`.
 *
 * La pratique du fichier — prendre la valeur en `unknown` et la ramener à une
 * chaîne — reste la bonne, mais pour une autre raison, et c'est celle-là qui
 * est maintenant écrite : demander la forme déclarée serait une ASSERTION sur
 * une valeur qui vient d'une adresse, pas une vérification.
 *
 * C'est le défaut de ce dépôt : un commentaire attribue au code une garantie
 * qu'il ne porte pas. La différence, ici, est que la source de vérité n'est pas
 * un fichier du dépôt mais un paquet installé — donc ce banc le LIT, il ne le
 * suppose pas.
 *
 * CE QUE CE BANC TIENT
 * --------------------
 *   1. La contrainte extraite du paquet installé est bien celle annoncée. Si
 *      expo-router en change, le banc tombe et force à relire — c'est le but.
 *   2. L'en-tête dit la même chose que le paquet, et ne reprend pas la forme
 *      réfutée.
 *   3. Le code ne fait aucune assertion : le crochet est appelé sans argument
 *      de type, et la valeur entre en `unknown`.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Il lit une déclaration `.d.ts` par motif : il ne compile rien et n'exécute
 * rien. Il ne dit pas non plus que le comportement d'expo-router à l'exécution
 * suit sa déclaration — seul un essai sur l'appareil le dirait.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();

/** Le fichier de types où `useLocalSearchParams` puise sa contrainte. */
const TYPES = join(RACINE, 'node_modules', 'expo-router', 'build', 'typed-routes', 'types.d.ts');

/** La déclaration du crochet, qui porte les deux surcharges. */
const CROCHET = join(
  RACINE,
  'node_modules',
  'expo-router',
  'build',
  'hooks',
  'useLocalSearchParams.d.ts',
);

const ECRAN = join(RACINE, 'app', 'annonce', '[id].tsx');

/**
 * La contrainte du paramètre générique, telle que le paquet la déclare.
 *
 * Rend `null` si le motif a disparu : un `null` fait échouer le banc avec un
 * message, là où une chaîne vide passerait pour un accord.
 */
function contrainteDesParametres(source: string): string | null {
  const trouve = /export type UnknownOutputParams = ([^;]+);/.exec(source);
  if (trouve === null || trouve[1] === undefined) return null;
  return trouve[1].trim();
}

/** Les commentaires d'un fichier, code retiré : un motif cité ne compte pas. */
function commentaires(source: string): string {
  const blocs = [...source.matchAll(/\/\*[\s\S]*?\*\//g)].map((m) => m[0]);
  const lignes = source.split('\n').filter((l) => /^\s*\/\//.test(l));
  return [...blocs, ...lignes].join('\n');
}

/**
 * Le code d'un fichier, commentaires retirés.
 *
 * Indispensable ici, et le premier essai l'a montré : l'en-tête de l'écran
 * CITTE `useLocalSearchParams<'/annonce/[id]'>()` pour expliquer pourquoi il ne
 * s'en sert pas. Un contrôle qui chercherait cette forme dans le fichier entier
 * la trouverait — dans le commentaire qui dit de ne pas l'employer.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

describe('Le type des paramètres d’adresse, lu dans le paquet installé', () => {
  const types = readFileSync(TYPES, 'utf8');
  const contrainte = contrainteDesParametres(types);

  it('la contrainte se lit, et admet le tableau', () => {
    assert.notEqual(
      contrainte,
      null,
      `aucune déclaration de UnknownOutputParams dans ${TYPES} : le paquet a changé de ` +
        'forme, et tout ce banc ne mesurerait plus rien.',
    );
    assert.equal(
      contrainte,
      'Record<string, string | string[]>',
      'la contrainte a changé : relire le paquet, puis corriger l’en-tête de ' +
        'app/annonce/[id].tsx — et ce banc.',
    );
  });

  it('le crochet a bien une surcharge qui prend le chemin de la route', () => {
    // C'est ce qui rend fausse la seconde moitié de l'ancienne affirmation :
    // « on ne peut donc pas lui demander la forme exacte attendue ».
    const declaration = readFileSync(CROCHET, 'utf8');
    assert.match(
      declaration,
      /useLocalSearchParams<TRoute extends RoutePath/,
      'la surcharge qui prend un chemin de route a disparu : l’en-tête doit être relu.',
    );
  });

  it('la règle d’extraction refuse un fichier où le motif manque', () => {
    // Sans ce cas, une extraction qui rendrait toujours la bonne valeur ne
    // mesurerait rien.
    assert.equal(contrainteDesParametres('export type Autre = 1;'), null);
  });
});

describe('L’en-tête de l’écran dit la même chose que le paquet', () => {
  const source = readFileSync(ECRAN, 'utf8');
  const texte = commentaires(source);

  it('il nomme la contrainte réelle', () => {
    assert.ok(
      texte.includes('Record<string, string | string[]>'),
      'l’en-tête ne nomme plus la contrainte réelle du crochet : il décrit alors un ' +
        'type que le paquet ne déclare pas.',
    );
  });

  it('il ne reprend pas la forme réfutée', () => {
    assert.ok(
      !texte.includes('contraint à `string`'),
      'l’en-tête affirme de nouveau que le générique est contraint à `string` : c’est ' +
        'faux, et c’est la phrase qui avait fait écrire une justification erronée.',
    );
  });

  it('il dit que la surcharge existe, et pourquoi on ne s’en sert pas', () => {
    assert.match(
      texte,
      /useLocalSearchParams<'\/annonce\/\[id\]'>\(\)/,
      'l’en-tête ne montre plus la surcharge qui donnerait la forme déclarée : la raison ' +
        'de prendre la valeur en `unknown` devient invisible.',
    );
  });
});

describe('L’écran ne fait aucune assertion sur le type', () => {
  const source = sansCommentaires(readFileSync(ECRAN, 'utf8'));

  it('le crochet est appelé sans argument de type', () => {
    assert.ok(
      source.includes('useLocalSearchParams()'),
      'le crochet n’est plus appelé sans argument de type : le fichier a peut-être ' +
        'adopté une assertion.',
    );
    assert.ok(
      !source.includes('useLocalSearchParams<'),
      'le crochet est appelé avec un argument de type : c’est une assertion sur une ' +
        'valeur qui vient d’une adresse, et non une vérification.',
    );
  });

  it('la valeur entre en unknown, et le tableau est traité', () => {
    assert.match(
      source,
      /function premierParametre\(valeur: unknown\): string/,
      'le paramètre n’entre plus en `unknown` : le tableau ne serait plus écarté.',
    );
    const corps = /function premierParametre[\s\S]*?\n}/.exec(source)?.[0];
    assert.ok(corps !== undefined, 'le corps de premierParametre est introuvable.');
    assert.match(
      corps,
      /Array\.isArray\(valeur\)/,
      'le corps ne teste plus le tableau : un segment répété donnerait un identifiant faux.',
    );
  });
});
