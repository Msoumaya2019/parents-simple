#!/usr/bin/env node
/**
 * Éprouve les politiques de sécurité sur une base Supabase RÉELLE, par l'API.
 *
 * POURQUOI CE CONTRÔLE EXISTE, ALORS QUE `sql:check` EXISTE DÉJÀ
 * -------------------------------------------------------------
 * `scripts/check-sql.mjs` lit la migration et vérifie qu'elle *dit* les bonnes
 * choses : chaque table active la RLS, les privilèges sont révoqués, les
 * fonctions sont `security definer`. C'est un contrôle de texte.
 *
 * Il ne peut pas savoir si la migration a réellement été appliquée, ni si une
 * politique ajoutée à la main depuis le tableau de bord a ouvert une table. Une
 * base peut être parfaitement décrite par un fichier et se comporter tout
 * autrement.
 *
 * Ce script-ci interroge la base avec la MÊME clé publique que celle embarquée
 * dans l'application. Il répond à une seule question : qu'est-ce qu'un
 * inconnu qui extrait la clé d'un APK peut réellement faire ?
 *
 * Ce qu'il doit trouver :
 *   - le contenu publié est lisible ;
 *   - `messages` et `sondage_votes` ne le sont pas ;
 *   - AUCUNE écriture directe n'est possible ;
 *   - les trois fonctions exposées répondent, et refusent ce qu'elles doivent
 *     refuser.
 *
 * Aucune de ces requêtes ne modifie la base. Les appels aux fonctions sont
 * choisis pour échouer avant toute insertion : un sondage inexistant pour
 * `voter`, un sujet vide pour `envoyer_message`.
 *
 * Usage :
 *   npm run securite:api
 *
 * Variables lues dans l'environnement, ou dans `.env.local` :
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { readFileSync } from 'node:fs';

const DELAI_MS = 20_000;

/** Tables de contenu : lisibles par la clé publique. */
const TABLES_LISIBLES = [
  'annonces',
  'cantine_menus',
  'agenda_events',
  'documents',
  'sondages',
  'sondage_choix',
];

/** Tables sensibles : ni lisibles ni écrivables. */
const TABLES_FERMEES = ['messages', 'sondage_votes'];

const resultats = [];

function journaliser(nom, ok, detail = '') {
  resultats.push({ nom, ok });
  const marque = ok ? 'OK   ' : 'ECHEC';
  console.log(`[${marque}] ${nom}${detail ? ` — ${detail}` : ''}`);
}

/** Lit `.env.local`, sans écraser ce qui est déjà dans l'environnement. */
function lireEnvLocal() {
  const valeurs = {};
  try {
    const contenu = readFileSync('.env.local', 'utf8');
    for (const ligne of contenu.split('\n')) {
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
  console.error('');
  console.error('Renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY,');
  console.error("dans `.env.local` ou dans l'environnement. Voir `.env.example`.");
  process.exit(1);
}

/**
 * Vérifie que la clé fournie est bien la clé publique.
 *
 * `src/config/env.ts` refuse déjà de démarrer avec une clé `service_role`, mais
 * ce contrôle-ci porte sur la clé réellement utilisée pour interroger la base :
 * si elle contourne la RLS, tous les résultats ci-dessous seraient verts pour
 * de mauvaises raisons, et le script ne prouverait rien.
 */
function verifierRoleDeLaCle() {
  const parties = CLE.split('.');
  if (parties.length !== 3) {
    // Les clés récentes de Supabase (`sb_publishable_…`) ne sont pas des JWT.
    journaliser(
      "la clé n'est pas une clé de service",
      CLE.startsWith('sb_publishable_') || CLE.startsWith('sb_'),
      CLE.startsWith('sb_publishable_')
        ? 'clé publiable récente'
        : 'format de clé non reconnu — rôle non vérifiable',
    );
    return;
  }

  try {
    const charge = JSON.parse(Buffer.from(parties[1], 'base64url').toString('utf8'));
    journaliser(
      'la clé porte le rôle « anon »',
      charge.role === 'anon',
      `rôle détecté : ${charge.role ?? 'absent'}`,
    );
  } catch {
    journaliser('la clé porte le rôle « anon »', false, 'charge utile illisible');
  }
}

/** Exécute une requête et renvoie le statut et le corps, sans jamais lever. */
async function appeler(chemin, options = {}) {
  const reponse = await fetch(`${URL_BASE}${chemin}`, {
    ...options,
    signal: AbortSignal.timeout(DELAI_MS),
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${CLE}`,
      'Content-Type': 'application/json',
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
}

/** Message d'erreur lisible, quel que soit le format renvoyé. */
function messageDe(corps) {
  if (corps === null || corps === undefined) return '';
  if (typeof corps === 'string') return corps.slice(0, 160);
  return String(corps.message ?? corps.hint ?? JSON.stringify(corps)).slice(0, 160);
}

async function verifierLectureAutorisee() {
  for (const table of TABLES_LISIBLES) {
    try {
      const { statut } = await appeler(`/rest/v1/${table}?select=*&limit=1`);
      journaliser(`${table} : lisible`, statut === 200, `HTTP ${statut}`);
    } catch (cause) {
      journaliser(`${table} : lisible`, false, cause.message);
    }
  }
}

async function verifierLectureInterdite() {
  for (const table of TABLES_FERMEES) {
    try {
      const { statut, corps } = await appeler(`/rest/v1/${table}?select=*&limit=1`);

      // Une table fermée doit répondre « interdit », pas « voici une liste
      // vide ». Un 200 avec `[]` signifierait que le privilège de lecture a été
      // accordé et que seule l'absence de politique retient les lignes : un
      // ajout de politique accidentel ouvrirait alors la table.
      const refuse = statut === 401 || statut === 403;
      journaliser(
        `${table} : lecture refusée`,
        refuse,
        refuse ? `HTTP ${statut}` : `HTTP ${statut} — ${messageDe(corps)}`,
      );
    } catch (cause) {
      journaliser(`${table} : lecture refusée`, false, cause.message);
    }
  }
}

async function verifierEcrituresRefusees() {
  const tentatives = [
    ['insertion dans annonces', '/rest/v1/annonces', 'POST', { titre: 'intrusion', corps: 'x' }],
    [
      'insertion dans cantine_menus',
      '/rest/v1/cantine_menus',
      'POST',
      { service_date: '2026-01-01' },
    ],
    ['insertion dans documents', '/rest/v1/documents', 'POST', { titre: 'intrusion' }],
    ['insertion dans messages', '/rest/v1/messages', 'POST', { sujet: 'intrusion', corps: 'x' }],
    ['insertion dans sondage_votes', '/rest/v1/sondage_votes', 'POST', { sondage_id: 'x' }],
    [
      'modification de annonces',
      '/rest/v1/annonces?id=eq.00000000-0000-0000-0000-000000000000',
      'PATCH',
      { titre: 'intrusion' },
    ],
    [
      'suppression dans annonces',
      '/rest/v1/annonces?id=eq.00000000-0000-0000-0000-000000000000',
      'DELETE',
      null,
    ],
  ];

  for (const [nom, chemin, methode, corps] of tentatives) {
    try {
      const { statut, corps: reponse } = await appeler(chemin, {
        method: methode,
        body: corps === null ? undefined : JSON.stringify(corps),
      });

      // Seuls 401 et 403 sont des refus. Un 400 n'en est pas un : PostgREST
      // rejette alors la charge utile — colonne inconnue, valeur invalide —
      // AVANT de regarder les droits. Un tel contrôle ne prouve donc rien, et
      // c'est le contrôle qu'il faut corriger. L'assouplir pour accepter 400
      // le rendrait muet, et c'est exactement ce qui est arrivé une fois ici :
      // la tentative d'insertion dans `cantine_menus` visait une colonne
      // `jour` inexistante, la vraie étant `service_date`.
      const refuse = statut === 401 || statut === 403;
      const diagnostic = refuse
        ? `HTTP ${statut}`
        : statut === 400
          ? `HTTP 400 — charge utile rejetée avant le contrôle des droits : ${messageDe(reponse)}`
          : `HTTP ${statut} — ${messageDe(reponse)}`;
      journaliser(nom + ' : refusée', refuse, diagnostic);
    } catch (cause) {
      journaliser(`${nom} : refusée`, false, cause.message);
    }
  }
}

async function verifierFonctions() {
  // 1. `sondage_resultats` doit répondre, même sans identifiant à interroger.
  try {
    const { statut, corps } = await appeler('/rest/v1/rpc/sondage_resultats', {
      method: 'POST',
      body: JSON.stringify({ p_sondage_ids: [] }),
    });
    journaliser(
      'sondage_resultats : exposée et répond',
      statut === 200 && Array.isArray(corps),
      `HTTP ${statut}`,
    );
  } catch (cause) {
    journaliser('sondage_resultats : exposée et répond', false, cause.message);
  }

  // 2. `voter` doit refuser un sondage inexistant — donc n'insérer aucune ligne.
  try {
    const { statut, corps } = await appeler('/rest/v1/rpc/voter', {
      method: 'POST',
      body: JSON.stringify({
        p_sondage_id: '00000000-0000-0000-0000-000000000000',
        p_choix_id: '00000000-0000-0000-0000-000000000000',
        p_votant_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    journaliser(
      'voter : refuse un sondage inexistant',
      statut !== 200 && messageDe(corps).includes('ferm'),
      `HTTP ${statut} — ${messageDe(corps)}`,
    );
  } catch (cause) {
    journaliser('voter : refuse un sondage inexistant', false, cause.message);
  }

  // 3. `envoyer_message` doit refuser un sujet vide, AVANT toute insertion :
  //    la contrainte `messages_sujet_valide` s'en charge. Ce contrôle prouve
  //    que la fonction est exposée et qu'elle s'exécute réellement, sans
  //    déposer un message dans la boîte du bureau.
  //
  //    Le corps est VALIDE à dessein. Avec un corps vide lui aussi, les deux
  //    contraintes tombent et PostgreSQL rapporte celle qu'il évalue en
  //    premier — mesuré : `messages_corps_valide`. Le contrôle passait alors
  //    sans jamais éprouver la contrainte sur le sujet. Corps rempli, la seule
  //    contrainte violable est celle du sujet, et le message d'erreur la nomme :
  //    on l'exige, plutôt que de se contenter d'un statut différent de 200.
  try {
    const { statut, corps } = await appeler('/rest/v1/rpc/envoyer_message', {
      method: 'POST',
      body: JSON.stringify({
        p_sujet: '   ',
        p_corps: 'Contrôle de sécurité : ce message ne doit jamais être inséré.',
        p_categorie: 'autre',
        p_reponse_a: null,
        p_appareil_id: '00000000-0000-0000-0000-000000000000',
      }),
    });
    const message = messageDe(corps);
    journaliser(
      'envoyer_message : refuse un sujet vide',
      statut !== 200 && statut !== 201 && message.includes('messages_sujet_valide'),
      `HTTP ${statut} — ${message}`,
    );
  } catch (cause) {
    journaliser('envoyer_message : refuse un sujet vide', false, cause.message);
  }

  // 4. Aucune fonction d'administration ne doit être exposée à la clé publique.
  const fonctionsInterdites = ['set_updated_at', 'verifier_vote_coherent'];
  for (const fonction of fonctionsInterdites) {
    try {
      const { statut } = await appeler(`/rest/v1/rpc/${fonction}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      journaliser(`${fonction} : non exposée`, statut === 404, `HTTP ${statut}`);
    } catch (cause) {
      journaliser(`${fonction} : non exposée`, false, cause.message);
    }
  }
}

async function principal() {
  console.log(`Base interrogée : ${URL_BASE}`);
  console.log('');

  verifierRoleDeLaCle();
  await verifierLectureAutorisee();
  await verifierLectureInterdite();
  await verifierEcrituresRefusees();
  await verifierFonctions();

  const echecs = resultats.filter((r) => !r.ok);
  console.log('');
  console.log(`${resultats.length - echecs.length}/${resultats.length} vérifications passées`);

  if (echecs.length > 0) {
    console.error('');
    console.error(`${echecs.length} défaut(s) de sécurité :`);
    for (const echec of echecs) {
      console.error(`  - ${echec.nom}`);
    }
    console.error('');
    console.error("Ne pas distribuer l'application dans cet état.");
    process.exit(1);
  }

  console.log('Les politiques de sécurité se comportent comme prévu.');
}

await principal();
