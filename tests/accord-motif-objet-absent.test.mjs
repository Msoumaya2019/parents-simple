/**
 * Le contrôle d'accord entre le script de vérification et l'application
 * mesure-t-il vraiment quelque chose ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `scripts/verifier-requetes-app.mjs` annonçait, dans son en-tête, vérifier que
 * la formulation qui désigne un objet absent était « la même » dans
 * `src/services/documents.ts` et chez lui. Il la cherchait ainsi :
 *
 *   sourceService.includes(MOTIF_OBJET_ABSENT)
 *
 * Cette forme ne mesure pas un accord : elle mesure la PRÉSENCE D'UNE CHAÎNE
 * quelque part dans un fichier. Falsifiée, elle est restée VERTE sur une source
 * où le motif avait été recopié dans un commentaire et où `fichierAbsent`
 * cherchait tout autre chose. Le contrôle annonçait donc un accord pendant que
 * l'écran, lui, ne reconnaissait plus l'absence : il aurait ouvert un onglet sur
 * du JSON, et personne ne l'aurait vu.
 *
 * C'est le défaut que ce banc empêche de revenir. Il tient quatre choses :
 *
 *   - le contrôle lit bien le motif DANS LE CORPS de `fichierAbsent` ;
 *   - il refuse chacune des quatre façons de le rendre faux ;
 *   - l'ancienne forme, elle, les acceptait — ce que le banc rejoue pour que la
 *     raison du correctif ne se perde pas ;
 *   - et le script EMPLOIE cette règle, au lieu d'en garder une copie ou de
 *     revenir à l'ancienne forme. Ce dernier point a été ajouté après coup : la
 *     falsification avait montré que sept mutations sur huit étaient détectées,
 *     et que remettre le site d'appel à `includes` laissait le banc vert — un
 *     banc qui éprouve une fonction que personne n'appelle ne protège rien.
 *
 * LA VALEUR EST RECOPIÉE, ET NON IMPORTÉE
 * ---------------------------------------
 * Le motif est écrit ici une seconde fois, à dessein. Lire `MOTIF_OBJET_ABSENT`
 * depuis le script pour s'en servir rendrait l'accord vrai par construction : le
 * banc confirmerait ce que le script dit, quel que soit ce qu'il dit. Il
 * l'IMPORTE donc pour le CONFRONTER à cette copie-ci, comme
 * `tests/flux-de-travail-attendus.test.mjs` confronte sa liste de flux.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la formulation est celle que Supabase emploie réellement. Le contrôle
 * réseau du script s'en charge, et lui seul peut le faire. Ce banc-ci tient
 * l'accord entre deux fichiers qui ne peuvent pas se lire.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  MOTIF_OBJET_ABSENT,
  accordDeFormulation,
  formulationDeLAbsence,
} from '../scripts/verifier-requetes-app.mjs';

const SOURCE = readFileSync(new URL('../src/services/documents.ts', import.meta.url), 'utf8');

/** Le motif, recopié : c'est cette copie que le script doit rejoindre. */
const MOTIF_ATTENDU = 'NoSuchKey|Object not found';

/** Le drapeau sans lequel `NOSUCHKEY` ne serait plus reconnu. */
const DRAPEAUX_ATTENDUS = 'i';

/** La ligne du service qui porte la décision. */
const DECISION = '  return /NoSuchKey|Object not found/i.test(corps);';

/** La déclaration de la fonction, pour la mutation qui la fait disparaître. */
const DECLARATION = 'export function fichierAbsent(';

/**
 * Les façons de rendre le contrôle faux, chacune avec ce qu'elle simule.
 *
 * La première est celle qui a motivé ce banc : le motif survit dans un
 * commentaire, la fonction décide autre chose. Un contrôle qui lit le fichier ne
 * la voit pas ; un contrôle qui lit le corps, si.
 */
const MUTATIONS = [
  {
    nom: 'le motif est recopié dans un commentaire, et la fonction cherche autre chose',
    source: SOURCE.replace(
      DECISION,
      '  // Formulation historique : NoSuchKey|Object not found\n' +
        '  return /Objet manquant/i.test(corps);',
    ),
  },
  {
    nom: 'la fonction a disparu',
    source: SOURCE.replace(DECLARATION, 'function absentDuFichier('),
  },
  {
    nom: 'le drapeau i a été retiré',
    source: SOURCE.replace(
      '/NoSuchKey|Object not found/i.test',
      '/NoSuchKey|Object not found/.test',
    ),
  },
  {
    nom: 'le motif a été raccourci',
    source: SOURCE.replace('/NoSuchKey|Object not found/i', '/NoSuchKey/i'),
  },
];

describe('Ce que le contrôle compare', () => {
  it('la constante du contrôle est celle que ce banc recopie', () => {
    // Deux écritures indépendantes de la même valeur. Si elles divergent, l'une
    // des deux a bougé sans l'autre — et c'est le banc qui doit le dire, pas la
    // base, au moment où l'écran cesse de reconnaître l'absence.
    assert.equal(MOTIF_OBJET_ABSENT, MOTIF_ATTENDU);
  });

  it('l’application emploie ce motif, et avec le drapeau i', () => {
    assert.deepEqual(formulationDeLAbsence(SOURCE), {
      motif: MOTIF_ATTENDU,
      drapeaux: DRAPEAUX_ATTENDUS,
    });
  });

  it('le verdict sur la source réelle est un accord, sans réserve', () => {
    const verdict = accordDeFormulation(SOURCE, MOTIF_OBJET_ABSENT);
    assert.equal(verdict.ok, true, `désaccord inattendu : ${verdict.detail}`);
    // Un accord qui s'accompagne d'un détail n'en est pas un : `journaliser`
    // afficherait la réserve à côté du vert, et le vert la ferait oublier.
    assert.equal(verdict.detail, '');
  });

  it('les mutations du banc ne sont pas inertes', () => {
    // Un `replace` dont le motif ne correspond pas renvoie la source inchangée :
    // les quatre cas suivants passeraient alors en éprouvant la source correcte.
    // C'est le défaut de banc qui a déjà coûté un essai vert sur un texte non
    // coupé, et il se referme ici, une fois pour les quatre.
    for (const mutation of MUTATIONS) {
      assert.notEqual(
        mutation.source,
        SOURCE,
        `la mutation « ${mutation.nom} » n'a rien changé : son motif ne correspond plus`,
      );
    }
  });
});

describe('Ce que le contrôle refuse', () => {
  for (const mutation of MUTATIONS) {
    it(`refuse quand ${mutation.nom}`, () => {
      const verdict = accordDeFormulation(mutation.source, MOTIF_OBJET_ABSENT);

      assert.equal(verdict.ok, false, `le contrôle a accepté : ${mutation.nom}`);
      // Un refus n'est probant que si l'on sait sur quoi il porte. Un `false` nu
      // obligerait à ouvrir le fichier pour comprendre ce qui a bougé.
      assert.notEqual(
        verdict.detail.trim(),
        '',
        `le refus ne dit pas sur quoi il porte : ${mutation.nom}`,
      );
    });
  }
});

describe('Ce que l’ancienne forme laissait passer', () => {
  // Le premier cas est celui qui a été trouvé : le motif survit dans un
  // commentaire. Ces deux essais rejouent l'ancienne mesure et la nouvelle sur
  // la MÊME source, pour que la raison du correctif reste écrite quelque part.
  const commentaire = MUTATIONS[0].source;

  it('la chaîne cherchée était bien présente dans le fichier muté', () => {
    assert.ok(
      commentaire.includes(MOTIF_OBJET_ABSENT),
      'le cas de référence ne rejoue plus le défaut : la mutation a changé de forme',
    );
  });

  it('et pourtant le fichier muté ne reconnaissait plus l’absence', () => {
    assert.equal(formulationDeLAbsence(commentaire)?.motif, 'Objet manquant');
    assert.equal(accordDeFormulation(commentaire, MOTIF_OBJET_ABSENT).ok, false);
  });
});

/**
 * Le source du script, commentaires retirés.
 *
 * Cette étape est indispensable, et pas seulement par principe : le script CITE
 * l'ancienne forme dans sa documentation — « `sourceService.includes(
 * MOTIF_OBJET_ABSENT)` » —, et un contrôle qui lit le fichier brut prendrait
 * cette citation pour du code. C'est très exactement l'erreur que ce correctif
 * répare ; la refaire dans le banc qui la dénonce serait fâcheux.
 */
function sansCommentaires(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
}

const SCRIPT = sansCommentaires(
  readFileSync(new URL('../scripts/verifier-requetes-app.mjs', import.meta.url), 'utf8'),
);

describe('Le script emploie la règle que ce banc éprouve', () => {
  // Un banc qui éprouve une fonction que le script n'appelle plus est vert pour
  // rien. Ce n'est pas une hypothèse : c'est ce que la falsification a montré,
  // en remettant le site d'appel à la forme `includes` — sept mutations sur huit
  // étaient détectées, celle-là passait. La forme du site d'appel est donc tenue
  // elle aussi, et le contrôle des commentaires ci-dessus la rend lisible.
  it('l’étape d’accord compare le motif lu dans le corps de la fonction', () => {
    assert.match(
      SCRIPT,
      /accordDeFormulation\(\s*sourceService\s*,\s*MOTIF_OBJET_ABSENT\s*\)/,
      'l’étape d’accord n’appelle plus la règle que ce banc éprouve',
    );
  });

  it('et n’est pas revenue à chercher la chaîne dans le fichier', () => {
    assert.doesNotMatch(
      SCRIPT,
      /\.includes\(\s*MOTIF_OBJET_ABSENT\s*\)/,
      'le script cherche de nouveau la chaîne n’importe où dans le fichier',
    );
  });
});
