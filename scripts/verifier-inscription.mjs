#!/usr/bin/env node
/**
 * Vérifie que l'inscription publique est FERMÉE sur la base réelle.
 *
 * POURQUOI CE CONTRÔLE EXISTE, ALORS QUE `securite:api` EXISTE DÉJÀ
 * ----------------------------------------------------------------
 * `npm run securite:api` sonde la base avec la clé publique et conclut, à juste
 * titre, que `messages`, `sondage_votes` et `membres_bureau` sont inatteignables
 * et qu'aucune écriture directe ne passe. Il ne peut pas voir ceci :
 *
 *   l'inscription publique étant ouverte, N'IMPORTE QUI peut créer un compte
 *   et obtenir le rôle `authenticated`.
 *
 * Or c'est ce rôle que visent les politiques d'écriture de
 * `20260918001000_membres_bureau.sql`. Leur seule garde est
 * `public.est_membre_bureau()` — et cette fonction répond `false` pour un compte
 * qui vient de s'inscrire. La base reste donc fermée, mais elle l'est par une
 * seule épaisseur, et cette épaisseur ne se voit nulle part : ni dans le code de
 * l'application, qui ne fait que lire, ni dans `securite:api`, qui interroge
 * avec la clé publique — laquelle n'est jamais `authenticated`.
 *
 * C'est la mesure qui a motivé ce script : au 20 septembre 2026,
 * `disable_signup` valait `false`. Rien dans le dépôt ne le disait.
 *
 * CE QUE CE CONTRÔLE LIT, ET POURQUOI C'EST LISIBLE SANS COMPTE
 * -----------------------------------------------------------
 * `GET /auth/v1/settings` est public : il décrit la configuration du service
 * d'authentification, pas les personnes inscrites. Il se lit donc avec la clé
 * publique, sans créer de compte — ce que le projet s'interdit par principe,
 * pour ne pas fabriquer une identité de production dans le seul but de prouver
 * quelque chose. Les deux champs qui comptent ici :
 *
 *   - `disable_signup`      : `true` = inscription fermée. C'est l'objet du
 *                             contrôle.
 *   - `mailer_autoconfirm`  : `false` = un compte créé par le bureau doit être
 *                             confirmé à la main (case « Auto Confirm User »).
 *                             Ce n'est PAS un défaut ; c'est une information,
 *                             et elle est affichée comme telle.
 *
 * POURQUOI CE SCRIPT NE VÉRIFIE PAS LA FORME DE LA CLÉ
 * ----------------------------------------------------
 * Les deux autres contrôles refusent toute clé qui ne serait pas la clé
 * publique, parce qu'une clé `service_role` contournerait la RLS et rendrait
 * leurs verdicts verts pour de mauvaises raisons.
 *
 * Ici, la question posée ne dépend pas de qui interroge : que
 * `disable_signup` vaille `true` ou `false` est vrai pour tout le monde. Une
 * clé de service ne fausserait donc rien. Recopier le contrôle de forme
 * donnerait deux règles là où une seule est nécessaire — et la seconde finirait
 * par diverger de la première. Il n'est pas recopié.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que l'inscription restera fermée : c'est une configuration, elle se change
 * dans une page. Le contrôle dit l'état du moment, et c'est ce qu'on lui
 * demande.
 *
 * Usage :
 *   npm run verifier:inscription
 *
 * Variables lues dans l'environnement, ou dans `.env.local` :
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DELAI_MS = 20_000;

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

/**
 * Refuse de continuer si la configuration manque — à l'appel, jamais à l'import.
 *
 * Le niveau du module ne fait que DÉCLARER. `tests/import-sans-configuration.test.mjs`
 * importe ce fichier dans un processus privé de secrets et de `.env.local` : un
 * `process.exit(1)` écrit ici, hors fonction, s'exécuterait AVANT la garde
 * d'import et ferait échouer la suite de tests, qui tourne sans secrets par
 * règle du projet. C'est exactement le défaut qui a coûté un rouge à
 * `verifier-securite-api.mjs`.
 */
function verifierConfiguration() {
  if (URL_BASE === '' || CLE === '') {
    console.error('::error::Configuration absente.');
    console.error('');
    console.error('Renseignez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY,');
    console.error("dans `.env.local` ou dans l'environnement. Voir `.env.example`.");
    process.exit(1);
  }
}

/**
 * Ce que les réglages d'authentification disent de l'inscription publique.
 *
 * Rend `'fermee'`, `'ouverte'` ou `'inconnue'`.
 *
 * POURQUOI CE VERDICT EST UNE FONCTION, ET NON UN TEST ÉCRIT DANS LE SCRIPT
 * -------------------------------------------------------------------------
 * La règle qui décide doit pouvoir être éprouvée : `tests/verdict-inscription.test.mjs`
 * l'éprouve, y compris sur le cas qui compte le plus — un champ ABSENT.
 *
 * ET LE CAS QUI COMPTE LE PLUS EST CELUI DU CHAMP ABSENT
 * -----------------------------------------------------
 * Un test écrit `reglages.disable_signup === true` répondrait `false` sur une
 * réponse vide, un 404 ou une panne : le script annoncerait alors « inscription
 * ouverte » — soit le pire des deux messages, sur la foi d'une réponse qu'il
 * n'a pas sue lire. Symétriquement, écrire ce contrôle en « pas d'erreur, donc
 * c'est fermé » le rendrait vert sur un objet absent, ce que ce projet a déjà
 * payé une fois.
 *
 * Une forme que l'on ne sait pas lire ne permet donc rien d'affirmer, et un
 * contrôle qui ne peut rien affirmer doit le DIRE — d'où un troisième verdict,
 * et non deux.
 *
 * Le `true` attendu est un BOOLÉEN, et rien d'autre. Accepter la chaîne
 * `'true'` serait une tolérance : le jour où le service changerait de
 * sérialisation, le contrôle passerait au vert sans avoir rien vérifié. Échouer
 * bruyamment est ici le bon côté de l'erreur.
 */
export function verdictSurInscription(statut, reglages) {
  if (statut !== 200) return 'inconnue';
  if (reglages === null || typeof reglages !== 'object') return 'inconnue';

  const valeur = reglages.disable_signup;
  if (valeur === true) return 'fermee';
  if (valeur === false) return 'ouverte';
  return 'inconnue';
}

/** Interroge `/auth/v1/settings` sans jamais lever. */
async function lireReglages() {
  const reponse = await fetch(`${URL_BASE}/auth/v1/settings`, {
    signal: AbortSignal.timeout(DELAI_MS),
    headers: {
      apikey: CLE,
      Authorization: `Bearer ${CLE}`,
    },
  });

  const texte = await reponse.text();
  let corps = null;
  try {
    corps = JSON.parse(texte);
  } catch {
    corps = null;
  }

  return { statut: reponse.status, corps };
}

async function principal() {
  verifierConfiguration();

  console.log(`Base interrogée : ${URL_BASE}`);
  console.log('');

  let statut = 0;
  let reglages = null;
  try {
    ({ statut, corps: reglages } = await lireReglages());
  } catch (cause) {
    console.error(`::error::Lecture impossible : ${cause.message}`);
    process.exit(1);
  }

  const verdict = verdictSurInscription(statut, reglages);

  // On nomme la valeur telle qu'elle a été lue, brute, pour qu'un `undefined`
  // ou un `'true'` textuel se voie immédiatement dans le journal.
  const disableSignup = reglages === null ? '(illisible)' : JSON.stringify(reglages.disable_signup);
  const autoconfirm =
    reglages === null ? '(illisible)' : JSON.stringify(reglages.mailer_autoconfirm);

  console.log(`HTTP ${statut}`);
  console.log(`disable_signup      = ${disableSignup}`);
  console.log(`mailer_autoconfirm  = ${autoconfirm}`);
  console.log('');

  if (verdict === 'fermee') {
    console.log("L'inscription publique est fermée : personne ne peut se créer un compte");
    console.log('et obtenir le rôle `authenticated` de cette façon.');
    if (reglages.mailer_autoconfirm === false) {
      console.log('');
      console.log("`mailer_autoconfirm` vaut `false` : c'est cohérent, et attendu. Un compte");
      console.log('créé par le bureau doit être confirmé à la main — case « Auto Confirm User ».');
    }
    return;
  }

  if (verdict === 'ouverte') {
    console.error("::error::L'inscription publique est OUVERTE (disable_signup = false).");
    console.error('');
    console.error("Conséquence concrète : n'importe qui peut créer un compte et obtenir le");
    console.error("rôle `authenticated`. Les politiques d'écriture qui visent ce rôle n'ont");
    console.error("alors plus qu'une garde — `public.est_membre_bureau()` — au lieu de deux.");
    console.error('');
    console.error('À faire : tableau de bord Supabase, Authentication → Sign In / Providers,');
    console.error('décocher « Allow new users to sign up ». Puis relancer ce contrôle.');
    process.exit(1);
  }

  console.error(`::error::Verdict indéterminé (HTTP ${statut}) — les réglages sont illisibles.`);
  console.error('');
  console.error("Ce n'est PAS une bonne nouvelle : ce contrôle ne peut rien affirmer de l'état");
  console.error("de l'inscription. Vérifiez la référence du projet et la clé, puis relancez.");
  process.exit(1);
}

/**
 * N'interroge la base que si ce fichier est LANCÉ, jamais s'il est importé.
 *
 * Voir `verifier-securite-api.mjs` : cette garde ne protège que ce qu'elle
 * enveloppe, et tout ce qui s'exécute au niveau du module passe avant elle.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
