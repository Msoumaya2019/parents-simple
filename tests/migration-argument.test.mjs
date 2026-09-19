/**
 * L'outil d'application de migration refuse-t-il ce qu'il ne peut pas appliquer ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `scripts/appliquer-migration.mjs` envoyait au point d'entrée SQL le contenu de
 * **n'importe quel fichier existant**. Mesuré, sur la machine de l'auteur :
 * lancé avec le script lui-même en argument, il a envoyé son propre source à la
 * base, qui a répondu
 *
 *   42601: syntax error at or near "{"
 *   LINE 29: import { readFileSync, existsSync } from 'node:fs';
 *
 * L'erreur est exacte, et elle parle de la ligne 29 d'un fichier JavaScript —
 * pas de la migration qu'on croyait appliquer. Un outil dont l'échec consiste à
 * envoyer du JavaScript à une base de données doit refuser ce qu'il ne peut pas
 * reconnaître : **un contrôle qui ne peut rien affirmer échoue, il ne passe
 * pas.**
 *
 * Les deux règles vivent maintenant dans des fonctions pures et exportées,
 * parce qu'une règle qui décide de ce qui part vers la base doit se charger sous
 * `node --test`. Le banc les éprouve **dans les deux sens** : ce qui doit être
 * accepté, et ce qui doit être refusé — sans le second, une fonction qui
 * refuserait tout passerait pour concluante.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que le contenu accepté est bien la migration voulue. La règle sur le contenu
 * est une **liste de refus**, pas une preuve d'être du SQL : elle attrape le
 * fichier qu'on lui a réellement passé un jour, et rien de plus. Le seul
 * contrôle qui tranche sur ce que la base porte est celui qui l'interroge —
 * `npm run securite:api` et `npm run verifier:requetes`.
 *
 * POURQUOI IL N'EST PAS DANS `import-sans-configuration.test.mjs`
 * ---------------------------------------------------------------
 * Ce banc-là tient le contrat d'import des deux scripts de vérification, dont le
 * refus est identique (« Configuration absente », et les deux variables
 * nommées). Cet outil-ci refuse autre chose — un jeton absent, un argument
 * fautif — et sa liste est fermée sur ces deux scripts. Il éprouve donc son
 * propre contrat, plus bas, dans la même forme : processus enfant, sans jeton,
 * depuis un dossier vide.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

import { verdictSurLeChemin, verdictSurLeContenu } from '../scripts/appliquer-migration.mjs';

/** Le chemin de la migration à appliquer, tel qu'on doit l'écrire. */
const MIGRATION = 'supabase/migrations/20260918001000_membres_bureau.sql';

/** Le source de la migration, lu par le chemin réel. */
const SOURCE_MIGRATION = readFileSync(
  new URL('../supabase/migrations/20260918001000_membres_bureau.sql', import.meta.url),
  'utf8',
);

describe('Le chemin : ce qui part vers la base', () => {
  const ACCEPTES = [
    MIGRATION,
    'supabase/exemple-contenu.sql',
    'supabase/migrations/20260917120000_init.sql',
  ];

  for (const chemin of ACCEPTES) {
    it(`accepte ${chemin}`, () => {
      const verdict = verdictSurLeChemin(chemin);
      assert.equal(verdict.ok, true, `refus inattendu : ${verdict.message}`);
      assert.equal(verdict.message, '');
    });
  }

  // Le premier cas est celui qui a été mesuré : c'est le script lui-même.
  const REFUSES = [
    'scripts/appliquer-migration.mjs',
    'src/lib/extrait.ts',
    'package.json',
    'README.md',
    'supabase/notes.txt',
    '../../AppData/Local/Temp/hors-projet.sql',
  ];

  for (const chemin of REFUSES) {
    it(`refuse ${chemin}`, () => {
      const verdict = verdictSurLeChemin(chemin);
      assert.equal(verdict.ok, false, `le chemin a été accepté : ${chemin}`);
      // Un refus qui ne dit pas sur quoi il porte oblige à ouvrir le script.
      assert.notEqual(verdict.message.trim(), '');
      // Le message doit NOMMER le chemin fautif : c'est ce qui permet de voir
      // d'un coup d'œil qu'on a passé le mauvais argument.
      assert.ok(
        verdict.message.includes(chemin),
        `le refus ne nomme pas le chemin : ${verdict.message}`,
      );
    });
  }

  it('le refus d’un fichier non-SQL dit que l’outil n’applique que du SQL', () => {
    // La cause est contre-intuitive — « le fichier existe, pourquoi refuse-t-il ? » —
    // donc elle est écrite dans le message, et tenue ici.
    const verdict = verdictSurLeChemin('scripts/appliquer-migration.mjs');
    assert.match(verdict.message, /pas un fichier \.sql/);
    assert.match(verdict.message, /n’applique que du SQL/);
  });

  it('le refus hors de supabase/ nomme les deux emplacements légitimes', () => {
    const verdict = verdictSurLeChemin('supabase/notes.txt');
    // `supabase/notes.txt` est refusé par la règle du `.sql` ; on interroge donc
    // la règle d'emplacement sur un chemin qui la déclenche vraiment.
    assert.equal(verdict.ok, false);

    const hors = verdictSurLeChemin('../../ailleurs/migration.sql');
    assert.match(hors.message, /hors de supabase\//);
    assert.match(hors.message, /supabase\/migrations\//);
    assert.match(hors.message, /supabase\/exemple-contenu\.sql/);
  });
});

describe('Le contenu : ce que l’outil envoie', () => {
  it('accepte le source de la migration réelle', () => {
    const verdict = verdictSurLeContenu(SOURCE_MIGRATION);
    assert.equal(verdict.ok, true, `refus inattendu : ${verdict.message}`);
    assert.equal(verdict.message, '');
  });

  it('accepte un SQL minimal', () => {
    assert.equal(verdictSurLeContenu('select 1;\n').ok, true);
  });

  it('refuse un fichier vide', () => {
    // L'API répond 200 à un lot vide : l'outil annoncerait un succès sans avoir
    // rien appliqué. C'est le défaut que ce refus empêche.
    const verdict = verdictSurLeContenu('');
    assert.equal(verdict.ok, false);
    assert.match(verdict.message, /vide/);
    assert.match(verdict.message, /200/);
  });

  it('refuse un fichier fait de blancs', () => {
    assert.equal(verdictSurLeContenu('   \n\n\t\n').ok, false);
  });

  const JS = [
    { nom: 'un import', source: "import { readFileSync } from 'node:fs';\n" },
    { nom: 'un export', source: 'export function extraire() {}\n' },
    { nom: 'un require', source: "const yaml = require('yaml');\n" },
  ];

  for (const cas of JS) {
    it(`refuse ${cas.nom} renommé en .sql`, () => {
      // L'extension ne suffit pas : `mv migration.mjs migration.sql` passerait
      // la règle du chemin. C'est cette seconde règle qui l'arrête.
      const verdict = verdictSurLeContenu(cas.source);
      assert.equal(verdict.ok, false, `le contenu a été accepté : ${cas.nom}`);
      assert.match(verdict.message, /JavaScript/);
    });
  }

  it('accepte un commentaire SQL qui parle d’import', () => {
    // La règle est ancrée en début de ligne ET exige une espace après le mot :
    // un commentaire qui mentionne `import` ne doit pas être refusé, sans quoi
    // la règle bloquerait une migration légitime.
    assert.equal(verdictSurLeContenu('-- import des données\nselect 1;\n').ok, true);
  });

  it('accepte une colonne dont le nom commence par export', () => {
    assert.equal(verdictSurLeContenu('select export_data from t;\n').ok, true);
  });
});

describe('Le cas mesuré, rejoué', () => {
  // Le fichier réellement envoyé un jour : le source de l'outil lui-même. Les
  // deux règles le refusent, et c'est la première qui parle.
  const SOURCE_OUTIL = readFileSync(
    new URL('../scripts/appliquer-migration.mjs', import.meta.url),
    'utf8',
  );

  it('le chemin de l’outil est refusé', () => {
    assert.equal(verdictSurLeChemin('scripts/appliquer-migration.mjs').ok, false);
  });

  it('et son contenu aussi, si on le renommait', () => {
    assert.equal(verdictSurLeContenu(SOURCE_OUTIL).ok, false);
  });
});

describe("Contrat d'import : importer l'outil ne l'exécute pas", () => {
  // Sans garde d'import, ce banc-ci sortirait en code 1 sur « usage : … » dès la
  // première ligne — et les essais ci-dessus ne mesureraient rien. Le contrôle
  // est donc fait dans un processus enfant, sans jeton et depuis un dossier
  // vide : c'est la seule façon de reproduire la condition de la CI.
  const url = new URL('../scripts/appliquer-migration.mjs', import.meta.url).href;

  it("importé sans jeton, ne sort pas du processus et n'écrit rien", () => {
    const dossier = mkdtempSync(join(tmpdir(), 'fl-migration-'));
    try {
      const env = { ...process.env };
      delete env.SUPABASE_ACCESS_TOKEN;

      const resultat = spawnSync(
        process.execPath,
        ['--input-type=module', '--eval', `await import(${JSON.stringify(url)});`],
        { cwd: dossier, env, encoding: 'utf8' },
      );

      assert.equal(
        resultat.status,
        0,
        `L'import a échoué (code ${resultat.status}).\n` +
          `sortie : ${JSON.stringify(resultat.stdout)}\n` +
          `erreur : ${JSON.stringify(resultat.stderr)}`,
      );
      assert.equal(resultat.stdout, '', "L'import ne doit rien écrire sur la sortie standard.");
      assert.equal(resultat.stderr, '', "L'import ne doit rien écrire sur la sortie d'erreur.");
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  it('lancé sans argument, refuse et rappelle l’usage', () => {
    const chemin = fileURLToPath(new URL('../scripts/appliquer-migration.mjs', import.meta.url));
    const dossier = mkdtempSync(join(tmpdir(), 'fl-migration-'));
    try {
      const env = { ...process.env };
      delete env.SUPABASE_ACCESS_TOKEN;

      const resultat = spawnSync(process.execPath, [chemin], {
        cwd: dossier,
        env,
        encoding: 'utf8',
      });

      assert.equal(resultat.status, 1);
      assert.match(resultat.stderr, /usage : node scripts\/appliquer-migration\.mjs/);
      // Aucune requête ne doit partir sans argument.
      assert.equal(resultat.stdout, '');
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
