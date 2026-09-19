/**
 * Les deux contrôles de base tournent-ils vraiment tous les deux ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Les trois flux qui interrogent la base écrivaient ceci :
 *
 *   run: |
 *     npm run securite:api
 *     npm run verifier:requetes
 *
 * Un `run:` multiligne est exécuté par `bash -e`, qui **s'arrête à la première
 * commande en échec**. Le second contrôle ne tournait donc que si le premier
 * réussissait — et `securite:api` étant rouge depuis que la migration
 * `membres_bureau` n'est pas appliquée, `verifier:requetes` ne s'exécutait plus
 * du tout en intégration continue. Mesuré : la seconde commande n'apparaissait
 * pas dans le journal du pas.
 *
 * Le défaut est SILENCIEUX, et il est double : le pas était déjà rouge, donc
 * personne ne regardait ; et un défaut propre à `verifier:requetes` — une requête
 * devenue fausse, une colonne renommée — serait resté invisible jusqu'à ce qu'un
 * parent ouvre un onglet vide.
 *
 * Les trois flux agrègent maintenant les deux verdicts : les deux tournent, et
 * le pas échoue si l'un des deux a échoué. C'est cette forme que le banc tient.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que les commandes réussissent — c'est le rôle des contrôles eux-mêmes, et ils
 * demandent la base. Il vérifie seulement qu'aucune des deux ne peut être
 * supprimée en silence par l'échec de l'autre.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/**
 * Les flux qui interrogent la base, et l'ancre qui désigne le bon `run:`.
 *
 * Liste FERMÉE : un quatrième flux qui interrogerait la base sans agréger les
 * verdicts n'y entrerait pas tout seul. Le `readdirSync` de `check-workflows.mjs`
 * mesure ce qui RESTE dans le dossier, jamais ce qui manque à cette liste-ci.
 *
 * L'ancre est la **commande entière**, jamais le seul mot `securite:api` : ce
 * mot apparaît aussi dans les commentaires qui précèdent le pas, et la remontée
 * vers le `run:` aurait alors trouvé le bloc de l'étape PRÉCÉDENTE. Mesuré —
 * l'extraction rendait le `run:` qui vérifie la présence des secrets, et le banc
 * accusait deux flux parfaitement corrects. Une ancre courte sur un vocabulaire
 * partagé est presque toujours ambiguë.
 */
const FLUX = [
  { nom: 'ci.yml', marqueur: 'npm run securite:api' },
  { nom: 'android-apk.yml', marqueur: 'npm run securite:api' },
  { nom: 'ios-unsigned.yml', marqueur: 'npm run securite:api' },
];

/**
 * Le bloc `run:` qui contient le marqueur, ou `null`.
 *
 * Le bloc est délimité par l'indentation : on remonte jusqu'à la ligne `run: |`,
 * puis on descend tant que les lignes sont plus indentées que le `run:` lui-même.
 * Une extraction écrite en espaces fixes casserait à la première réindentation,
 * et l'alerte porterait alors sur la mise en forme au lieu de la décision.
 */
function blocRun(source, marqueur) {
  const lignes = source.split('\n');
  const index = lignes.findIndex((l) => l.includes(marqueur));
  if (index === -1) return null;

  let debut = index;
  while (debut >= 0 && !/^\s*run:\s*\|/.test(lignes[debut])) debut -= 1;
  if (debut === -1) return null;

  const indentation = lignes[debut].match(/^\s*/)[0].length;
  let fin = debut + 1;
  while (fin < lignes.length) {
    const ligne = lignes[fin];
    if (ligne.trim() !== '' && ligne.match(/^\s*/)[0].length <= indentation) break;
    fin += 1;
  }
  return lignes.slice(debut + 1, fin).join('\n');
}

/**
 * Vrai si le bloc lance les deux contrôles ET agrège leurs verdicts.
 *
 * Chaque commande doit porter son `|| code=1`, et le bloc doit se terminer par
 * `exit "$code"`. Sans la dernière ligne, le pas sortirait en succès alors qu'un
 * contrôle a échoué — le remède serait pire que le mal.
 */
function agregeLesVerdicts(bloc) {
  const lance = (commande) => new RegExp(`^\\s*${commande} \\|\\| code=1\\s*$`, 'm').test(bloc);
  return (
    lance('npm run securite:api') &&
    lance('npm run verifier:requetes') &&
    /^\s*exit "\$code"\s*$/m.test(bloc)
  );
}

/** La forme fautive, telle qu'elle était écrite : une commande par ligne. */
const ANCIENNE_FORME = [
  '          npm run securite:api',
  '          npm run verifier:requetes',
].join('\n');

describe('Les contrôles de base ne peuvent pas se masquer l’un l’autre', () => {
  it('le banc reconnaît la forme fautive, et ne la déclare pas concluante', () => {
    // Sans ce cas, une fonction qui répondrait toujours « oui » passerait les
    // trois essais suivants sans rien mesurer.
    assert.equal(agregeLesVerdicts(ANCIENNE_FORME), false);
  });

  it('et il reconnaît la forme corrigée', () => {
    assert.equal(
      agregeLesVerdicts(
        [
          '          code=0',
          '          npm run securite:api || code=1',
          '          npm run verifier:requetes || code=1',
          '          exit "$code"',
        ].join('\n'),
      ),
      true,
    );
  });

  it('l’extraction du bloc est porteuse, pour les trois flux', () => {
    // Un `blocRun` qui rendrait `null` ou un bloc vide ferait passer les essais
    // suivants sur du vide : c'est l'état « vert en ne lisant rien », le pire
    // des états. On exige donc que le bloc contienne bien les deux commandes.
    for (const flux of FLUX) {
      const source = readFileSync(
        new URL(`../.github/workflows/${flux.nom}`, import.meta.url),
        'utf8',
      );
      const bloc = blocRun(source, flux.marqueur);
      assert.notEqual(bloc, null, `bloc run: introuvable dans ${flux.nom}`);
      assert.match(bloc, /npm run securite:api/);
      assert.match(bloc, /npm run verifier:requetes/);
    }
  });

  for (const flux of FLUX) {
    it(`${flux.nom} agrège les deux verdicts`, () => {
      const source = readFileSync(
        new URL(`../.github/workflows/${flux.nom}`, import.meta.url),
        'utf8',
      );
      const bloc = blocRun(source, flux.marqueur);
      assert.ok(bloc !== null, `bloc run: introuvable dans ${flux.nom}`);
      assert.equal(
        agregeLesVerdicts(bloc),
        true,
        `${flux.nom} : un échec de securite:api empêcherait verifier:requetes de tourner`,
      );
    });
  }
});
