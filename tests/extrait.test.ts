/**
 * L'extrait d'une actualité, coupé à la fin d'un mot.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * La règle vivait dans `AnnonceCard.tsx`, à côté du rendu. Un composant qui
 * importe React ne se charge pas sous `node --test` : elle n'était donc
 * éprouvable par rien, alors qu'elle décide de la première chose qu'un parent
 * lit. Elle vit maintenant dans `src/lib/extrait.ts`, qui n'importe rien.
 *
 * L'en-tête de la carte, lui, affirmait la règle sans son repli — « coupé à la
 * fin d'un mot, et non à un nombre de caractères fixe » —, et se trouvait donc
 * faux sur le cas que ce banc couvre maintenant.
 *
 * LE REPLI, ET POURQUOI IL EXISTE
 * -------------------------------
 * Quand aucun espace ne tombe dans les derniers 40 % de la longueur demandée,
 * couper au dernier espace trouvé ne donnerait que quelques caractères, qui ne
 * renseigneraient sur rien. La coupe se fait alors au caractère : c'est le seul
 * cas où l'extrait peut finir au milieu d'un mot, et c'est ce que le cas
 * « segment insécable » mesure ici.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { extraire } from '@/lib/extrait';

const RACINE = process.cwd();
const MODULE = join(RACINE, 'src', 'lib', 'extrait.ts');
const CARTE = join(RACINE, 'src', 'components', 'AnnonceCard.tsx');
const EN_AVANT = join(RACINE, 'src', 'components', 'AnnonceEnAvant.tsx');

/** Un corps d'actualité ordinaire : des mots courts, des espaces simples. */
const PHRASE = 'La cantine propose cette semaine un menu de saison, préparé sur place. ';
const LONG = PHRASE.repeat(6);

/**
 * Des mots courts, puis un segment de 100 caractères sans aucun espace.
 *
 * Les 180 premiers caractères s'arrêtent dans ce segment : le dernier espace
 * tombe à l'index 95, donc avant `180 * 0.6`, et le repli doit s'appliquer.
 */
const INSECABLE = `${'des mots courts '.repeat(6)}${'y'.repeat(100)}`;

describe('Un texte plus court que la limite est rendu tel quel', () => {
  it('sans coupure ni points de suspension', () => {
    assert.equal(extraire('Bonjour à tous.'), 'Bonjour à tous.');
  });

  it('à la limite exacte, sans coupure', () => {
    const texte = 'a'.repeat(180);
    assert.equal(extraire(texte), texte);
  });

  it('un texte vide reste vide', () => {
    assert.equal(extraire(''), '');
  });

  it('un texte fait de blancs ne donne rien', () => {
    assert.equal(extraire('   \n\t  '), '');
  });
});

describe('Les blancs sont ramenés à une seule espace', () => {
  it('espaces multiples, tabulation et saut de ligne', () => {
    assert.equal(
      extraire('  Un   texte\n\tsur\nplusieurs   lignes.  '),
      'Un texte sur plusieurs lignes.',
    );
  });

  it('l’extrait d’un texte long ne contient aucun saut de ligne', () => {
    assert.doesNotMatch(extraire(LONG), /\n/);
  });
});

describe('Un texte trop long est coupé à la fin d’un mot', () => {
  it('se termine par des points de suspension', () => {
    assert.ok(LONG.length > 180, 'le corpus doit dépasser la limite');
    assert.ok(extraire(LONG).endsWith('…'));
  });

  it('la coupe tombe sur une espace du texte d’origine', () => {
    const resultat = extraire(LONG);
    const avant = resultat.slice(0, -1);
    assert.equal(
      LONG[avant.length],
      ' ',
      'la coupe doit tomber sur une frontière de mot, pas au milieu d’un mot',
    );
  });

  it('ne dépasse jamais la limite, points de suspension non comptés', () => {
    for (const texte of [LONG, INSECABLE, PHRASE.repeat(40)]) {
      const resultat = extraire(texte);
      assert.ok(
        resultat.length <= 181,
        `${resultat.length} caractères pour un extrait limité à 180`,
      );
    }
  });

  it('la limite passée en argument est celle qui compte', () => {
    assert.ok(LONG.length > 240, 'le corpus doit dépasser 240');
    assert.ok(extraire(LONG, 240).length <= 241);
    assert.ok(extraire(LONG, 240).length > extraire(LONG).length);
  });
});

describe('Le repli : aucun espace où couper', () => {
  it('coupe au caractère quand le segment final est trop long', () => {
    const resultat = extraire(INSECABLE);
    assert.equal(resultat.length, 181);
    assert.ok(
      resultat.endsWith('y…'),
      'le repli coupe dans le segment sans espace, faute de frontière',
    );
  });

  it('avec une frontière disponible, la coupe retombe sur un mot', () => {
    // Le même début, mais un segment plus court : un espace tombe de nouveau
    // dans les derniers 40 % de la limite, et la coupe retrouve une frontière.
    // C'est ce contraste qui prouve que le seuil décide, et non la longueur.
    const avecFrontiere = `${'des mots courts '.repeat(6)}${'y'.repeat(40)} des mots ensuite et encore dautres mots pour depasser la limite fixee.`;
    assert.ok(avecFrontiere.length > 180, 'le corpus doit dépasser la limite');

    const resultat = extraire(avecFrontiere);
    const avant = resultat.slice(0, -1);
    assert.equal(
      avecFrontiere[avant.length],
      ' ',
      'une frontière existe ici : la coupe ne doit pas tomber dans le segment',
    );
    assert.ok(!resultat.endsWith('y…'));
  });
});

describe('La règle vit dans un module éprouvable, et n’y est qu’une fois', () => {
  it('src/lib/extrait.ts n’importe rien', () => {
    const source = readFileSync(MODULE, 'utf8');
    assert.doesNotMatch(
      source,
      /^import /m,
      'un import rendrait le module non chargeable par ce banc',
    );
  });

  it('les deux cartes importent la règle au lieu d’en garder une copie', () => {
    for (const carte of [CARTE, EN_AVANT]) {
      const source = readFileSync(carte, 'utf8');
      assert.match(source, /import \{ extraire \} from '@\/lib\/extrait';/);
      assert.doesNotMatch(
        source,
        /export function extraire/,
        'une copie locale redeviendrait non éprouvable',
      );
    }
  });
});
