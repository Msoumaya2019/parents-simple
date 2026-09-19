/**
 * La question « cet appareil a-t-il répondu ? », et l'accord des deux écrans.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Deux écrans posent cette question : l'accueil, pour choisir entre « Votre avis
 * nous intéresse » et « Votre réponse est enregistrée », et l'onglet Plus, pour
 * savoir quel choix mettre en évidence. Chacun y répondait à sa façon —
 * `!== undefined` d'un côté, `?? null` de l'autre. Les deux étaient justes, et
 * rien ne tenait qu'elles le restent.
 *
 * La divergence serait muette. `CHOIX_INCONNU` est la chaîne VIDE : une seule
 * des deux expressions passée à un test de vérité en ferait un « rien de
 * connu ». L'accueil dirait alors « Votre réponse est enregistrée » pendant que
 * l'onglet Plus reproposerait les choix. Le parent qui appuie n'obtiendrait
 * rien — la base refuse un second vote, `voteARetenir` rend de nouveau
 * `CHOIX_INCONNU`, et l'écran revient à son état d'avant. Une boucle, sans
 * message, sur le seul écran où l'on vote.
 *
 * La règle vit donc dans `@/lib/choix-retenu`, qui n'importe RIEN, et les deux
 * écrans l'appellent.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La partie 1 exerce `choixRetenuPour` sur des cas, dont les trois valeurs qui
 * comptent : rien de connu (`null`), la chaîne vide (`CHOIX_INCONNU`), un
 * identifiant de choix.
 *
 * La partie 2 tient que `aRepondu` ne dit jamais autre chose que
 * `choixRetenuPour !== null`. Les deux fonctions répondent à deux questions
 * différentes, mais l'une est définie à partir de l'autre : le banc l'éprouve
 * plutôt que de le supposer.
 *
 * La partie 3 tient l'INVARIANT sur toutes les valeurs : aucune chaîne, y
 * compris vide, n'est jamais prise pour « rien de connu ». C'est la mutation
 * qu'on veut interdire — `??` remplacé par `||` — et elle n'a pas de cas
 * particulier qui la signalerait.
 *
 * La partie 4 relit les sources privées de leurs commentaires, et c'est
 * nécessaire : les docblocks des deux modules parlent longuement de
 * `!== undefined` et de `?? null`. Un contrôle qui chercherait ces motifs sans
 * retirer les commentaires serait satisfait par une phrase — c'est-à-dire par
 * rien. Un banc ne peut pas charger `app/(tabs)/plus.tsx` : il lit donc la
 * forme de l'appel, comme `tests/sondage-accueil.test.ts`.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que les écrans affichent ce qu'ils devraient. Le banc tient que les deux
 * passent par la même règle, et ce que cette règle rend ; il ne rend aucun
 * composant.
 *
 * Il lie des NOMS — `choixRetenuPour`, `aRepondu`, `choixRetenu`. Ce sont des
 * noms que la règle possède : les renommer est un changement de la règle, pas
 * un détail de forme, et il est normal que le banc le voie. Ce qui a été
 * délibérément évité, c'est de lier le nom du COMPOSANT ou celui de la
 * variable locale — un renommage cohérent ne doit rien changer.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { aRepondu, choixRetenuPour } from '@/lib/choix-retenu';
import { CHOIX_INCONNU } from '@/lib/votes-locaux';

const RACINE = process.cwd();
const REGLE_ACCUEIL = join(RACINE, 'src', 'lib', 'sondage-accueil.ts');
const ECRAN_PLUS = join(RACINE, 'app', '(tabs)', 'plus.tsx');

const SONDAGE = 'b1000000-0000-4000-8000-000000000001';
const AUTRE_SONDAGE = 'b1000000-0000-4000-8000-000000000002';
const CHOIX_A = 'f1000000-0000-4000-8000-000000000001';
const CHOIX_B = 'f1000000-0000-4000-8000-000000000002';

/** Le source privé de ses commentaires, avant toute recherche de motif. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function lire(chemin: string): string {
  return sansCommentaires(readFileSync(chemin, 'utf8'));
}

describe('Ce que l’appareil a retenu, et ce qu’il n’a pas retenu', () => {
  it('rend null quand la mémoire locale ne parle pas de ce sondage', () => {
    assert.equal(choixRetenuPour({}, SONDAGE), null);
    assert.equal(choixRetenuPour({ [AUTRE_SONDAGE]: CHOIX_A }, SONDAGE), null);
  });

  it('rend le choix retenu quand il est connu', () => {
    assert.equal(choixRetenuPour({ [SONDAGE]: CHOIX_A }, SONDAGE), CHOIX_A);
    assert.equal(choixRetenuPour({ [SONDAGE]: CHOIX_B }, SONDAGE), CHOIX_B);
  });

  it('rend la chaîne vide, et non null, pour un vote dont le choix est inconnu', () => {
    // Le cas qui décide de tout : `CHOIX_INCONNU` est un vote, pas une absence.
    // Rendre `null` ici ferait reproposer les choix à un appareil qui a voté.
    assert.equal(choixRetenuPour({ [SONDAGE]: CHOIX_INCONNU }, SONDAGE), CHOIX_INCONNU);
    assert.notEqual(choixRetenuPour({ [SONDAGE]: CHOIX_INCONNU }, SONDAGE), null);
  });
});

describe('« A répondu » ne dit jamais autre chose que la règle', () => {
  it('est vrai exactement quand un choix est retenu', () => {
    const tables: readonly Readonly<Record<string, string>>[] = [
      {},
      { [AUTRE_SONDAGE]: CHOIX_A },
      { [SONDAGE]: CHOIX_A },
      { [SONDAGE]: CHOIX_INCONNU },
      { [SONDAGE]: CHOIX_INCONNU, [AUTRE_SONDAGE]: CHOIX_B },
    ];

    for (const votes of tables) {
      assert.equal(
        aRepondu(votes, SONDAGE),
        choixRetenuPour(votes, SONDAGE) !== null,
        `désaccord sur ${JSON.stringify(votes)}`,
      );
    }
  });
});

describe('Aucune valeur retenue n’est prise pour « rien de connu »', () => {
  it('tient pour toute valeur, y compris la chaîne vide', () => {
    // C'est l'invariant, et non un cas : la mutation à interdire est `??`
    // remplacé par `||`, qui ne se signalerait sur AUCUN cas particulier
    // hormis celui-ci — et seulement si on pense à l'écrire.
    for (const retenu of [CHOIX_INCONNU, CHOIX_A, 'x', '0', 'false']) {
      assert.equal(
        aRepondu({ [SONDAGE]: retenu }, SONDAGE),
        true,
        `« ${retenu} » a été prise pour « rien de connu »`,
      );
    }
  });

  it('ne confond pas un sondage muet avec un sondage à la chaîne vide', () => {
    assert.equal(aRepondu({}, SONDAGE), false);
    assert.equal(aRepondu({ [SONDAGE]: CHOIX_INCONNU }, SONDAGE), true);
  });
});

describe('Les deux écrans passent par la même règle', () => {
  it('l’accueil emploie « a répondu », et n’écrit plus le test lui-même', () => {
    const source = lire(REGLE_ACCUEIL);

    assert.match(
      source,
      /import \{ aRepondu \} from '@\/lib\/choix-retenu'/,
      'l’accueil doit employer la règle partagée',
    );
    assert.match(source, /aRepondu\(votes, sondage\.id\)/);
    assert.doesNotMatch(
      source,
      /votes\[[^\]]+\]\s*!==\s*undefined/,
      'le test d’appartenance ne doit plus être écrit ici : deux expressions de la même question finiraient par diverger',
    );
  });

  it('l’onglet Plus emploie la règle, et n’écrit plus le choix lui-même', () => {
    const source = lire(ECRAN_PLUS);

    assert.match(
      source,
      /import \{ choixRetenuPour \} from '@\/lib\/choix-retenu'/,
      'l’onglet Plus doit employer la règle partagée',
    );
    assert.match(source, /choixRetenu=\{choixRetenuPour\(/);
    assert.doesNotMatch(
      source,
      /votes\[[^\]]+\]\s*(\?\?|\|\|)/,
      'le choix retenu ne doit pas être dérivé sur place : c’est ce qui laissait `??` devenir `||` sans que rien ne le voie',
    );
  });
});
