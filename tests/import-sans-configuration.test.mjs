/**
 * Éprouve le contrat d'import des scripts de vérification : importer ces
 * fichiers ne doit RIEN exécuter.
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * `verifier-securite-api.mjs` porte une garde qui n'appelle `principal()` que
 * s'il est lancé directement. Elle a été écrite exprès pour que
 * `tests/refus-de-droit.test.mjs` puisse importer `refusDeDroit` sans secrets ni
 * réseau. Elle ne suffisait pas : un `process.exit(1)` était resté au niveau du
 * module, où il s'exécute AVANT elle. Résultat en intégration continue, où la
 * suite tourne sans secrets :
 *
 *   # ::error::Configuration absente.
 *   # Subtest: tests/refus-de-droit.test.mjs
 *   not ok 4 - tests/refus-de-droit.test.mjs
 *   # tests 113 / # pass 112 / # fail 1
 *
 * LE MÊME DÉFAUT, DANS LE SCRIPT VOISIN, ET PERSONNE NE LE VOYAIT
 * --------------------------------------------------------------
 * `verifier-requetes-app.mjs` portait la faute à l'identique : un refus de
 * configuration au niveau du module, et un `await main()` sans garde. Rien ne
 * l'importait, donc rien ne le révélait — un défaut qu'aucun lecteur n'exerce
 * reste invisible, et le lire ne suffit pas.
 *
 * Il a fallu l'importer pour éprouver son contrôle d'accord, dont la première
 * version ne mesurait rien (voir `tests/accord-motif-objet-absent.test.mjs`).
 * Ce banc couvre donc désormais les DEUX scripts : la liste est fermée, et un
 * script ajouté demain doit y être inscrit.
 *
 * POURQUOI UN PROCESSUS ENFANT, ET POURQUOI AILLEURS
 * --------------------------------------------------
 * Le défaut ne se manifeste que là où la configuration manque. Sur la machine du
 * développeur, `.env.local` existe : la relecture donnait le vert, et la suite
 * locale aussi. Un contrôle dont la défaillance est silencieuse doit donc être
 * éprouvé, pas relu — mais pour l'éprouver, il faut lui retirer ce qui le sauve.
 * D'où un processus enfant
 *   - sans EXPO_PUBLIC_SUPABASE_URL ni EXPO_PUBLIC_SUPABASE_ANON_KEY,
 *   - lancé depuis un dossier vide, pour que `.env.local` ne soit pas trouvé.
 * C'est la seule façon de rejouer, depuis n'importe quelle machine, la condition
 * qui n'existe qu'en CI.
 *
 * LES DEUX CÔTÉS SONT ÉPROUVÉS, ET C'EST DÉLIBÉRÉ
 * ----------------------------------------------
 * N'exiger que le premier côté ferait passer une correction qui se contenterait
 * de SUPPRIMER le contrôle : le fichier s'importerait alors sans rien dire, mais
 * lancé sans configuration il partirait interroger une base vide. Le second côté
 * tient le contrôle ; le premier tient le contrat d'import. Un correctif qui n'en
 * satisfait qu'un est refusé par l'autre.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Les scripts soumis au contrat.
 *
 * Liste FERMÉE, comme celle des flux de travail : un script ajouté demain n'y
 * entre pas tout seul. Un `readdirSync` mesurerait ce qui RESTE dans
 * `scripts/`, jamais ce qui MANQUE à cette liste — et les scripts qui y sont
 * aujourd'hui sont précisément ceux dont un banc importe une fonction.
 *
 * `verifier-inscription.mjs` y est entré avec `verdict-inscription.test.mjs`,
 * qui importe `verdictSurInscription`. C'est la règle de ce fichier, appliquée
 * au moment où elle servait : le défaut qu'il éprouve ne se manifeste QUE là où
 * la configuration manque, c'est-à-dire jamais sur la machine du développeur.
 * Un script ajouté sans être inscrit ici serait donc un défaut invisible en
 * local et rouge en intégration continue — le rouge que ce banc existe pour
 * rendre impossible.
 */
const SCRIPTS = [
  'verifier-securite-api.mjs',
  'verifier-requetes-app.mjs',
  'verifier-inscription.mjs',
];

/**
 * Environnement privé des deux variables, quelles que soient celles du parent.
 *
 * `delete` plutôt qu'une valeur vide : pour `??`, une chaîne vide et une
 * variable absente ne se comportent pas pareil, et c'est bien l'absence que la
 * CI connaît.
 */
function sansSecrets() {
  const env = { ...process.env };
  delete env.EXPO_PUBLIC_SUPABASE_URL;
  delete env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return env;
}

/** Exécute `action` dans un dossier vide, puis le retire. */
function dansUnDossierVide(action) {
  const dossier = mkdtempSync(join(tmpdir(), 'fl-import-'));
  try {
    return action(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

/** Lance un processus enfant et ne renvoie que de quoi juger. */
function lancer(dossier, arguments_) {
  const resultat = spawnSync(process.execPath, arguments_, {
    cwd: dossier,
    env: sansSecrets(),
    encoding: 'utf8',
  });

  return {
    code: resultat.status,
    sortie: resultat.stdout ?? '',
    erreur: resultat.stderr ?? '',
  };
}

for (const nom of SCRIPTS) {
  /** Chemin réel, pour LANCER le fichier : Node veut un chemin, pas une URL. */
  const chemin = fileURLToPath(new URL(`../scripts/${nom}`, import.meta.url));

  /** URL de fichier, pour l'IMPORTER : le dossier courant ne doit rien y changer. */
  const url = new URL(`../scripts/${nom}`, import.meta.url).href;

  describe(`contrat d'import de ${nom}`, () => {
    it("importé sans configuration, ne sort pas du processus et n'écrit rien", () => {
      const verdict = dansUnDossierVide((dossier) =>
        lancer(dossier, ['--input-type=module', '--eval', `await import(${JSON.stringify(url)});`]),
      );

      assert.equal(
        verdict.code,
        0,
        `L'import a échoué (code ${verdict.code}).\n` +
          `sortie : ${JSON.stringify(verdict.sortie)}\n` +
          `erreur : ${JSON.stringify(verdict.erreur)}`,
      );
      // Le contrat n'est pas seulement « ne pas sortir en erreur » : un import ne
      // doit RIEN écrire. Une ligne de journal au niveau du module passerait sinon
      // inaperçue, et c'est ce genre de bruit qui finit par cacher un vrai message.
      assert.equal(verdict.sortie, '', "L'import ne doit rien écrire sur la sortie standard.");
      assert.equal(verdict.erreur, '', "L'import ne doit rien écrire sur la sortie d'erreur.");
    });

    it('lancé sans configuration, refuse et nomme les deux variables', () => {
      const verdict = dansUnDossierVide((dossier) => lancer(dossier, [chemin]));

      assert.equal(
        verdict.code,
        1,
        `Le lancement aurait dû refuser (code ${verdict.code}).\n` +
          `sortie : ${JSON.stringify(verdict.sortie)}\n` +
          `erreur : ${JSON.stringify(verdict.erreur)}`,
      );
      assert.match(verdict.erreur, /Configuration absente/);
      // Nommer les variables fait partie du contrôle : un refus qui ne dit pas
      // quoi renseigner oblige à lire le script pour s'en servir.
      assert.match(verdict.erreur, /EXPO_PUBLIC_SUPABASE_URL/);
      assert.match(verdict.erreur, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
      // Rien ne doit avoir été tenté sur le réseau : le refus précède tout appel.
      assert.equal(verdict.sortie, '', 'Aucune requête ne doit partir sans configuration.');
    });
  });
}
