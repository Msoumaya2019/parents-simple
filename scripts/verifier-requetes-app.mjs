#!/usr/bin/env node
/**
 * Rejoue contre la base RÉELLE les requêtes que l'application adresse vraiment.
 *
 * POURQUOI CE CONTRÔLE EXISTE
 * ---------------------------
 * `verifier-securite-api.mjs` vérifie ce qu'un inconnu muni de la clé publique ne
 * peut PAS faire. C'est l'autre moitié du problème : rien ne vérifie que ce que
 * l'application FAIT fonctionne.
 *
 * Or les deux défaillances ne se ressemblent pas :
 *
 *   - une table ouverte se voit dans un contrôle de sécurité ;
 *   - une colonne mal orthographiée, un filtre sur un type incompatible, une
 *     colonne renommée dans le schéma — tout cela donne un **400** que
 *     `executer()` transforme en message d'erreur… ou, si l'erreur est avalée,
 *     un écran « aucune donnée ». Aucun test unitaire ne le voit, puisque les
 *     tests simulent la base. Le défaut n'apparaît qu'après installation, sur un
 *     téléphone, sous la forme d'un onglet vide.
 *
 * CE QUE CE SCRIPT VÉRIFIE
 * ------------------------
 * Les requêtes sont **extraites du code**, pas recopiées : un service ajouté
 * demain entre dans l'analyse sans qu'on ait à y penser. Pour chaque chaîne
 * `client().from('table').select(COLONNES)…`, il rejoue la requête équivalente
 * en HTTP contre PostgREST et exige un 200.
 *
 * Il vérifie aussi les compartiments de stockage nommés par le code : un
 * compartiment absent rend tous les liens de documents morts, et rien dans le
 * schéma des tables ne le signale. Leur **nom** est extrait comme le reste — une
 * version antérieure le portait en dur, et aurait donc laissé passer un
 * renommage, en sondant un compartiment disparu.
 *
 * Il vérifie enfin que la formulation qui désigne un objet absent est **la même**
 * dans `src/services/documents.ts` et ici. Deux copies d'une même vérité, dans
 * deux fichiers qui ne peuvent pas se lire, finissent par diverger — et cette
 * divergence-là serait muette : l'écran cesserait simplement de reconnaître
 * l'absence, et ouvrirait un onglet sur du JSON.
 *
 * Ce dernier contrôle lit le motif **dans le corps de `fichierAbsent`**, et non
 * dans le fichier. La première version cherchait la chaîne n'importe où dans le
 * fichier (`source.includes(...)`) : falsifiée, elle restait verte alors que le
 * motif avait été recopié dans un commentaire et que la fonction cherchait autre
 * chose. Elle annonçait donc un accord qu'elle ne mesurait pas.
 * `tests/accord-motif-objet-absent.test.mjs` tient les deux sens, et le contrat
 * d'import du fichier est éprouvé par `tests/import-sans-configuration.test.mjs`.
 *
 * CE QU'IL NE VÉRIFIE PAS — À SAVOIR AVANT DE LIRE UN VERT
 * --------------------------------------------------------
 * Les chemins de SUCCÈS de `voter` et `envoyer_message` ne sont vérifiés nulle
 * part. `verifier-securite-api.mjs` n'éprouve que leurs refus : voter sur un
 * sondage inexistant, envoyer un sujet vide. Or ce sont les chemins de succès
 * que les parents empruntent. Les éprouver demande un sondage ouvert et un
 * message réellement déposé, donc des écritures : c'est un complément à écrire,
 * pas un oubli à couvrir d'un vert.
 *
 * Tant qu'il n'existe pas, un `voter` cassé ne serait découvert qu'au premier
 * sondage — mais il le serait **avec un message**, pas en silence : `SondageCard`
 * attrape l'erreur et l'affiche sous la question, et l'écran Contact fait de même.
 * Le risque est donc d'apprendre le défaut tard, pas qu'il passe inaperçu.
 * C'est une différence de nature, et elle vaut la peine d'être dite : elle
 * change ce qu'on redoute, pas seulement ce qu'on ignore.
 *
 * Usage :
 *   npm run verifier:requetes
 *
 * Variables lues dans l'environnement, ou dans `.env.local` :
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DOSSIER_SERVICES = 'src/services';
const DELAI_MS = 20_000;

/**
 * La formulation par laquelle Supabase Storage dit qu'un objet n'existe pas.
 *
 * Mesurée sur la base réelle : `{"statusCode":"404","error":"not_found",
 * "message":"Object not found","code":"NoSuchKey"}`, sous un statut HTTP 400.
 *
 * `src/services/documents.ts` s'appuie sur la MÊME formulation pour décider
 * d'afficher « Ce document n'est plus disponible » plutôt que de confier
 * l'adresse au navigateur et d'ouvrir un onglet sur ce JSON. Ce sont deux
 * copies d'une même vérité, dans deux fichiers qui ne peuvent pas se lire : un
 * contrôle plus bas vérifie qu'elles s'accordent.
 *
 * Elle est EXPORTÉE pour que le banc puisse la comparer à sa propre copie. Le
 * banc ne l'importe pas pour s'en servir : il la confronte. Lire la valeur depuis
 * ce qu'on éprouve rendrait l'accord vrai par construction, et c'est le défaut
 * que `tests/flux-de-travail-attendus.test.mjs` a déjà refusé ailleurs.
 */
export const MOTIF_OBJET_ABSENT = 'NoSuchKey|Object not found';

/** Valeurs de remplacement, par type de colonne. */
const VALEURS = {
  // `debut_le` est un `timestamptz` : une date nue serait refusée par la base,
  // et l'échec ne dirait rien de ce qu'on veut vérifier.
  instant: '2026-01-01T00:00:00Z',
  jour: '2026-01-01',
  uuid: '00000000-0000-0000-0000-000000000000',
};

const resultats = [];

function journaliser(nom, ok, detail = '') {
  resultats.push({ nom, ok });
  console.log(`[${ok ? 'OK   ' : 'ECHEC'}] ${nom}${detail ? ` — ${detail}` : ''}`);
}

function lireEnvLocal() {
  const valeurs = {};
  try {
    for (const ligne of readFileSync('.env.local', 'utf8').split('\n')) {
      const propre = ligne.trim();
      if (propre === '' || propre.startsWith('#')) continue;
      const separateur = propre.indexOf('=');
      if (separateur === -1) continue;
      valeurs[propre.slice(0, separateur).trim()] = propre.slice(separateur + 1).trim();
    }
  } catch {
    // Absent : les variables d'environnement suffisent.
  }
  return valeurs;
}

const envLocal = lireEnvLocal();
const URL_BASE = (
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  envLocal.EXPO_PUBLIC_SUPABASE_URL ??
  ''
).replace(/\/+$/, '');
const CLE =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? envLocal.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Refuse de continuer sans configuration. Appelée par `main()`, JAMAIS au niveau
 * du module.
 *
 * POURQUOI CE DÉPLACEMENT
 * -----------------------
 * Ce refus vivait au niveau du module, où il s'exécute AVANT toute garde
 * d'import : un fichier qui ne peut pas être importé ne peut pas être éprouvé,
 * et un contrôle qu'aucun banc ne charge est un contrôle qu'on croit sur parole.
 * Le script voisin a payé exactement cette erreur — `verifier-securite-api.mjs`
 * a fait échouer l'intégration continue avec un `process.exit(1)` resté dehors,
 * et c'est `tests/import-sans-configuration.test.mjs` qui l'a révélé.
 *
 * La leçon vaut pour tout le fichier : une garde ne protège que ce qu'elle
 * enveloppe. Ce qui reste au niveau du module s'exécute à l'import, quoi qu'on
 * écrive plus bas.
 */
function verifierConfiguration() {
  if (URL_BASE === '' || CLE === '') {
    console.error('::error::Configuration absente.');
    console.error('Renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.');
    process.exit(1);
  }
}

async function appeler(chemin, options = {}) {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${URL_BASE}${chemin}`, {
      ...options,
      signal: controleur.signal,
      headers: {
        apikey: CLE,
        Authorization: `Bearer ${CLE}`,
        ...(options.headers ?? {}),
      },
    });
    const texte = await reponse.text();
    let corps = null;
    try {
      corps = JSON.parse(texte);
    } catch {
      corps = texte;
    }
    return { statut: reponse.status, corps };
  } finally {
    clearTimeout(minuterie);
  }
}

function messageDe(corps) {
  if (corps === null) return '';
  if (typeof corps === 'string') return corps.slice(0, 200);
  return corps.message ?? corps.error ?? JSON.stringify(corps).slice(0, 200);
}

/**
 * Extrait les requêtes de lecture de la couche d'accès aux données.
 *
 * Volontairement simple : on lit les constantes de colonnes, puis chaque chaîne
 * `from(...).select(...)` et les appels qui la suivent. Une analyse syntaxique
 * complète serait plus juste et bien plus fragile ; ce qui compte est qu'une
 * requête ajoutée soit vue.
 */
/** Les constantes chaînes du fichier : `const NOM = 'valeur'`. */
function constantesDe(source) {
  const constantes = new Map();
  for (const m of source.matchAll(/const\s+(\w+)\s*=\s*'([^']*)'/g)) {
    constantes.set(m[1], m[2]);
  }
  return constantes;
}

function extraireRequetes(source) {
  const constantes = constantesDe(source);

  const requetes = [];
  const motif = /\.from\('(\w+)'\)\s*\.select\(\s*(?:'([^']*)'|(\w+))\s*\)/g;

  for (const m of source.matchAll(motif)) {
    const [, table, litteral, nomConstante] = m;
    const colonnes = litteral ?? constantes.get(nomConstante);
    if (colonnes === undefined) continue;

    // Les appels qui suivent le `select`, jusqu'au prochain `from(`.
    const reste = source.slice(m.index + m[0].length);
    const fin = reste.indexOf('.from(');
    const suite = fin === -1 ? reste : reste.slice(0, fin);

    const filtres = [];
    const ordres = [];
    for (const f of suite.matchAll(/\.(eq|gte|gt|lte|lt|neq)\('(\w+)'/g)) {
      filtres.push({ operateur: f[1], colonne: f[2] });
    }
    for (const o of suite.matchAll(/\.order\('(\w+)',\s*\{\s*ascending:\s*(true|false)/g)) {
      ordres.push({ colonne: o[1], ascendant: o[2] === 'true' });
    }

    const limite = suite.match(/\.limit\((\d+)\)/);

    requetes.push({
      table,
      colonnes,
      filtres,
      ordres,
      limite: limite ? Number(limite[1]) : null,
    });
  }

  return requetes;
}

/**
 * Les compartiments de stockage nommés par la couche d'accès aux données.
 *
 * Le nom est EXTRAIT du code pour la même raison que les requêtes. Une première
 * version de ce script portait `COMPARTIMENT = 'documents'` en dur : renommer le
 * compartiment dans le service aurait laissé le contrôle vert, en train de
 * sonder un compartiment qui n'existe plus. Le script aurait violé son propre
 * principe — extraire plutôt que recopier — sur le seul point qu'aucune requête
 * de table ne couvre.
 *
 * Le service écrit `storage.from(COMPARTIMENT)`, nom passé par constante : il
 * faut donc résoudre la constante, pas seulement lire un littéral.
 */
function extraireCompartiments(source) {
  const constantes = constantesDe(source);

  const noms = new Set();
  for (const m of source.matchAll(/\.storage\s*\.from\(\s*(?:'([^']+)'|(\w+))\s*\)/g)) {
    const nom = m[1] ?? constantes.get(m[2]);
    if (nom !== undefined) noms.add(nom);
  }
  return [...noms];
}

/** Valeur de remplacement, choisie d'après le nom et l'opérateur. */
function valeurPour(colonne) {
  if (colonne === 'id') return VALEURS.uuid;
  if (colonne === 'debut_le' || colonne === 'fin_le') return VALEURS.instant;
  return VALEURS.jour;
}

function construireRequete({ table, colonnes, filtres, ordres }) {
  const parametres = new URLSearchParams();
  parametres.set('select', colonnes);

  for (const { colonne, ascendant } of ordres) {
    const existant = parametres.get('order');
    const morceau = `${colonne}.${ascendant ? 'asc' : 'desc'}`;
    parametres.set('order', existant === null ? morceau : `${existant},${morceau}`);
  }

  for (const { operateur, colonne } of filtres) {
    parametres.set(colonne, `${operateur}.${valeurPour(colonne)}`);
  }

  // Une seule ligne suffit : on vérifie la forme de la requête, pas son volume.
  parametres.set('limit', '1');

  return `/rest/v1/${table}?${parametres.toString()}`;
}

/**
 * Le corps d'une fonction déclarée, lu dans un source JavaScript.
 *
 * Renvoie `null` si la déclaration est absente. L'appelant doit distinguer ce
 * cas d'un corps vide : les deux disent des choses différentes — « la fonction a
 * disparu » et « la fonction ne dit plus rien ».
 *
 * Le comptage d'accolades ignore ce qui se trouverait dans une chaîne ou un
 * commentaire, et c'est assumé : `fichierAbsent` tient en une ligne, et une
 * analyse lexicale complète serait plus fragile que ce qu'elle protège. Le jour
 * où la fonction gagne une accolade dans une chaîne, c'est le banc qui le dit.
 *
 * L'ancre exige une déclaration en début de ligne, `export` facultatif : sans
 * elle, une phrase de commentaire citant `function fichierAbsent(` ferait lire
 * le commentaire à la place du code — exactement le défaut que ce contrôle
 * corrige.
 */
function corpsDeFonction(source, nom) {
  const declaration = new RegExp(`^(?:export\\s+)?function\\s+${nom}\\s*\\(`, 'm').exec(source);
  if (declaration === null) return null;

  const ouvrante = source.indexOf('{', declaration.index);
  if (ouvrante === -1) return null;

  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i += 1) {
    if (source[i] === '{') profondeur += 1;
    else if (source[i] === '}') {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(ouvrante + 1, i);
    }
  }
  return null;
}

/**
 * Le motif que `fichierAbsent` emploie RÉELLEMENT pour reconnaître un objet
 * absent, et les drapeaux qui l'accompagnent.
 *
 * POURQUOI LIRE LE CORPS, ET NON LE FICHIER
 * -----------------------------------------
 * Ce contrôle lisait auparavant le fichier entier :
 * `sourceService.includes(MOTIF_OBJET_ABSENT)`. Cette forme ne prouvait rien, et
 * la falsification l'a montré : le motif recopié dans un commentaire et la
 * fonction cherchant tout autre chose, le contrôle restait VERT. Il annonçait
 * une formulation « partagée » alors que l'écran ne reconnaissait plus rien.
 *
 * Un contrôle qui compte doit lire ce qui décide, jamais ce qui traîne. C'est la
 * même leçon que pour une valeur citée en commentaire : la citer n'est pas
 * l'employer.
 *
 * Les drapeaux sont lus eux aussi, pour la même raison : un motif identique privé
 * du `i` ne reconnaîtrait plus `NOSUCHKEY`, et l'écran ouvrirait un onglet sur du
 * JSON sans que personne ne s'en aperçoive.
 */
export function formulationDeLAbsence(sourceService) {
  const corps = corpsDeFonction(sourceService, 'fichierAbsent');
  if (corps === null) return null;

  const trouve = /return\s+\/(.*)\/([gimsuy]*)\s*\.test\s*\(/.exec(corps);
  if (trouve === null) return null;

  return { motif: trouve[1], drapeaux: trouve[2] };
}

/**
 * L'accord entre la formulation de ce contrôle et celle de l'application.
 *
 * Renvoie `{ ok, detail }` plutôt qu'un booléen : un refus doit dire SUR QUOI il
 * porte. Un `false` nu obligerait à ouvrir le fichier pour comprendre, et c'est
 * précisément ce qu'un contrôle automatique doit épargner.
 */
export function accordDeFormulation(sourceService, motifAttendu) {
  const trouvee = formulationDeLAbsence(sourceService);

  if (trouvee === null) {
    return {
      ok: false,
      detail:
        'fichierAbsent est introuvable dans le service, ou n’y porte plus de motif ' +
        'lisible — le contrôle ne peut donc plus comparer quoi que ce soit',
    };
  }

  if (trouvee.motif !== motifAttendu) {
    return {
      ok: false,
      detail: `l’application cherche « ${trouvee.motif} », ce contrôle cherche « ${motifAttendu} »`,
    };
  }

  if (!trouvee.drapeaux.includes('i')) {
    return {
      ok: false,
      detail:
        `l’application cherche « ${trouvee.motif} » sans le drapeau i ` +
        `(drapeaux : ${trouvee.drapeaux === '' ? 'aucun' : trouvee.drapeaux})`,
    };
  }

  return { ok: true, detail: '' };
}

async function main() {
  verifierConfiguration();

  console.log(`Base interrogée : ${URL_BASE}`);
  console.log('');

  // --- 1. Les requêtes de lecture ---------------------------------------
  const fichiers = readdirSync(DOSSIER_SERVICES)
    .filter((nom) => nom.endsWith('.ts'))
    .sort();

  const requetes = [];
  const sansRequete = [];
  const compartiments = new Set();
  for (const fichier of fichiers) {
    const source = readFileSync(join(DOSSIER_SERVICES, fichier), 'utf8');
    for (const nom of extraireCompartiments(source)) {
      compartiments.add(nom);
    }
    const trouvees = extraireRequetes(source);
    for (const requete of trouvees) {
      requetes.push({ ...requete, fichier });
    }
    // Un fichier qui interroge une table doit livrer au moins une requête.
    // Sans cette règle, un service qui sortirait de l'analyse — expression
    // devenue trop stricte, forme d'écriture inattendue — disparaîtrait
    // SILENCIEUSEMENT : le total baisserait d'une unité et le contrôle
    // resterait vert. Un seuil global ne voit pas une perte unitaire ; ce
    // fichier-ci la voit.
    //
    // Le témoin est `.from(` sans la citation : une table passée par variable
    // (`.from(TABLE)`) doit déclencher l'alerte, et non passer pour un fichier
    // sans requête. `client.ts` et `messages.ts` n'appellent jamais `.from(`
    // — le premier centralise la lecture, le second ne fait que du `rpc` —
    // et sont donc légitimement à zéro.
    if (trouvees.length === 0 && source.includes('.from(')) {
      sansRequete.push(fichier);
    }
  }

  if (requetes.length === 0 || sansRequete.length > 0) {
    console.error(`::error::analyse incomplète : ${requetes.length} requête(s) extraite(s).`);
    for (const fichier of sansRequete) {
      console.error(`  ${fichier} interroge une table mais aucune requête n'en a été extraite.`);
    }
    console.error("L'analyse de la couche d'accès aux données ne fonctionne plus.");
    process.exit(1);
  }

  // Même panne silencieuse du côté du stockage : un compartiment que le code
  // nomme mais que l'analyse ne retrouve plus laisserait le contrôle sans rien
  // à sonder, et vert.
  if (compartiments.size === 0) {
    console.error('::error::aucun compartiment de stockage extrait.');
    console.error("L'analyse de la couche d'accès aux données ne fonctionne plus.");
    process.exit(1);
  }

  console.log(`Requêtes extraites de ${fichiers.length} fichier(s) : ${requetes.length}`);
  console.log(`Compartiment(s) de stockage : ${[...compartiments].join(', ')}`);
  console.log('');

  for (const requete of requetes) {
    const nom = `${requete.fichier} → ${requete.table}`;
    const chemin = construireRequete(requete);
    try {
      const { statut, corps } = await appeler(chemin);
      const ok = statut === 200 && Array.isArray(corps);
      journaliser(nom, ok, ok ? 'HTTP 200' : `HTTP ${statut} — ${messageDe(corps)}`);
      if (!ok) console.log(`        ${chemin}`);
    } catch (cause) {
      journaliser(nom, false, cause.message);
    }
  }

  // --- 2. Les compartiments de stockage ----------------------------------
  // Un compartiment absent rend tous les liens de documents morts, et aucune
  // table ne le signale : la table `documents` ne contient que des chemins.
  //
  // Le transport et le corps ne disent pas la même chose, et c'est mesuré : les
  // deux réponses arrivent en **HTTP 400**, avec un corps qui porte
  // `statusCode: 404` et un code S3. Seul le corps distingue les deux cas :
  //
  //   objet absent        → {"code":"NoSuchKey","message":"Object not found"}
  //   compartiment absent → {"code":"NoSuchBucket","message":"Bucket not found"}
  //
  // On exige donc la preuve POSITIVE que le compartiment a répondu au sujet de
  // l'objet. Accepter « tout sauf bucket not found » laisserait passer une clé
  // refusée, une panne, un 500 — c'est-à-dire exactement les cas où l'on veut
  // être réveillé. Une réponse non reconnue échoue en montrant son corps.
  for (const compartiment of [...compartiments].sort()) {
    const nom = `compartiment « ${compartiment} » : existe et public`;
    try {
      const { statut, corps } = await appeler(
        `/storage/v1/object/public/${compartiment}/sonde-inexistante.pdf`,
      );
      const brut = typeof corps === 'string' ? corps : JSON.stringify(corps);
      const objetAbsent = new RegExp(MOTIF_OBJET_ABSENT, 'i').test(brut);
      const compartimentAbsent = /NoSuchBucket|Bucket not found/i.test(brut);
      journaliser(
        nom,
        objetAbsent && !compartimentAbsent,
        objetAbsent
          ? `HTTP ${statut} — objet absent, attendu (le compartiment, lui, répond)`
          : `HTTP ${statut} — réponse non reconnue : ${brut.slice(0, 200)}`,
      );
    } catch (cause) {
      journaliser(nom, false, cause.message);
    }
  }

  // --- 3. L'accord entre l'application et ce contrôle ---------------------
  // `src/services/documents.ts` cherche la même formulation que ci-dessus pour
  // décider si un document manque. Deux copies d'une même vérité, dans deux
  // fichiers qui ne peuvent pas se lire : si Supabase change sa formulation, ce
  // contrôle échouerait de son côté, mais l'écran, lui, ne chercherait plus
  // rien — il ouvrirait un onglet sur du JSON sans que personne ne s'en aperçoive.
  //
  // Ce contrôle-ci ne peut pas éprouver le chemin de succès (il faudrait un
  // fichier réellement déposé) ; il peut au moins empêcher les deux copies de
  // diverger, ce qui est la seule chose qui dépend de nous.
  //
  // La comparaison porte sur le motif LU DANS LE CORPS de `fichierAbsent`, jamais
  // sur la présence de la chaîne dans le fichier : la seconde forme laissait
  // passer un motif recopié dans un commentaire pendant que la fonction cherchait
  // autre chose. `tests/accord-motif-objet-absent.test.mjs` tient les deux sens.
  const accord = "motif d'objet absent : formulation partagée avec l'application";
  try {
    const sourceService = readFileSync(join(DOSSIER_SERVICES, 'documents.ts'), 'utf8');
    const verdict = accordDeFormulation(sourceService, MOTIF_OBJET_ABSENT);
    journaliser(accord, verdict.ok, verdict.detail);
  } catch (cause) {
    journaliser(accord, false, cause.message);
  }

  // --- Verdict -----------------------------------------------------------
  const echecs = resultats.filter((r) => !r.ok);
  console.log('');
  console.log(`${resultats.length - echecs.length}/${resultats.length} vérifications passées`);
  if (echecs.length > 0) {
    console.log('');
    console.log('Défaut(s) :');
    for (const echec of echecs) console.log(`  - ${echec.nom}`);
    console.log('');
    console.log(
      'Aucun de ces défauts ne se voit à la compilation : il faut interroger la base réelle.',
    );
    process.exit(1);
  }
  console.log("Toutes les requêtes de l'application sont servies par la base.");
}

/**
 * N'interroge la base que si ce fichier est LANCÉ, jamais s'il est importé.
 *
 * Sans cette garde, `tests/accord-motif-objet-absent.test.mjs` déclencherait
 * tout le contrôle en important la fonction qu'il éprouve : la suite de tests se
 * mettrait à dépendre du réseau et de secrets, ce que ce projet refuse partout
 * ailleurs. Un test qui ne tourne qu'avec la base joignable ne protège rien le
 * jour où on en a besoin.
 *
 * CETTE GARDE NE SUFFIT PAS — et c'est écrit ici parce que le voisin l'a appris
 * à ses dépens : elle ne retient que `main()`. Tout ce qui s'exécute au niveau
 * du module passe AVANT elle. Le refus de configuration a donc été déplacé dans
 * `verifierConfiguration()`, appelée par `main()` ; c'est
 * `tests/import-sans-configuration.test.mjs` qui tient les deux côtés.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
