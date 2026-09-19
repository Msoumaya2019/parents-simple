/**
 * Les deux listes du contrôle de sécurité disent-elles la vérité sur les droits
 * que les migrations accordent ?
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `npm run securite:api` classait `est_membre_bureau` parmi les fonctions
 * attendues en **404**, avec ce raisonnement : elle n'est accordée qu'au rôle
 * `authenticated`, donc « PostgREST ne la trouve pas ». Mesuré : faux. Le cache
 * de schéma de PostgREST est bâti sur l'ensemble des rôles ; une fonction
 * accordée à un seul rôle y est PRÉSENTE, et `anon` reçoit **401**.
 *
 * Ce classement était donc vert pour rien : tant que la migration n'était pas
 * appliquée, `est_membre_bureau` n'existait pas et le 404 attendu arrivait pour
 * la mauvaise raison. Le jour où la fonction a existé — mesuré en intégration
 * continue, passage du 19 septembre 2026 — le contrôle est devenu rouge en
 * accusant le seul état correct.
 *
 * CE QUE CE BANC TIENT
 * --------------------
 *   1. Le verdict rendu pour un statut : 404 = absente, 401 et 403 = refusée,
 *      tout le reste = appelable — et 200 n'est jamais ni l'un ni l'autre.
 *   2. L'accord entre les deux listes du contrôle et les `revoke` / `grant` des
 *      migrations. Une fonction sans aucun droit doit l'être pour TOUS les rôles,
 *      sinon elle serait au cache et répondrait 401, pas 404.
 *   3. L'accord entre ces droits et ce que le code appelle réellement : les
 *      fonctions appelées depuis `src/` — l'application, qui n'a pas de session
 *      et tourne donc en `anon` — doivent être exécutables par `anon` ; celles
 *      appelées depuis `admin/` doivent l'être par `authenticated`. Et
 *      réciproquement : rien ne doit être exécutable par la clé publique sans
 *      que l'application l'appelle.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Il lit le SQL et le TypeScript par motifs ; il n'exécute rien. Il ne dit pas
 * quel statut PostgREST rend vraiment — cela ne se mesure que contre la base,
 * et c'est ce que fait `npm run securite:api`. Il tient seulement que les
 * attentes écrites dans le contrôle ne se contredisent pas avec les droits que
 * les migrations posent, et que le code ne dépend pas d'un droit absent.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE,
  FONCTIONS_SANS_AUCUN_DROIT,
  verdictSurFonctionAdministrative,
} from '../scripts/verifier-securite-api.mjs';

const DOSSIER_MIGRATIONS = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/** Un commentaire de ligne n'est pas une instruction. */
const sansCommentaires = (source) => source.replace(/--[^\n]*/g, '');

/** Tous les fichiers sous un dossier, récursivement. */
function fichiersDe(dossier) {
  const sortie = [];
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) sortie.push(...fichiersDe(chemin));
    else sortie.push(chemin);
  }
  return sortie;
}

/** Les fonctions appelées par un paquet, via le SDK : `client.rpc('nom', …)`. */
function fonctionsAppelees(dossier) {
  const noms = new Set();
  for (const fichier of fichiersDe(fileURLToPath(new URL(`../${dossier}`, import.meta.url)))) {
    if (!/\.tsx?$/.test(fichier)) continue;
    const source = readFileSync(fichier, 'utf8');
    for (const m of source.matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)) noms.add(m[1]);
  }
  return noms;
}

/**
 * Les droits que les migrations posent sur chaque fonction.
 *
 * `revoques` et `accordes` sont les rôles nommés dans les `revoke` et les
 * `grant`. Ils sont lus, jamais supposés : c'est l'objet même de ce banc.
 */
function droitsDesFonctions() {
  const droits = new Map();
  const obtenir = (nom) => {
    if (!droits.has(nom)) droits.set(nom, { revoques: new Set(), accordes: new Set() });
    return droits.get(nom);
  };
  const roles = (liste) =>
    liste
      .split(',')
      .map((r) => r.trim().toLowerCase())
      .filter((r) => r !== '');

  for (const fichier of readdirSync(DOSSIER_MIGRATIONS).filter((f) => f.endsWith('.sql'))) {
    const source = sansCommentaires(readFileSync(join(DOSSIER_MIGRATIONS, fichier), 'utf8'));
    for (const m of source.matchAll(
      /\brevoke\s+\w+\s+on\s+function\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s+from\s+([^;]+);/gi,
    )) {
      for (const role of roles(m[2])) obtenir(m[1]).revoques.add(role);
    }
    for (const m of source.matchAll(
      /\bgrant\s+\w+\s+on\s+function\s+public\.([a-z0-9_]+)\s*\([^)]*\)\s+to\s+([^;]+);/gi,
    )) {
      for (const role of roles(m[2])) obtenir(m[1]).accordes.add(role);
    }
    for (const m of source.matchAll(
      /\bcreate\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi,
    )) {
      obtenir(m[1]);
    }
  }
  return droits;
}

/**
 * Ce rôle peut-il exécuter cette fonction ?
 *
 * Supabase accorde `execute` à `anon` et `authenticated` sur toute fonction
 * nouvelle — c'est un `alter default privileges` de la plateforme. Une fonction
 * créée sans le moindre `revoke` est donc exécutable par la clé publique, et
 * c'est pourquoi le `revoke` explicite compte autant que le `grant`.
 */
function peutExecuter(droits, role) {
  if (droits.accordes.has(role) || droits.accordes.has('public')) return true;
  return !droits.revoques.has(role);
}

const DROITS = droitsDesFonctions();
const DEFINIES = [...DROITS.keys()].sort();
const EXECUTABLES_PAR_ANON = DEFINIES.filter((nom) => peutExecuter(DROITS.get(nom), 'anon'));
const EXECUTABLES_PAR_AUTHENTICATED = DEFINIES.filter((nom) =>
  peutExecuter(DROITS.get(nom), 'authenticated'),
);

const APPELANTS = {
  'l’application (src/)': { dossier: 'src', role: 'anon' },
  'l’administration (admin/src/)': { dossier: 'admin/src', role: 'authenticated' },
};

describe('Le verdict d’un statut', () => {
  const ATTENDUS = {
    404: 'absente',
    401: 'refusee',
    403: 'refusee',
    200: 'appelable',
    201: 'appelable',
    400: 'appelable',
    500: 'appelable',
  };

  for (const [statut, verdict] of Object.entries(ATTENDUS)) {
    it(`HTTP ${statut} se lit « ${verdict} »`, () => {
      assert.equal(verdictSurFonctionAdministrative(Number(statut)), verdict);
    });
  }

  it('un 200 n’est jamais pris pour une absence ni pour un refus', () => {
    // Le seul verdict dangereux : la fonction répond à n'importe qui. Aucune
    // confusion ne doit pouvoir le faire passer pour un succès du contrôle.
    const verdict = verdictSurFonctionAdministrative(200);
    assert.notEqual(verdict, 'absente');
    assert.notEqual(verdict, 'refusee');
  });
});

describe('Les listes du contrôle s’accordent avec les droits des migrations', () => {
  it('les deux listes sont disjointes', () => {
    const communes = FONCTIONS_SANS_AUCUN_DROIT.filter((nom) =>
      FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE.includes(nom),
    );
    assert.deepEqual(communes, [], 'une fonction ne peut pas être attendue absente ET refusée');
  });

  it('chaque nom des listes est défini par une migration', () => {
    for (const nom of [...FONCTIONS_SANS_AUCUN_DROIT, ...FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE]) {
      assert.ok(
        DROITS.has(nom),
        `${nom} est attendu par le contrôle mais aucune migration ne le crée : ` +
          'le contrôle se prononcerait sur une fonction qui n’existe pas.',
      );
    }
  });

  for (const nom of FONCTIONS_SANS_AUCUN_DROIT) {
    it(`${nom} n’est exécutable par aucun rôle`, () => {
      // Sinon elle serait au cache de schéma et répondrait 401 : l'attente de
      // 404 serait fausse, et le contrôle accuserait un état correct.
      const droits = DROITS.get(nom);
      for (const role of ['anon', 'authenticated']) {
        assert.equal(
          peutExecuter(droits, role),
          false,
          `${nom} est exécutable par ${role} : PostgREST la mettrait au cache et ` +
            'répondrait 401, pas le 404 attendu.',
        );
      }
    });
  }

  for (const nom of FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE) {
    it(`${nom} est refusée à la clé publique, mais exécutable par un rôle`, () => {
      const droits = DROITS.get(nom);
      assert.equal(
        peutExecuter(droits, 'anon'),
        false,
        `${nom} est exécutable par anon : le contrôle attendrait un refus là où la ` +
          'fonction répond, et la clé publique pourrait l’appeler.',
      );
      assert.ok(
        ['anon', 'authenticated'].some((role) => peutExecuter(droits, role)),
        `${nom} n’est exécutable par aucun rôle : elle serait absente du cache et ` +
          'répondrait 404, pas le 401 attendu.',
      );
    });
  }

  it('aucune fonction définie par une migration n’échappe aux deux listes', () => {
    const sansDroitDAcces = DEFINIES.filter((nom) => !peutExecuter(DROITS.get(nom), 'anon'));
    const attendues = [
      ...FONCTIONS_SANS_AUCUN_DROIT,
      ...FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE,
    ].sort();
    assert.deepEqual(
      sansDroitDAcces,
      attendues,
      'une fonction inaccessible à la clé publique doit être attendue par le contrôle, ' +
        'sinon rien ne vérifie qu’elle le reste.',
    );
  });
});

describe('Les droits s’accordent avec ce que le code appelle', () => {
  for (const [intitule, { dossier, role }] of Object.entries(APPELANTS)) {
    it(`${intitule} n’appelle que des fonctions exécutables par ${role}`, () => {
      const appelees = [...fonctionsAppelees(dossier)].sort();
      assert.ok(
        appelees.length > 0,
        `aucun appel rpc trouvé dans ${dossier} : le contrôle suivant serait vert sur du vide.`,
      );
      const executables = role === 'anon' ? EXECUTABLES_PAR_ANON : EXECUTABLES_PAR_AUTHENTICATED;
      for (const nom of appelees) {
        assert.ok(
          executables.includes(nom),
          `${dossier} appelle ${nom}, que ${role} ne peut pas exécuter : ` +
            'l’écran échouerait en production sans qu’aucun contrôle ne le dise.',
        );
      }
    });
  }

  it('rien n’est exécutable par la clé publique sans que l’application l’appelle', () => {
    // La direction qui protège : chaque droit accordé à `anon` est une porte
    // ouverte à quiconque extrait la clé de l'APK. Elle ne doit exister que
    // parce qu'un écran en a besoin.
    const appelees = [...fonctionsAppelees('src')].sort();
    assert.deepEqual(
      EXECUTABLES_PAR_ANON,
      appelees,
      'la clé publique peut exécuter une fonction que l’application n’appelle pas : ' +
        'surface ouverte sans usage.',
    );
  });

  it('une fonction créée sans aucun revoke serait exécutable par la clé publique', () => {
    // Le cas qui rend le `revoke` explicite nécessaire : Supabase accorde
    // `execute` par défaut. Sans ce cas, on ne saurait pas si le banc mesure le
    // défaut de la plateforme ou seulement les `grant` écrits à la main.
    const droits = { revoques: new Set(), accordes: new Set() };
    assert.equal(peutExecuter(droits, 'anon'), true);
    assert.equal(peutExecuter({ revoques: new Set(['anon']), accordes: new Set() }, 'anon'), false);
  });
});
