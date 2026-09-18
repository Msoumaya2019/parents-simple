#!/usr/bin/env node
/**
 * Contrôle des flux de travail GitHub.
 *
 * POURQUOI CE CONTRÔLE EXISTE
 * ---------------------------
 * L'APK ne peut pas être compilé sur cette machine : le Java installé est en
 * version 8 et le SDK Android est absent. Chaque erreur dans un flux de travail
 * ne se découvre donc qu'après une vingtaine de minutes d'exécution distante,
 * et se paie en allers-retours.
 *
 * Deux familles de défauts sont attrapées ici, en deux secondes :
 *
 *   - un YAML invalide : le flux ne démarre même pas, et GitHub ne signale
 *     qu'une erreur de syntaxe, sans indiquer laquelle ;
 *   - un script `run:` invalide : le YAML est correct, le flux démarre, et
 *     l'échec survient après l'installation de Java, du SDK Android et des
 *     dépendances. C'est le cas le plus coûteux.
 *
 * La syntaxe des scripts est vérifiée par `bash -n`, qui analyse sans exécuter.
 * Les expressions `${{ ... }}` sont remplacées par une valeur neutre : elles
 * sont résolues par GitHub avant l'exécution, et `bash` ne saurait pas les lire.
 *
 * Usage : node scripts/check-workflows.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse } from 'yaml';

const DOSSIER = '.github/workflows';

const defauts = [];
const verifications = [];

function verifier(description, condition, defaut) {
  verifications.push(description);
  if (!condition) {
    defauts.push(defaut ?? description);
  }
}

/** Remplace les expressions GitHub par une valeur que `bash` sait lire. */
function neutraliser(script) {
  return script.replace(/\$\{\{[^}]*\}\}/g, 'VALEUR');
}

/** Analyse un script avec `bash -n`, sans l'exécuter. */
function verifierSyntaxe(script) {
  const dossier = mkdtempSync(join(tmpdir(), 'fl-workflow-'));
  const fichier = join(dossier, 'script.sh');
  try {
    writeFileSync(fichier, neutraliser(script), 'utf8');
    execFileSync('bash', ['-n', fichier], { stdio: 'pipe' });
    return null;
  } catch (cause) {
    const sortie = `${cause.stderr ?? ''}${cause.stdout ?? ''}`.trim();
    return sortie.split('\n').slice(0, 4).join('\n');
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

//  LES FLUX ATTENDUS, NOMMÉS — ET LA RAISON
//  ----------------------------------------
//  La garde précédente n'exigeait qu'« au moins un » flux : elle échouait si le
//  dossier était vidé, et laissait passer la disparition d'UN SEUL fichier.
//
//  Mesuré, avant correction : `ci.yml` écarté du dossier, le contrôle annonçait
//  « 67 vérifications sur 2 flux de travail — Tous les flux de travail sont
//  valides », code de sortie 0. Un tiers de son sujet avait disparu, dont le
//  flux qui lance tous les autres.
//
//  C'est la forme générale du défaut : un contrôle qui découvre ses sujets par
//  `readdir` mesure ce qui RESTE, jamais ce qui MANQUE. Le nombre de
//  vérifications baisse, et rien ne le compare à un attendu. Un contrôle de
//  couverture doit dire où il s'arrête.
//
//  La liste est donc fermée, comme celle de `admin:check` : un fichier absent
//  échoue, et un fichier AJOUTÉ échoue aussi tant qu'il n'est pas déclaré ici.
//  Déclarer est le prix, et il est utile : il force à se demander si le nouveau
//  flux doit tourner dans les trois chaînes ou seulement dans une.
const FLUX_ATTENDUS = ['android-apk.yml', 'ci.yml', 'ios-unsigned.yml'];

//  `readdirSync` ne garantit aucun ordre : trier rend les messages stables d'une
//  machine à l'autre, ce dont un test a besoin pour comparer une sortie.
const fichiers = readdirSync(DOSSIER)
  .filter((nom) => nom.endsWith('.yml') || nom.endsWith('.yaml'))
  .sort();

const manquants = FLUX_ATTENDUS.filter((nom) => !fichiers.includes(nom));
const nonDeclares = fichiers.filter((nom) => !FLUX_ATTENDUS.includes(nom));

verifier(
  `les ${FLUX_ATTENDUS.length} flux de travail attendus sont présents`,
  manquants.length === 0,
  `${DOSSIER} : flux attendu(s) absent(s) — ${manquants.join(', ')}. Un flux qui disparaît ne se signale pas autrement : le contrôle mesure ce qui reste.`,
);

verifier(
  'aucun flux de travail non déclaré',
  nonDeclares.length === 0,
  `${DOSSIER} : flux non déclaré(s) — ${nonDeclares.join(', ')}. Les ajouter à FLUX_ATTENDUS dans scripts/check-workflows.mjs.`,
);

for (const nom of fichiers) {
  const chemin = join(DOSSIER, nom);
  const source = readFileSync(chemin, 'utf8');

  let flux;
  try {
    flux = parse(source);
  } catch (cause) {
    defauts.push(`${nom} : YAML invalide — ${cause.message.split('\n')[0]}`);
    continue;
  }

  verifier(`${nom} : structure lisible`, typeof flux === 'object' && flux !== null);

  // En YAML 1.2, `on` reste une chaîne. S'il devenait un booléen, c'est que
  // l'analyseur applique le schéma 1.1 — le flux ne se déclencherait jamais.
  verifier(
    `${nom} : déclencheur « on » présent`,
    flux.on !== undefined && typeof flux.on !== 'boolean',
    `${nom} : le déclencheur « on » est absent ou mal interprété.`,
  );

  verifier(`${nom} : nom lisible`, typeof flux.name === 'string' && flux.name.length > 0);

  verifier(
    `${nom} : permissions déclarées`,
    flux.permissions !== undefined,
    `${nom} : aucune permission déclarée. Les droits par défaut du jeton sont plus larges que nécessaire.`,
  );

  const travaux = flux.jobs ?? {};
  verifier(`${nom} : au moins un travail`, Object.keys(travaux).length > 0);

  for (const [idTravail, travail] of Object.entries(travaux)) {
    const prefixe = `${nom} → ${idTravail}`;

    verifier(
      `${prefixe} : « runs-on » présent`,
      typeof travail['runs-on'] === 'string' && travail['runs-on'].length > 0,
    );

    verifier(
      `${prefixe} : étapes présentes`,
      Array.isArray(travail.steps) && travail.steps.length > 0,
    );

    for (const [index, etape] of (travail.steps ?? []).entries()) {
      const etiquette = etape.name ?? `étape ${index + 1}`;
      const ou = `${prefixe} → ${etiquette}`;

      if (etape.uses !== undefined) {
        // Une action non épinglée peut changer de comportement, ou être
        // détournée, sans qu'aucune ligne du dépôt n'ait bougé.
        verifier(
          `${ou} : action épinglée`,
          /@/.test(etape.uses),
          `${ou} : l'action « ${etape.uses} » n'est pas épinglée à une version.`,
        );
      }

      if (etape.run !== undefined) {
        verifier(
          `${ou} : script non vide`,
          etape.run.trim().length > 0,
          `${ou} : le script est vide.`,
        );

        const erreur = verifierSyntaxe(etape.run);
        verifier(
          `${ou} : syntaxe du script valide`,
          erreur === null,
          `${ou} : syntaxe invalide.\n${erreur}`,
        );
      }

      if (etape.uses === undefined && etape.run === undefined) {
        defauts.push(`${ou} : ni « uses » ni « run » — l'étape ne fait rien.`);
      }
    }
  }
}

console.log(`${verifications.length} vérifications sur ${fichiers.length} flux de travail`);

if (defauts.length > 0) {
  console.error('');
  console.error(`${defauts.length} défaut(s) :`);
  for (const defaut of defauts) {
    console.error(`  - ${defaut}`);
  }
  process.exit(1);
}

console.log('Tous les flux de travail sont valides.');
