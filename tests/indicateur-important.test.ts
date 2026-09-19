/**
 * L'indicateur d'importance est écrit une fois, et les trois écrans le lisent.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Le même mot — « Important » — paraissait sur trois écrans, et les trois ne
 * disaient pas la même chose : les deux cartes de l'accueil portaient le corail
 * et le porte-voix, l'écran de détail portait l'accent, sans icône. Un parent
 * qui ouvrait une actualité épinglée voyait donc sa pastille changer de couleur
 * en changeant d'écran.
 *
 * Rien ne pouvait le voir : les trois étaient écrites sur place, et deux
 * chaînes de caractères différentes ne se comparent pas. C'est le même défaut
 * que `CATEGORIES_ANNONCE` existe pour empêcher, et il était arrivé faute de
 * table.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 *   - `INDICATEUR_IMPORTANT` porte le libellé, le ton et l'icône, à un seul
 *     endroit, dans `src/services/annonces.ts` ;
 *   - les trois écrans le lisent, et aucun n'écrit plus le libellé en toutes
 *     lettres. L'inventaire est fermé : trois lectures, pas deux, pas quatre.
 *
 * Le module n'est pas importé, mais LU. `src/services/annonces.ts` importe le
 * client Supabase, qui importe `react-native-url-polyfill` : un banc ne peut
 * pas le charger. C'est la même limite que partout ailleurs dans ce dépôt.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const TABLE = join(RACINE, 'src', 'services', 'annonces.ts');
const DOSSIERS = [join(RACINE, 'src'), join(RACINE, 'app')];

/** Le libellé écrit en toutes lettres, celui qu'aucun écran ne doit plus porter. */
const ECRIT_SUR_PLACE = /libelle=["']Important["']/;

/** Les trois écrans qui affichent l'indicateur. Liste fermée. */
const PORTEURS: readonly string[] = [
  'app/annonce/[id].tsx',
  'src/components/AnnonceCard.tsx',
  'src/components/AnnonceEnAvant.tsx',
];

/** Les fichiers source d'un dossier, récursivement. */
function fichiersSource(dossier: string): readonly string[] {
  const trouves: string[] = [];

  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiersSource(chemin));
    } else if (entree.endsWith('.ts') || entree.endsWith('.tsx')) {
      trouves.push(chemin);
    }
  }

  return trouves;
}

/** Le chemin relatif en séparateurs obliques, comme partout dans ce dépôt. */
function cheminRelatif(chemin: string): string {
  return relative(RACINE, chemin).replace(/\\/g, '/');
}

/** Le corps de la constante, de sa déclaration à son `as const`. */
function corpsDeLIndicateur(source: string): string | null {
  const debut = source.indexOf('export const INDICATEUR_IMPORTANT');
  if (debut === -1) {
    return null;
  }

  const fin = source.indexOf('} as const);', debut);
  if (fin === -1) {
    return null;
  }

  return source.slice(debut, fin);
}

/** Vrai si ce source porte le libellé en toutes lettres sur une pastille. */
function ecritSurPlace(source: string): boolean {
  return ECRIT_SUR_PLACE.test(source);
}

const FICHIERS = DOSSIERS.flatMap(fichiersSource).sort();

describe('L’indicateur est écrit une fois', () => {
  it('`INDICATEUR_IMPORTANT` existe, avec le corail et le porte-voix', () => {
    const corps = corpsDeLIndicateur(readFileSync(TABLE, 'utf8'));
    assert.notEqual(corps, null, '`INDICATEUR_IMPORTANT` a disparu de `src/services/annonces.ts`');
    assert.match(corps ?? '', /libelle: 'Important',/);
    assert.match(corps ?? '', /ton: 'corail',/);
    assert.match(corps ?? '', /icone: 'megaphone',/);
  });

  it('aucun écran n’écrit plus le libellé en toutes lettres', () => {
    const fautifs = FICHIERS.filter((chemin) => ecritSurPlace(readFileSync(chemin, 'utf8')));
    assert.deepEqual(
      fautifs.map(cheminRelatif),
      [],
      'une pastille « Important » est écrite sur place : elle divergera des deux autres',
    );
  });
});

describe('Les trois écrans lisent la même table', () => {
  for (const relatif of PORTEURS) {
    it(`${relatif} lit \`INDICATEUR_IMPORTANT\``, () => {
      const source = readFileSync(join(RACINE, relatif), 'utf8');
      assert.match(
        source,
        /import \{[^}]*INDICATEUR_IMPORTANT[^}]*\} from '@\/services\/annonces';/,
        `${relatif} n’importe plus \`INDICATEUR_IMPORTANT\``,
      );
      assert.match(
        source,
        /<Pill \{\.\.\.INDICATEUR_IMPORTANT\} \/>/,
        `${relatif} n’affiche plus l’indicateur depuis la table`,
      );
    });
  }

  it('l’inventaire est fermé : trois lectures, et pas une de plus', () => {
    const lectures = FICHIERS.flatMap((chemin) => {
      const nombre =
        readFileSync(chemin, 'utf8').split('<Pill {...INDICATEUR_IMPORTANT}').length - 1;
      return nombre === 0 ? [] : [`${cheminRelatif(chemin)} ×${nombre}`];
    });

    assert.deepEqual(lectures, [
      'app/annonce/[id].tsx ×1',
      'src/components/AnnonceCard.tsx ×1',
      'src/components/AnnonceEnAvant.tsx ×1',
    ]);
  });
});

describe('Le banc ne se satisfait pas d’une apparence', () => {
  it('un libellé écrit sur place est bien détecté', () => {
    // La forme exacte qui a divergé : même mot, autre ton.
    const fautif = '<Pill libelle="Important" ton="accent" />';
    assert.equal(ecritSurPlace(fautif), true);
  });

  it('une autre pastille ne déclenche pas la règle', () => {
    assert.equal(ecritSurPlace('<Pill libelle="Clôturé" ton="neutre" />'), false);
  });

  it('la constante est trouvée, et son corps s’arrête à elle', () => {
    const source =
      'export const INDICATEUR_IMPORTANT = Object.freeze({\n' +
      "  libelle: 'Important',\n" +
      "  ton: 'corail',\n" +
      "  icone: 'megaphone',\n" +
      '} as const);\n' +
      "export const AUTRE = 'ton: \\'corail\\',';\n";

    const corps = corpsDeLIndicateur(source);
    assert.notEqual(corps, null);
    assert.equal(
      (corps ?? '').includes('AUTRE'),
      false,
      'le corps a débordé sur la suite du fichier',
    );
  });
});
