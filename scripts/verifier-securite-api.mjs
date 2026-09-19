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
 *   - `messages`, `sondage_votes` et `membres_bureau` ne le sont pas ;
 *   - AUCUNE écriture directe n'est possible, ni dans les tables ni dans les
 *     deux compartiments de stockage ;
 *   - les trois fonctions exposées répondent, et refusent ce qu'elles doivent
 *     refuser ;
 *   - les fonctions réservées au bureau ne sont pas exposées du tout.
 *
 * CE QU'IL VÉRIFIE DEPUIS L'OUVERTURE DE L'ÉCRITURE AU BUREAU
 * ----------------------------------------------------------
 * `supabase/migrations/20260918001000_membres_bureau.sql` accorde l'écriture au
 * rôle `authenticated`, pour que le bureau publie depuis une page web. Ce
 * script éprouve la seule chose qui compte alors : que cette ouverture n'ait
 * rien laissé passer du côté de la clé publique. Un `grant` trop large, une
 * politique écrite `to public` au lieu de `to authenticated`, et l'application
 * de l'école deviendrait modifiable par n'importe qui — sans qu'aucun test ne
 * s'en aperçoive, puisque l'application ne fait que lire.
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
import { pathToFileURL } from 'node:url';

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

/**
 * Tables sensibles : ni lisibles ni écrivables.
 *
 * `membres_bureau` en fait partie, et c'est ce qui rend le reste vérifiable :
 * tant que cette table répond 404, la migration des membres du bureau n'est pas
 * appliquée, et tout ce qui suit se contenterait d'un « absent » pris pour un
 * « refusé ». La présence de la table est donc le premier maillon de la chaîne.
 */
const TABLES_FERMEES = ['messages', 'sondage_votes', 'membres_bureau'];

/**
 * Les fonctions accordées à AUCUN rôle : PostgREST ne les met pas au cache et
 * répond 404 avec la clé publique.
 *
 * `ajouter_membre_bureau` en fait partie pour une raison de fond : un membre du
 * bureau ne doit pas pouvoir s'ajouter de collègue. Le seul chemin d'ajout est
 * l'éditeur SQL, c'est-à-dire quelqu'un qui a déjà les pleins droits.
 */
export const FONCTIONS_SANS_AUCUN_DROIT = [
  'set_updated_at',
  'verifier_vote_coherent',
  'ajouter_membre_bureau',
];

/**
 * Les fonctions accordées au seul rôle `authenticated` : la clé publique les
 * trouve — elles sont au cache — et se les voit refuser, HTTP 401.
 *
 * `est_membre_bureau` DOIT être exécutable par `authenticated` : les politiques
 * d'écriture l'appellent, et une politique s'évalue avec les droits de qui
 * interroge. La retirer fermerait l'administration ; l'accorder à `anon`
 * l'ouvrirait à quiconque s'inscrit. Il ne reste que le refus.
 *
 * Ces deux listes sont lues par `tests/accord-fonctions-exposees.test.mjs`, qui
 * les confronte aux `revoke` et `grant` des migrations : une fonction ajoutée
 * sans contrôle, ou accordée au mauvais rôle, fait échouer le banc.
 */
export const FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE = ['est_membre_bureau'];

/**
 * Un PNG d'un pixel, en hexadécimal.
 *
 * Le stockage refuse d'abord sur le type MIME : un témoin `text/plain` reçoit
 * un 400 « invalid_mime_type » AVANT que les droits soient regardés. Le
 * contrôle passerait alors pour une raison qui n'a rien à voir avec la
 * sécurité. Il faut donc un type que les deux compartiments acceptent, et un
 * contenu réellement valide pour qu'aucune autre vérification n'échoue avant
 * la politique.
 */
const TEMOIN_PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
    '0000000a49444154789c6300010000050001',
  'hex',
);

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

/**
 * Refuse de continuer si la configuration manque — à l'appel, jamais à l'import.
 *
 * POURQUOI CE CONTRÔLE EST DANS UNE FONCTION, ET NON AU NIVEAU DU MODULE
 * ---------------------------------------------------------------------
 * Il y était, et il a coûté un rouge en intégration continue. Ce fichier est
 * importé par `tests/refus-de-droit.test.mjs`, qui éprouve `refusDeDroit`. Placé
 * au niveau du module, `process.exit(1)` s'exécutait donc à l'IMPORT — c'est-à-
 * dire AVANT la garde de fin de fichier, qui ne pouvait rien retenir. Or la
 * suite de tests tourne sans secrets, par règle du projet : le banc sortait en
 * code 1 sans avoir exécuté un seul de ses sept tests.
 *
 * Mesuré sur le flux `ci.yml`, après poussée de `e33981a` :
 *   # ::error::Configuration absente.
 *   # Subtest: tests/refus-de-droit.test.mjs
 *   not ok 4 - tests/refus-de-droit.test.mjs
 *   # tests 113 / # pass 112 / # fail 1
 * Les comptes se réconcilient : 119 tests en local, 113 ici, l'écart étant les
 * six autres tests de ce banc qui n'ont jamais tourné, plus le fichier lui-même
 * compté comme un test en échec.
 *
 * En local, le défaut était INVISIBLE : `.env.local` existe. C'est pourquoi il
 * est désormais tenu par `tests/import-sans-configuration.test.mjs`, qui importe
 * ce fichier dans un processus enfant privé de secrets ET de `.env.local` — la
 * condition de la CI, que la machine du développeur ne reproduit jamais. Un
 * contrôle dont la défaillance est silencieuse s'éprouve, il ne se relit pas.
 *
 * Corollaire pour tout ce fichier : le niveau du module ne fait que DÉCLARER.
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
    // Les clés récentes de Supabase ne sont pas des JWT. Une seule forme est
    // acceptable ici : `sb_publishable_…`.
    //
    // Le contrôle porte sur ce préfixe EXACT, et surtout pas sur `sb_` — ce
    // qu'il faisait auparavant. `sb_secret_…` commence par `sb_` lui aussi :
    // l'ancienne condition acceptait donc la clé de service en annonçant « la
    // clé n'est pas une clé de service », et les vingt vérifications suivantes
    // devenaient vertes pour de mauvaises raisons. C'est exactement ce que
    // l'en-tête de ce script interdit : si la clé contourne la RLS, tout ce qui
    // suit ne prouve rien.
    //
    // Mesuré avant correction, avec `sb_secret_FAUSSE` :
    //   [OK] la clé n'est pas une clé de service — rôle non vérifiable
    //
    // Tout ce qui n'est ni un JWT ni une clé publiable est donc REFUSÉ, et non
    // toléré. Une forme inconnue ne permet pas d'affirmer quoi que ce soit sur
    // les droits qu'elle porte, et un contrôle qui ne peut rien affirmer doit
    // échouer — pas passer.
    const publiable = CLE.startsWith('sb_publishable_');

    // On nomme le sous-type plutôt que de recopier la clé : un message de
    // journal ne doit jamais recopier un secret, même tronqué.
    const sousType = CLE.match(/^sb_([a-z]+)_/)?.[1] ?? null;

    journaliser(
      'la clé utilisée est la clé publique',
      publiable,
      publiable
        ? 'clé publiable récente'
        : sousType === null
          ? 'forme de clé non reconnue — refusé'
          : `sous-type « ${sousType} » non publiable — refusé`,
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
    // `sondages` et `sondage_choix` ont reçu un droit d'écriture pour le rôle
    // `authenticated` avec la migration des membres du bureau. Ce sont donc les
    // tables où un `grant` trop large se verrait en premier.
    ['insertion dans sondages', '/rest/v1/sondages', 'POST', { question: 'intrusion' }],
    ['insertion dans sondage_choix', '/rest/v1/sondage_choix', 'POST', { libelle: 'intrusion' }],
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

  // 4. Aucune fonction d'administration ne doit être exécutable avec la clé
  //    publique — mais elles ne se refusent pas toutes de la même façon.
  //
  //    DEUX FAMILLES, DEUX RÉPONSES
  //    ----------------------------
  //    `est_membre_bureau` est accordée au seul rôle `authenticated` : avec la
  //    clé publique, PostgREST la trouve et répond **401**, « vous n'avez pas le
  //    droit ». Les trois autres ne sont accordées à aucun rôle : PostgREST ne
  //    les met pas au cache et répond **404**.
  //
  //    CE CONTRÔLE ATTENDAIT 404 POUR LES QUATRE, ET C'ÉTAIT FAUX
  //    ----------------------------------------------------------
  //    Il affirmait que PostgREST « ne trouve pas » `est_membre_bureau` parce
  //    qu'elle n'est accordée qu'à `authenticated`. Mesuré : non. Le cache de
  //    schéma de PostgREST est bâti sur l'ensemble des rôles ; une fonction
  //    accordée à un seul rôle y est donc PRÉSENTE, et `anon` reçoit 401.
  //
  //    La conséquence était pire que l'erreur d'explication : ce contrôle était
  //    VERT POUR RIEN. Tant que la migration n'était pas appliquée,
  //    `est_membre_bureau` n'existait pas, le 404 attendu arrivait — pour la
  //    mauvaise raison. Le jour où la fonction a existé, le contrôle est devenu
  //    rouge en accusant le seul état correct.
  //
  //    LE 401 EST UNE MEILLEURE PREUVE QUE LE 404
  //    ------------------------------------------
  //    Il n'est pas ambigu : un 404 ne dit pas si la fonction est absente ou
  //    non accordée, alors qu'un 401 prouve les deux choses qu'on veut savoir —
  //    elle existe, et la clé publique ne peut pas l'appeler. Le 404 des trois
  //    autres reste, lui, levé par la lecture de `membres_bureau` juste avant :
  //    un refus 401/403 y prouve que la migration EST appliquée.
  const interrogerFonction = async (fonction, attendu, intitule) => {
    try {
      const { statut } = await appeler(`/rest/v1/rpc/${fonction}`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const verdict = verdictSurFonctionAdministrative(statut);
      journaliser(`${fonction} : ${intitule}`, verdict === attendu, `HTTP ${statut} — ${verdict}`);
    } catch (cause) {
      journaliser(`${fonction} : ${intitule}`, false, cause.message);
    }
  };

  for (const fonction of FONCTIONS_SANS_AUCUN_DROIT)
    await interrogerFonction(fonction, 'absente', 'absente du cache');

  for (const fonction of FONCTIONS_REFUSEES_A_LA_CLE_PUBLIQUE)
    await interrogerFonction(fonction, 'refusee', 'refusée à la clé publique');
}

/**
 * Ce qu'un statut dit d'une fonction d'administration interrogée avec la clé
 * publique.
 *
 * Rend `'absente'` pour 404, `'refusee'` pour 401 ou 403, et `'appelable'` pour
 * tout le reste — 200 en tête, qui est le seul verdict vraiment dangereux : la
 * fonction répond à n'importe qui.
 *
 * POURQUOI CE VERDICT EST UNE FONCTION, ET NON UNE COMPARAISON EN LIGNE
 * --------------------------------------------------------------------
 * La comparaison en ligne a déjà menti une fois, et sans bruit. Le contrôle
 * attendait `statut === 404` pour `est_membre_bureau`, en écrivant que PostgREST
 * « ne la trouve pas ». C'était vert tant que la fonction n'existait pas — le
 * 404 arrivait pour la mauvaise raison — et rouge dès qu'elle a existé, parce
 * que le cache de schéma est bâti sur l'ensemble des rôles : une fonction
 * accordée au seul `authenticated` y est présente, et `anon` reçoit 401.
 *
 * Une règle qui décide doit pouvoir être éprouvée. Une comparaison écrite dans
 * une boucle ne s'éprouve pas ; `tests/accord-fonctions-exposees.test.mjs`
 * éprouve celle-ci, et confronte en plus les deux listes ci-dessus aux `revoke`
 * et `grant` des migrations.
 */
export function verdictSurFonctionAdministrative(statut) {
  if (statut === 404) return 'absente';
  if (statut === 401 || statut === 403) return 'refusee';
  return 'appelable';
}

/**
 * Une écriture est-elle refusée faute de droit ?
 *
 * ATTENTION AU STATUT : LE STOCKAGE NE RÉPOND PAS COMME L'API REST
 * ----------------------------------------------------------------
 * L'API REST refuse une écriture par un 401 ou un 403. Le service de stockage,
 * lui, répond **HTTP 400** et met le refus DANS LE CORPS. Mesuré, avec la clé
 * publique et un PNG valide :
 *
 *   POST /storage/v1/object/annonces/temoin.png  ->  HTTP 400
 *   {"statusCode":403,"error":"Unauthorized",
 *    "message":"new row violates row-level security policy","code":"AccessDenied"}
 *
 * Et `statusCode` y est une CHAÎNE, pas un nombre. Une comparaison stricte
 * `corps.statusCode === 403` ne correspond donc jamais : le contrôle échoue
 * alors que l'écriture est bien refusée. C'est exactement ce qui s'est produit
 * au premier essai — mesuré, deux échecs sur les deux compartiments, avec le
 * corps ci-dessus sous les yeux.
 *
 * Exiger 401/403 ici ferait donc échouer le contrôle alors que l'écriture EST
 * refusée. Mais accepter 400 sans lire le corps serait pire : un 400 est aussi
 * ce que produit un type de fichier refusé ou une charge utile mal formée, et
 * le contrôle deviendrait muet — il passerait même si les droits étaient
 * ouverts, tant que la requête est mal formée.
 *
 * On exige donc le refus explicitement dans le corps, en plus du statut.
 */
export function refusDeDroit(statut, corps) {
  if (statut === 401 || statut === 403) {
    return true;
  }

  if (corps === null || typeof corps !== 'object') {
    return false;
  }

  const code = String(corps.statusCode ?? '');
  return (
    (code === '401' || code === '403') &&
    (corps.error === 'Unauthorized' || corps.code === 'AccessDenied')
  );
}

/**
 * Le stockage refuse-t-il l'écriture à un inconnu ?
 *
 * C'est le contrôle le plus important ajouté avec la page d'administration. Les
 * deux compartiments sont publics en LECTURE — un parent doit pouvoir ouvrir un
 * PDF sans compte. Une politique d'écriture écrite `to public` au lieu de
 * `to authenticated` les rendrait modifiables par n'importe qui, et le premier
 * signe visible serait une photographie remplacée dans une annonce.
 */
async function verifierEcritureStockageRefusee() {
  for (const compartiment of ['annonces', 'documents']) {
    const chemin = `/storage/v1/object/${compartiment}/controle-securite.png`;

    try {
      const { statut, corps } = await appeler(chemin, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: TEMOIN_PNG,
      });

      const refuse = refusDeDroit(statut, corps);
      journaliser(
        `stockage ${compartiment} : écriture refusée`,
        refuse,
        refuse ? `HTTP ${statut} — refus dans le corps` : `HTTP ${statut} — ${messageDe(corps)}`,
      );
    } catch (cause) {
      journaliser(`stockage ${compartiment} : écriture refusée`, false, cause.message);
    }
  }
}

async function principal() {
  verifierConfiguration();

  console.log(`Base interrogée : ${URL_BASE}`);
  console.log('');

  verifierRoleDeLaCle();
  await verifierLectureAutorisee();
  await verifierLectureInterdite();
  await verifierEcrituresRefusees();
  await verifierEcritureStockageRefusee();
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

/**
 * N'interroge la base que si ce fichier est LANCÉ, jamais s'il est importé.
 *
 * Sans cette garde, `tests/refus-de-droit.test.mjs` déclencherait tout le
 * contrôle en important la fonction qu'il éprouve : la suite de tests se
 * mettrait alors à dépendre du réseau et de secrets, ce que ce projet refuse
 * partout ailleurs. Un test qui ne tourne qu'avec la base joignable ne protège
 * rien le jour où on en a besoin.
 *
 * CETTE GARDE NE SUFFIT PAS — ET ELLE A ÉTÉ CRUE SUFFISANTE. Elle ne retient
 * que `principal()`. Tout ce qui s'exécute au niveau du module passe AVANT elle,
 * et c'est exactement par là qu'un `process.exit(1)` a fait échouer
 * l'intégration continue : voir `verifierConfiguration()`. Une garde d'import
 * ne protège que ce qu'elle enveloppe ; elle ne dispense pas de regarder ce qui
 * reste dehors.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
