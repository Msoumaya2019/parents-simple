/**
 * L'accord des catégories de message entre l'application et l'administration.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Un parent choisit « Vie scolaire » dans le formulaire de contact. Ce choix
 * part vers la base sous la forme `vie_scolaire`, et le bureau le relit dans la
 * page d'administration, où la même valeur est retraduite en français.
 *
 * Or les libellés sont écrits DEUX FOIS. `admin/` est une application séparée,
 * et cette séparation est voulue — c'est elle qui permet de déployer la page
 * seule. Elle ne peut donc pas importer depuis `src/`, et les deux listes
 * vivent chacune de leur côté.
 *
 * Rien, dans la langue, ne les relie. Un libellé corrigé d'un côté et pas de
 * l'autre ne casse rien : le parent choisit « Vie scolaire », le bureau lit
 * « Vie scolaire » écrit autrement. Les deux écrans restent cohérents avec
 * eux-mêmes, et personne ne voit l'écart — c'est le défaut le plus discret de
 * la famille, et c'est celui-ci que le banc ferme.
 *
 * CE QU'IL IMPORTE, ET POURQUOI C'EST LA BONNE FAÇON
 * --------------------------------------------------
 * Les deux listes sont IMPORTÉES, pas relues dans du texte. `admin/src/lib/
 * types.ts` n'importe rien du tout ; `src/lib/categories-message.ts` n'importe
 * qu'un `import type`, que l'effacement des types retire. Une valeur importée
 * ne peut pas mentir sur son propre contenu — contrairement à un motif qui
 * cesserait de correspondre.
 *
 * C'est la raison pour laquelle les catégories ont quitté
 * `src/services/messages.ts` : ce fichier importe le client Supabase et
 * `expo-crypto`, donc aucun banc ne peut le charger. L'accord aurait alors été
 * invérifiable, et une règle invérifiable est une règle qui dérive.
 *
 * LA CHAÎNE COMPLÈTE, ET OÙ ELLE EST TENUE
 * ----------------------------------------
 * Le type `message_categorie` de la base compte cinq valeurs. Le chemin qui va
 * de la base au téléphone passe par trois maillons, chacun tenu par un
 * contrôle différent :
 *
 *     base  ←→  administration   règle 5 de `scripts/check-admin.mjs`
 *     administration  ←→  application   ce banc-ci
 *
 * Les deux maillons sont vérifiés ; la base et l'application sont donc
 * d'accord sans qu'un troisième contrôle ait à relire la migration.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * L'ordre des deux listes, délibérément : il diffère, et c'est un usage et non
 * un désaccord — voir le commentaire de `CATEGORIES_MESSAGE` côté
 * administration. Le banc compare les couples (valeur, libellé), jamais les
 * positions.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  CATEGORIES_MESSAGE as CATEGORIES_APPLICATION,
  libelleCategorieMessage as libelleApplication,
} from '../src/lib/categories-message.ts';
import {
  CATEGORIES_MESSAGE as CATEGORIES_ADMINISTRATION,
  libelleCategorieMessage as libelleAdministration,
} from '../admin/src/lib/types.ts';
import type { MessageCategorie } from '../src/types/models.ts';

const RACINE = process.cwd();
const ECRAN_CONTACT = join(RACINE, 'app', '(tabs)', 'contact.tsx');

/**
 * L'instruction qui importe depuis `@/services/messages`, et les noms qu'elle
 * demande.
 *
 * Volontairement limitée à un import nommé sur une seule ligne : c'est la forme
 * qu'emploie l'écran, et une forme plus souple — un motif qui accepterait
 * n'importe quelle mise en page — risquerait de capturer l'import voisin.
 */
const IMPORT_MESSAGES = /import\s*\{([^}]*)\}\s*from\s*'@\/services\/messages'/;

function sourceContact(): string {
  return readFileSync(ECRAN_CONTACT, 'utf8');
}

const valeursApplication: readonly string[] = [...CATEGORIES_APPLICATION];
const valeursAdministration: readonly string[] = CATEGORIES_ADMINISTRATION.map(
  (entree) => entree.valeur,
);

describe('catégories de message — les deux listes disent la même chose', () => {
  it('prémisse : les deux listes ont été importées, et ne sont pas vides', () => {
    // Sans cette prémisse, un import cassé ou une liste vidée rendrait les
    // comparaisons suivantes vertes en ne comparant rien.
    assert.ok(
      valeursApplication.length >= 3,
      `prémisse : ${valeursApplication.length} valeur(s) côté application`,
    );
    assert.ok(
      valeursAdministration.length >= 3,
      `prémisse : ${valeursAdministration.length} valeur(s) côté administration`,
    );
  });

  it('propose exactement les mêmes valeurs, des deux côtés', () => {
    const manquantesCoteAdmin = valeursApplication.filter(
      (valeur) => !valeursAdministration.includes(valeur),
    );
    const manquantesCoteApplication = valeursAdministration.filter(
      (valeur) => !valeursApplication.includes(valeur),
    );

    assert.deepEqual(
      manquantesCoteAdmin,
      [],
      'Ces catégories existent dans l’application mais pas dans l’administration : ' +
        `${manquantesCoteAdmin.join(', ')}. Un parent peut les choisir, et le bureau ` +
        'ne peut pas les nommer.',
    );

    assert.deepEqual(
      manquantesCoteApplication,
      [],
      'Ces catégories existent dans l’administration mais pas dans l’application : ' +
        `${manquantesCoteApplication.join(', ')}. Le bureau peut les lire, aucun parent ` +
        'ne peut les choisir.',
    );
  });

  it('donne le même libellé à chaque valeur', () => {
    // Le cœur du banc. C'est la comparaison qui manquait : les valeurs peuvent
    // s'accorder alors que les mots divergent — c'est même le cas le plus
    // probable, une correction de libellé ne touchant qu'un seul fichier.
    for (const valeur of valeursApplication) {
      //  Le transtypage ne sert qu'à satisfaire le paramètre : `valeur` vient de
      //  la liste de l'administration, donc d'une chaîne. Si elle n'était pas une
      //  catégorie connue, `libelleApplication` rendrait `undefined` et
      //  l'assertion ci-dessous échouerait en le disant — l'échec reste bruyant.
      const coteApplication = libelleApplication(valeur as MessageCategorie);
      const entreeAdministration = CATEGORIES_ADMINISTRATION.find(
        (entree) => entree.valeur === valeur,
      );

      assert.ok(
        entreeAdministration !== undefined,
        `« ${valeur} » n’a pas d’entrée côté administration : la comparaison des ` +
          'libellés ne peut pas avoir lieu.',
      );

      assert.equal(
        coteApplication,
        entreeAdministration.libelle,
        `« ${valeur} » se dit « ${coteApplication} » dans l’application et ` +
          `« ${entreeAdministration.libelle} » dans l’administration.`,
      );

      assert.equal(
        libelleAdministration(entreeAdministration.valeur),
        coteApplication,
        `« ${valeur} » n’est pas nommée de la même façon selon la fonction employée : ` +
          'la table de libellés et la liste des catégories ont divergé.',
      );
    }
  });

  it('ne répète aucune valeur', () => {
    // Une valeur deux fois dans la même liste produirait deux boutons
    // identiques dans le formulaire, et React signalerait une clé dupliquée —
    // mais seulement à l'affichage, sur le téléphone d'un parent.
    for (const [nom, valeurs] of [
      ['application', valeursApplication],
      ['administration', valeursAdministration],
    ] as const) {
      assert.equal(
        new Set(valeurs).size,
        valeurs.length,
        `La liste de l’${nom} répète une valeur : ${valeurs.join(', ')}.`,
      );
    }
  });
});

describe('la liste est réellement employée, et pas seulement déclarée', () => {
  it('l’écran de contact importe les deux, depuis le module attendu', () => {
    //  On lit l'INSTRUCTION D'IMPORT, et non la présence du nom dans le
    //  fichier. La différence n'est pas théorique : l'écran écrit aussi
    //  `CATEGORIES_MESSAGE.map(…)` dans son corps, donc retirer l'import
    //  laisserait le nom partout et un `source.includes('CATEGORIES_MESSAGE')`
    //  resterait vert sur un écran qui ne compile plus. Mesuré, en falsifiant.
    const instruction = IMPORT_MESSAGES.exec(sourceContact());

    assert.ok(
      instruction !== null,
      'L’écran de contact n’importe plus rien depuis @/services/messages.',
    );

    //  `instruction[1]` est le contenu des accolades. `noUncheckedIndexedAccess`
    //  le type comme possiblement absent, et il l'est en effet : le motif
    //  accepte `import {} from '…'`. Un import vide est un défaut réel, donc on
    //  le refuse plutôt que de le laisser passer pour une chaîne vide.
    const contenu = instruction[1];
    assert.ok(
      contenu !== undefined && contenu.trim() !== '',
      'L’écran de contact importe un bloc vide depuis @/services/messages.',
    );

    const noms = contenu
      .split(',')
      .map((nom) => nom.trim())
      .filter((nom) => nom !== '');

    assert.ok(
      noms.includes('CATEGORIES_MESSAGE'),
      `L’écran de contact n’importe plus CATEGORIES_MESSAGE (importé : ${noms.join(', ') || 'rien'}).`,
    );
    assert.ok(
      noms.includes('libelleCategorieMessage'),
      `L’écran de contact n’importe plus libelleCategorieMessage (importé : ${noms.join(', ') || 'rien'}).`,
    );
  });

  it('l’écran de contact les emploie dans son corps', () => {
    //  L'import seul ne suffit pas : une liste importée et jamais parcourue
    //  ferait comparer deux listes dont l'une serait morte. Les deux emplois
    //  sont cherchés dans leur forme d'usage, pas comme des noms.
    const source = sourceContact();

    assert.ok(
      source.includes('CATEGORIES_MESSAGE.map('),
      'L’écran de contact n’énumère plus CATEGORIES_MESSAGE : la liste que ce banc ' +
        'compare n’est plus celle que le parent voit.',
    );
    assert.ok(
      source.includes('libelleCategorieMessage('),
      'L’écran de contact n’appelle plus libelleCategorieMessage : les libellés que ce ' +
        'banc compare ne sont plus ceux qu’un parent lit.',
    );
  });
});
