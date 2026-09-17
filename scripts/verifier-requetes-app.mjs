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

const DOSSIER_SERVICES = 'src/services';
const DELAI_MS = 20_000;

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

if (URL_BASE === '' || CLE === '') {
  console.error('::error::Configuration absente.');
  console.error('Renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  process.exit(1);
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

async function main() {
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
      const objetAbsent = /NoSuchKey|Object not found/i.test(brut);
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

  // --- Verdict -----------------------------------------------------------
  const echecs = resultats.filter((r) => !r.ok);
  console.log('');
  console.log(`${resultats.length - echecs.length}/${resultats.length} vérifications passées`);
  if (echecs.length > 0) {
    console.log('');
    console.log('Défaut(s) :');
    for (const echec of echecs) console.log(`  - ${echec.nom}`);
    console.log('');
    console.log("L'application afficherait un écran vide, sans message.");
    process.exit(1);
  }
  console.log("Toutes les requêtes de l'application sont servies par la base.");
}

await main();
