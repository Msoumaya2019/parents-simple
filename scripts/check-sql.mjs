/**
 * Contrôle de cohérence du schéma SQL.
 *
 * POURQUOI CE SCRIPT EXISTE
 * -------------------------
 * La sécurité de cette application ne repose sur aucune ligne de son code : elle
 * repose entièrement sur `supabase/migrations/`. Une table créée sans RLS, ou
 * dont les privilèges n'ont pas été révoqués, est lisible et modifiable par
 * quiconque possède la clé publique — c'est-à-dire par quiconque a installé
 * l'application.
 *
 * Or ces oublis ne se voient nulle part : le schéma s'applique sans erreur,
 * l'application fonctionne, et le défaut reste invisible jusqu'à ce que
 * quelqu'un l'exploite. C'est exactement le genre de faute qu'un contrôle
 * automatique doit attraper.
 *
 * CE QUE CE SCRIPT NE FAIT PAS
 * ----------------------------
 * Il ne valide pas la syntaxe PostgreSQL. Une analyse syntaxique complète
 * demanderait un moteur PostgreSQL, donc une dépendance native lourde. Les
 * contrôles portent donc sur la STRUCTURE : chaque table est-elle protégée,
 * chaque politique vise-t-elle une table réelle, les tables sensibles sont-elles
 * bien fermées. C'est le niveau où se trouvent les fautes coûteuses.
 *
 * IL CONFRONTE AUSSI LE SCHÉMA À L'ÉCRAN QUI LE SAISIT
 * ----------------------------------------------------
 * Les bornes de longueur sont écrites deux fois — dans la migration, qui les
 * applique, et dans l'écran de contact, qui empêche de les atteindre. Rien ne
 * les relie, et une divergence ne se voit qu'à l'usage : le parent saisit, la
 * base refuse, et il lit « Réessayez dans un instant » pour une limite qu'il ne
 * peut pas franchir. C'est le seul endroit du script qui lit un fichier de
 * `app/`, et il le fait parce que la vérité y est écrite à la main.
 *
 * Usage : `npm run sql:check`
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '..');
const MIGRATIONS = path.join(RACINE, 'supabase', 'migrations');

/**
 * Tables qui ne doivent porter AUCUNE politique, pour aucun rôle : rien n'y
 * est lisible ni inscriptible par l'API.
 *
 * `messages` et `sondage_votes` sont des données de parents ; `membres_bureau`
 * est la liste de qui a le droit de publier — l'exposer, même à ses propres
 * membres, reviendrait à publier les adresses du bureau.
 */
const TABLES_FERMEES = ['messages', 'sondage_votes', 'membres_bureau'];

/** Tables qui doivent au contraire être lisibles par `anon`. */
const TABLES_LISIBLES = [
  'annonces',
  'cantine_menus',
  'agenda_events',
  'documents',
  'sondages',
  'sondage_choix',
];

const problemes = [];
const verifications = [];

function signaler(gravite, message) {
  problemes.push({ gravite, message });
}

function verifier(condition, description) {
  verifications.push(description);
  if (!condition) {
    signaler('erreur', description);
  }
}

/**
 * Le contenu d'une parenthèse, parenthèses imbriquées comprises.
 *
 * POURQUOI CETTE FONCTION EXISTE — ELLE A ÉTÉ PAYÉE
 * -------------------------------------------------
 * Un motif comme `/using\s*\([^;]*public\.est_membre_bureau\(\)/` paraît
 * suffire, et ne suffit pas : `[^;]*` peut courir AU-DELÀ de la parenthèse
 * fermante de `using`, jusqu'à celle de `with check`. Mesuré, sur cette forme :
 *
 *   for all to authenticated
 *     using (true)
 *     with check (public.est_membre_bureau())
 *
 * Le contrôle cherchant la condition après `using` la trouvait dans `with
 * check`, et déclarait la politique gardée. Or elle ne l'est pas : `with check`
 * ne s'applique NI à `delete` NI au choix des lignes visibles, si bien que tout
 * inscrit pouvait SUPPRIMER n'importe quelle annonce. Le contrôle rendait un
 * vert sur une application ouverte en suppression.
 *
 * Il faut donc délimiter la clause par appariement des parenthèses, jamais par
 * un intervalle libre.
 */
function contenuParenthese(texte, indexOuvrante) {
  if (texte[indexOuvrante] !== '(') return null;

  let profondeur = 0;
  for (let i = indexOuvrante; i < texte.length; i += 1) {
    if (texte[i] === '(') profondeur += 1;
    else if (texte[i] === ')') {
      profondeur -= 1;
      if (profondeur === 0) return texte.slice(indexOuvrante + 1, i);
    }
  }

  //  Parenthèse jamais refermée : dire « absent » vaut mieux que rendre un
  //  contenu tronqué, qui ferait passer un contrôle sur un fichier mal formé.
  return null;
}

/** Le contenu de la clause `motif` — par exemple `/using\s*\(/` — ou `null`. */
function contenuDeClause(texte, motif) {
  const trouve = motif.exec(texte);
  if (trouve === null) return null;
  return contenuParenthese(texte, trouve.index + trouve[0].length - 1);
}

// ---------------------------------------------------------------------------
//  Lecture des migrations
// ---------------------------------------------------------------------------

if (!fs.existsSync(MIGRATIONS)) {
  console.error(`Dossier introuvable : ${MIGRATIONS}`);
  process.exit(1);
}

const fichiers = fs
  .readdirSync(MIGRATIONS)
  .filter((nom) => nom.endsWith('.sql'))
  .sort();

if (fichiers.length === 0) {
  console.error('Aucune migration SQL trouvée.');
  process.exit(1);
}

const sql = fichiers.map((nom) => fs.readFileSync(path.join(MIGRATIONS, nom), 'utf8')).join('\n');

/**
 * Retire les commentaires `--` avant toute analyse.
 *
 * Sans cela, un commentaire qui MENTIONNE `create table public.x` serait pris
 * pour une vraie déclaration, et un commentaire expliquant qu'une table est
 * volontairement sans politique serait lu comme une politique. Le fichier de
 * migration est très commenté : ce n'est pas un cas théorique.
 */
const sansCommentaires = sql
  .split('\n')
  .map((ligne) => {
    const index = ligne.indexOf('--');
    return index === -1 ? ligne : ligne.slice(0, index);
  })
  .join('\n');

const normalise = sansCommentaires.toLowerCase();

/** Tous les noms de tables du schéma `public`. */
function tablesCreees() {
  const motif = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z0-9_]+)/g;
  const noms = new Set();
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    noms.add(correspondance[1]);
  }
  return noms;
}

const tables = tablesCreees();

// ---------------------------------------------------------------------------
//  1. Chaque table est protégée
// ---------------------------------------------------------------------------

for (const table of tables) {
  const aRls = new RegExp(
    `alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`,
  ).test(normalise);

  verifier(aRls, `La table « ${table} » active la sécurité au niveau des lignes (RLS).`);

  const privilegesRevoques = new RegExp(
    `revoke\\s+all\\s+on\\s+public\\.${table}\\s+from\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(
    privilegesRevoques,
    `Les privilèges par défaut de « ${table} » sont révoqués pour le rôle anonyme.`,
  );
}

// ---------------------------------------------------------------------------
//  2. Chaque politique vise une table qui existe
// ---------------------------------------------------------------------------

const politiques = [];
{
  const motif = /create\s+policy\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/g;
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    politiques.push({ nom: correspondance[1], table: correspondance[2] });
  }
}

verifier(politiques.length > 0, 'Le schéma déclare au moins une politique.');

for (const politique of politiques) {
  verifier(
    tables.has(politique.table),
    `La politique « ${politique.nom} » vise la table « ${politique.table} », qui existe.`,
  );
}

// ---------------------------------------------------------------------------
//  3. Les tables sensibles sont fermées au rôle anonyme
// ---------------------------------------------------------------------------

for (const table of TABLES_FERMEES) {
  if (!tables.has(table)) {
    signaler('erreur', `La table « ${table} » est attendue dans le schéma, mais absente.`);
    continue;
  }

  const politiquesSurLaTable = politiques.filter((politique) => politique.table === table);

  //  Le message NOMME ce qui a été trouvé, et non la propriété attendue. Écrit
  //  dans l'autre sens — « aucune politique ne s'applique » —, il annoncerait
  //  le contraire de la situation au moment précis où il s'affiche, et
  //  enverrait chercher une politique manquante là où il y en a une de trop.
  verifier(
    politiquesSurLaTable.length === 0,
    `La table « ${table} » ne porte aucune politique, or ${politiquesSurLaTable.length} s'y applique(nt) : ${politiquesSurLaTable.map((politique) => politique.nom).join(', ')}.`,
  );

  const selectAccorde = new RegExp(
    `grant\\s+select\\s+on\\s+public\\.${table}\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(
    !selectAccorde,
    `La table « ${table} » n'accorde aucune lecture au rôle anonyme, or un « grant select » la vise.`,
  );
}

// ---------------------------------------------------------------------------
//  4. Les tables de contenu sont lisibles
// ---------------------------------------------------------------------------

for (const table of TABLES_LISIBLES) {
  if (!tables.has(table)) {
    signaler('erreur', `La table « ${table} » est attendue dans le schéma, mais absente.`);
    continue;
  }

  const lectureAccordee = new RegExp(
    `grant\\s+select\\s+on\\s+public\\.${table}\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(lectureAccordee, `La table « ${table} » est lisible avec la clé publique.`);

  const aUnePolitiqueDeLecture = politiques.some((politique) => politique.table === table);

  verifier(
    aUnePolitiqueDeLecture,
    `La table « ${table} » possède une politique, sans quoi le droit accordé resterait sans effet.`,
  );
}

// ---------------------------------------------------------------------------
//  5. Les index visent des tables qui existent
// ---------------------------------------------------------------------------

{
  const motif = /create\s+index\s+([a-z0-9_]+)\s+on\s+public\.([a-z0-9_]+)/g;
  let correspondance;
  while ((correspondance = motif.exec(normalise)) !== null) {
    verifier(
      tables.has(correspondance[2]),
      `L'index « ${correspondance[1]} » porte sur la table « ${correspondance[2]} », qui existe.`,
    );
  }
}

// ---------------------------------------------------------------------------
//  6. Les fonctions exposées sont exécutables par le rôle anonyme
// ---------------------------------------------------------------------------

for (const fonction of ['sondage_resultats', 'voter', 'envoyer_message']) {
  const declaree = normalise.includes(`function public.${fonction}(`);
  verifier(declaree, `La fonction « ${fonction} » est déclarée.`);

  if (!declaree) {
    continue;
  }

  const exposee = new RegExp(
    `grant\\s+execute\\s+on\\s+function\\s+public\\.${fonction}\\([^)]*\\)\\s+to\\s+[^;]*\\banon\\b`,
  ).test(normalise);

  verifier(exposee, `La fonction « ${fonction} » est exécutable avec la clé publique.`);

  const enSecurityDefiner = new RegExp(
    `function\\s+public\\.${fonction}\\([^)]*\\)[\\s\\S]{0,600}?security\\s+definer`,
  ).test(normalise);

  verifier(
    enSecurityDefiner,
    `La fonction « ${fonction} » s'exécute avec les droits du propriétaire (security definer).`,
  );

  const searchPathFerme = new RegExp(
    `function\\s+public\\.${fonction}\\([^)]*\\)[\\s\\S]{0,600}?set\\s+search_path\\s*=\\s*''`,
  ).test(normalise);

  verifier(
    searchPathFerme,
    `La fonction « ${fonction} » fixe un « search_path » vide, ce qui ferme le détournement de schéma.`,
  );
}

// ---------------------------------------------------------------------------
//  7. Le compartiment de stockage est déclaré
// ---------------------------------------------------------------------------

verifier(
  normalise.includes('insert into storage.buckets'),
  'Le compartiment de stockage des documents est déclaré par une migration.',
);

// ---------------------------------------------------------------------------
//  8. Les bornes de saisie ne dépassent pas ce que la base accepte
// ---------------------------------------------------------------------------
//  Les mêmes limites sont écrites deux fois : dans la migration, qui les
//  applique, et dans l'écran de contact, qui empêche de les atteindre. Rien ne
//  les relie. Une divergence ne se voit nulle part : l'écran laisse saisir, la
//  base refuse, et le parent lit « Réessayez dans un instant » pour une limite
//  qu'il ne peut pas franchir — un message faux, qui l'envoie chercher une
//  cause inexistante.
//
//  La règle n'est pas l'égalité, mais la NON-PERMISSIVITÉ : l'écran a le droit
//  d'être plus strict que la base — il exige dix caractères là où la base en
//  accepte un — jamais plus large.
//
//  On ancre la lecture sur le NOM DE LA CONTRAINTE et non sur celui de la
//  colonne : `corps` existe dans `annonces` (8000) et dans `messages` (4000).
//  Chercher la colonne ferait comparer l'écran à la mauvaise table, et le
//  contrôle tomberait sur du code juste.
const ECRAN_CONTACT = path.join(RACINE, 'app', '(tabs)', 'contact.tsx');

/** Borne haute d'une contrainte `check`, lue dans la migration. */
function borneDe(nomContrainte) {
  const position = normalise.indexOf(nomContrainte);
  if (position === -1) {
    return null;
  }
  const trouve = normalise.slice(position, position + 200).match(/between (\d+) and (\d+)/);
  return trouve === null ? null : Number(trouve[2]);
}

/** Valeur d'une constante `const NOM = 123;`, lue dans l'écran. */
function constanteNumerique(source, nom) {
  const trouve = source.match(new RegExp(`const ${nom} = (\\d+);`));
  return trouve === null ? null : Number(trouve[1]);
}

if (fs.existsSync(ECRAN_CONTACT)) {
  const ecran = fs.readFileSync(ECRAN_CONTACT, 'utf8');

  for (const { contrainte, constante } of [
    { contrainte: 'messages_sujet_valide', constante: 'LONGUEUR_SUJET' },
    { contrainte: 'messages_corps_valide', constante: 'LONGUEUR_MESSAGE' },
  ]) {
    const coteBase = borneDe(contrainte);
    const coteEcran = constanteNumerique(ecran, constante);

    // Sans ces deux contrôles, un motif qui ne correspond plus rendrait le
    // contrôle d'accord vert en ne comparant rien.
    verifier(coteBase !== null, `La contrainte « ${contrainte} » est lisible dans la migration.`);
    verifier(
      coteEcran !== null,
      `La constante « ${constante} » est lisible dans l'écran de contact.`,
    );
    verifier(
      coteBase !== null && coteEcran !== null && coteEcran <= coteBase,
      `« ${constante} » (${coteEcran ?? '?'}) ne dépasse pas la borne de « ${contrainte} » (${coteBase ?? '?'}).`,
    );
  }

  // `reponse_a` n'a pas de borne basse : sa contrainte s'écrit
  // `is null or char_length(reponse_a) <= 254`, sans `btrim` ni `between`.
  const adresseBase = normalise.match(/char_length\(reponse_a\) <= (\d+)/);
  const adresseEcran = constanteNumerique(ecran, 'LONGUEUR_ADRESSE');

  verifier(adresseBase !== null, 'La contrainte de longueur de « reponse_a » est lisible.');
  verifier(
    adresseEcran !== null,
    "La constante « LONGUEUR_ADRESSE » est lisible dans l'écran de contact.",
  );
  verifier(
    adresseBase !== null && adresseEcran !== null && adresseEcran <= Number(adresseBase[1]),
    `« LONGUEUR_ADRESSE » (${adresseEcran ?? '?'}) ne dépasse pas la borne de « reponse_a » (${adresseBase?.[1] ?? '?'}).`,
  );
} else {
  signaler('erreur', `L'écran de contact est introuvable : ${ECRAN_CONTACT}`);
}

// ---------------------------------------------------------------------------
//  9. L'écriture n'est ouverte qu'aux personnes nommées
// ---------------------------------------------------------------------------
//  Une politique d'écriture accordée à `anon` publierait sur l'application de
//  l'école depuis n'importe quel navigateur, sans compte. C'est la propriété
//  que la migration des membres du bureau doit tenir — et le genre d'ajout
//  qu'on fait un jour « juste pour débloquer » sans mesurer la portée.
//
//  Deux formes sont refusées, et la seconde est la plus sournoise :
//
//    - `for all|insert|update|delete to anon` : explicite, donc visible ;
//    - l'absence de clause `to`, qui vaut PUBLIC — et `anon` en fait partie.
//      Cette politique-là a l'air d'enfermer l'accès alors qu'elle l'ouvre à
//      tout le monde, et rien à la lecture ne le laisse voir.
//
//  Le contrôle lit aussi les politiques du stockage, que la section 2 ne voit
//  pas : elle ne cherche que `on public.<table>`, et `storage.objects` n'en
//  est pas une.
//
//  REFUSER `anon` NE SUFFIT PLUS — ET C'EST LE CONTRÔLE QUI MANQUAIT
//  ----------------------------------------------------------------
//  Depuis que la migration des membres du bureau ouvre l'écriture à
//  `authenticated`, la question n'est plus seulement « qui n'a pas de compte ».
//  Supabase autorise l'inscription publique par défaut : n'importe qui peut
//  créer un compte par `/auth/v1/signup`, obtenir un jeton `authenticated`, et
//  écrire. Le rôle ne dit pas QUI est la personne — seul le fait de figurer
//  dans `membres_bureau` le dit.
//
//  La condition `public.est_membre_bureau()` portée par chaque politique
//  d'écriture est donc LE verrou. Or rien ne la vérifiait :
//  `scripts/verifier-securite-api.mjs` interroge la base avec la clé ANON, si
//  bien qu'une politique visant `authenticated` sans condition lui est
//  INVISIBLE. Il passerait au vert sur une application que tout inscrit peut
//  modifier, et aucun autre contrôle ne regarde les politiques. La garantie
//  reposait donc sur la relecture — ce que ce projet refuse partout ailleurs.
//
//  La forme fautive est plausible : c'est la tentation que l'en-tête de la
//  migration nomme lui-même.
//
//    create policy annonces_bureau on public.annonces for all to authenticated
//      using (true) with check (true);   -- la 17e politique, et tout est ouvert
//
//  Les DEUX clauses sont exigées : `using` filtre les lignes visibles et
//  modifiables, `with check` filtre ce qui peut être écrit, et n'en garder
//  qu'une laisserait passer la moitié du geste. La condition est exigée
//  POSITIVE : `not public.est_membre_bureau()` la contiendrait aussi, et
//  refuserait exactement les personnes qu'on veut autoriser.
{
  const ECRITURE = new Set(['all', 'insert', 'update', 'delete']);
  const motifPolitique =
    /create\s+policy\s+([a-z0-9_]+)\s+on\s+([a-z0-9_.]+)\s+for\s+(all|select|insert|update|delete)([\s\S]*?);/g;

  let politique;
  let rencontrees = 0;
  let pourAuthenticated = 0;

  while ((politique = motifPolitique.exec(normalise)) !== null) {
    rencontrees += 1;
    const [, nom, table, commande, reste] = politique;
    const roles = /to\s+([a-z0-9_]+(?:\s*,\s*[a-z0-9_]+)*)/.exec(reste);

    verifier(
      roles !== null,
      `La politique « ${nom} » nomme les rôles qu'elle vise, au lieu de les laisser par défaut.`,
    );

    if (roles !== null && ECRITURE.has(commande)) {
      verifier(
        !/\banon\b/.test(roles[1]),
        `La politique « ${nom} » n'accorde pas « ${commande} » au rôle anonyme sur « ${table} ».`,
      );

      //  Une écriture ouverte aux personnes connectées doit dire LESQUELLES :
      //  `authenticated` s'obtient en s'inscrivant, et l'inscription est
      //  ouverte par défaut.
      if (/\bauthenticated\b/.test(roles[1])) {
        pourAuthenticated += 1;

        //  Les clauses sont délimitées par appariement des parenthèses, jamais
        //  par un intervalle libre — sans quoi la condition trouvée dans
        //  `with check` validerait un `using` ouvert. Voir `contenuParenthese`.
        const contenuUsing = contenuDeClause(reste, /using\s*\(/);
        const contenuCheck = contenuDeClause(reste, /with\s+check\s*\(/);

        const gardeDansUsing =
          contenuUsing !== null && contenuUsing.includes('public.est_membre_bureau()');
        const gardeDansCheck =
          contenuCheck !== null && contenuCheck.includes('public.est_membre_bureau()');

        verifier(
          gardeDansUsing && gardeDansCheck,
          `La politique « ${nom} » conditionne l'écriture sur « ${table} » à l'appartenance au bureau, dans « using » ET dans « with check ».`,
        );
        verifier(
          ![contenuUsing, contenuCheck].some(
            (contenu) => contenu !== null && /not\s+public\.est_membre_bureau\(\)/.test(contenu),
          ),
          `La politique « ${nom} » ne nie pas l'appartenance au bureau au lieu de l'exiger.`,
        );
      }
    }
  }

  //  Garde-fou du contrôle lui-même : si le motif cessait de correspondre, la
  //  boucle ci-dessus ne s'exécuterait aucune fois et le contrôle passerait en
  //  silence. Un contrôle dont la défaillance est muette doit être éprouvé.
  verifier(
    rencontrees >= politiques.length && rencontrees > 0,
    `Toutes les politiques du schéma ont été relues (${rencontrees} trouvée(s)).`,
  );

  //  Second garde-fou, pour la règle d'appartenance seule : sans politique
  //  d'écriture visant `authenticated`, elle s'appliquerait zéro fois et
  //  passerait au vert sans avoir rien regardé.
  verifier(
    pourAuthenticated > 0,
    `Les politiques d'écriture visant « authenticated » ont été relues (${pourAuthenticated} trouvée(s)).`,
  );
}

// ---------------------------------------------------------------------------
//  Rapport
// ---------------------------------------------------------------------------

const erreurs = problemes.filter((probleme) => probleme.gravite === 'erreur');

console.log(`\nContrôle du schéma — ${fichiers.length} migration(s), ${tables.size} table(s)`);
console.log(`${verifications.length} vérification(s) exécutée(s)\n`);

if (erreurs.length === 0) {
  console.log('Aucun défaut structurel détecté.\n');
  process.exit(0);
}

console.error(`${erreurs.length} défaut(s) détecté(s) :\n`);
for (const erreur of erreurs) {
  console.error(`  ✗ ${erreur.message}`);
}
console.error('');
process.exit(1);
