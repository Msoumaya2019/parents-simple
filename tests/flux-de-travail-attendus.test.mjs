/**
 * Le contrôle des flux de travail échoue-t-il quand un flux DISPARAÎT ?
 *
 * POURQUOI CE BANC EXISTE — ET CE QU'IL A COÛTÉ
 * --------------------------------------------
 * `scripts/check-workflows.mjs` découvre ses sujets par `readdirSync`. Il mesure
 * donc ce qui RESTE dans `.github/workflows`, jamais ce qui MANQUE. La garde
 * d'origine n'exigeait qu'« au moins un » flux : elle échouait si le dossier
 * était vidé, et laissait passer la disparition d'un seul fichier.
 *
 * Mesuré, avant correction : `ci.yml` écarté du dossier, le contrôle annonçait
 * « 67 vérifications sur 2 flux de travail — Tous les flux de travail sont
 * valides », code de sortie 0. Un tiers de son sujet avait disparu, dont le flux
 * qui lance tous les autres. Aucun autre contrôle du projet ne lit ces fichiers.
 *
 * Le défaut est SILENCIEUX — il produit un vert, pas un rouge — et c'est la
 * raison d'être de ce banc. Un contrôle dont la défaillance est silencieuse
 * s'éprouve par un test, jamais par une relecture.
 *
 * COMMENT IL ÉPROUVE LE CONTRÔLE
 * ------------------------------
 * Il reconstitue un dossier `.github/workflows` dans un dossier temporaire, et
 * lance le contrôle avec ce dossier pour répertoire courant. Le décor est un
 * flux MINIMAL mais VALIDE : sans cela le contrôle échouerait pour une autre
 * raison, et le banc ne mesurerait rien. Les assertions portent donc sur le
 * message attendu, jamais sur le seul code de sortie — un refus ne prouve rien
 * tant qu'on ne sait pas sur quoi il porte.
 *
 * Le troisième cas est le pendant du deuxième : un flux AJOUTÉ et non déclaré
 * doit échouer lui aussi. Sans lui, une garde qui refuserait tout serait
 * déclarée concluante.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const CHEMIN_CONTROLE = fileURLToPath(new URL('../scripts/check-workflows.mjs', import.meta.url));

//  Recopiés à dessein, et non importés du contrôle : ce que le banc vérifie,
//  c'est précisément que cette liste est tenue. La lire depuis le script qu'elle
//  éprouve rendrait l'accord vrai par construction.
//
//  C'est donc un PIÈGE, et il a fonctionné : ajouter `admin-pages.yml` au
//  contrôle a fait tomber les deux premiers cas. Le décor doit porter exactement
//  les noms attendus par le contrôle, sinon il échoue sur une absence qui n'a
//  rien à voir avec ce qu'on éprouve ici. Une seule liste à tenir : le décompte
//  et le titre se déduisent, pour qu'un flux ajouté ne demande qu'une ligne.
const FLUX_ATTENDUS = ['admin-pages.yml', 'android-apk.yml', 'ci.yml', 'ios-unsigned.yml'];

/** Un flux minimal mais valide : le contrôle ne doit rien y trouver à redire. */
const FLUX_VALIDE = [
  'name: Essai',
  'on: push',
  'permissions:',
  '  contents: read',
  'jobs:',
  '  travail:',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: Rien',
  '        run: echo bonjour',
  '',
].join('\n');

/** Écrit les flux donnés dans un dossier temporaire, et agit dessus. */
function dansUnDossier(noms, action) {
  const dossier = mkdtempSync(join(tmpdir(), 'fl-flux-'));
  try {
    const dossierFlux = join(dossier, '.github', 'workflows');
    mkdirSync(dossierFlux, { recursive: true });
    for (const nom of noms) {
      writeFileSync(join(dossierFlux, nom), FLUX_VALIDE, 'utf8');
    }
    return action(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

function lancer(dossier) {
  const verdict = spawnSync(process.execPath, [CHEMIN_CONTROLE], {
    cwd: dossier,
    encoding: 'utf8',
  });
  return { code: verdict.status, sortie: verdict.stdout, erreur: verdict.stderr };
}

describe('check-workflows face à un flux manquant', () => {
  it('tous les flux attendus présents : il passe', () => {
    const verdict = dansUnDossier(FLUX_ATTENDUS, lancer);

    assert.equal(verdict.code, 0, `attendu 0, obtenu ${verdict.code} — ${verdict.erreur}`);
    assert.match(verdict.sortie, new RegExp(`${FLUX_ATTENDUS.length} flux de travail`));
    assert.match(verdict.sortie, /Tous les flux de travail sont valides/);
  });

  it('un flux attendu écarté : il refuse, le nomme, et ne compte qu’un défaut', () => {
    const presents = FLUX_ATTENDUS.filter((nom) => nom !== 'ci.yml');
    const verdict = dansUnDossier(presents, lancer);

    assert.equal(verdict.code, 1, 'le contrôle devait échouer');
    assert.match(verdict.erreur, /flux attendu\(s\) absent\(s\)/);
    assert.match(verdict.erreur, /ci\.yml/);
    //  Un seul défaut : le décor est valide, donc le refus porte bien sur
    //  l'absence et sur rien d'autre.
    assert.match(verdict.erreur, /1 défaut\(s\)/);
  });

  it('un flux ajouté et non déclaré : il refuse et le nomme', () => {
    const verdict = dansUnDossier([...FLUX_ATTENDUS, 'essai.yml'], lancer);

    assert.equal(verdict.code, 1, 'le contrôle devait échouer');
    assert.match(verdict.erreur, /non déclaré\(s\)/);
    assert.match(verdict.erreur, /essai\.yml/);
    assert.match(verdict.erreur, /1 défaut\(s\)/);
  });
});
