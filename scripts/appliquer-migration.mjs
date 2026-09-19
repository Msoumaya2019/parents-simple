/**
 * Applique une migration Supabase par l'API Management, c'est-à-dire par le
 * même point d'entrée que l'éditeur SQL du tableau de bord.
 *
 *   POST https://api.supabase.com/v1/projects/{ref}/database/query
 *
 * POURQUOI CET OUTIL EXISTE
 * -------------------------
 * Dans ce projet, les migrations se collent à la main : c'est la seule étape
 * sans contrôle. Elle échoue dans le sens qui coûte cher — la migration est
 * écrite, relue, validée par les contrôles statiques, et pourtant jamais
 * appliquée. Le symptôme apparaît plus tard, dans une compilation qui s'arrête
 * sur une table absente.
 *
 * Un seul lot, pas d'historique de migration : c'est ce qui distingue cet
 * appel de `supabase db push`, qui comparerait au dépôt distant et tenterait
 * de réappliquer ce que l'historique ignore.
 *
 * LE JETON N'EST JAMAIS ÉCRIT ICI. Il vient de SUPABASE_ACCESS_TOKEN, ou du
 * fichier que `npx supabase login` dépose dans ~/.supabase/access-token. Un
 * jeton collé dans un script est un jeton compromis — et sur un dépôt public,
 * immédiatement.
 *
 * Usage : node scripts/appliquer-migration.mjs supabase/migrations/<fichier>.sql
 *
 * Un outil qui ne peut rien affirmer doit échouer : sans jeton, sans fichier,
 * sur un fichier qui n'est pas du SQL de ce projet, ou sur une réponse non 2xx,
 * il sort en code non nul et le dit.
 *
 * LE FICHIER EST VÉRIFIÉ AVANT D'ÊTRE ENVOYÉ, ET C'EST RÉCENT
 * ---------------------------------------------------------
 * Pendant longtemps, l'outil envoyait au point d'entrée SQL le contenu de
 * n'importe quel fichier existant. Mesuré : lancé avec **le script lui-même**
 * en argument, il a envoyé son propre source à la base, qui a répondu
 *
 *   42601: syntax error at or near "{"
 *   LINE 29: import { readFileSync, existsSync } from 'node:fs';
 *
 * L'erreur est exacte, et elle parle de la ligne 29 d'un fichier JavaScript —
 * pas de la migration qu'on croyait appliquer. Un outil dont l'échec consiste à
 * envoyer du JavaScript à une base de données doit refuser ce qu'il ne peut pas
 * reconnaître. C'est la règle du dépôt : un contrôle qui ne peut rien affirmer
 * échoue, il ne passe pas.
 *
 * Les deux règles vivent dans des fonctions PURES, exportées, éprouvées par
 * `tests/migration-argument.test.mjs` — une règle qui compte se charge sous
 * `node --test`, et celle-ci décide de ce qui part vers la base.
 */
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// La racine se déduit de l'emplacement du script, jamais du répertoire
// courant : lancé depuis `scripts/` ou depuis ailleurs, l'outil doit lire le
// même `.env.local`. Un chemin relatif aurait marché une fois sur deux, et
// échoué sur un message qui ne dit rien de la vraie cause.
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function abandon(message) {
  console.error(`[ECHEC] ${message}`);
  process.exit(1);
}

/**
 * Ce chemin peut-il être envoyé à la base ?
 *
 * Le chemin est attendu **relatif à la racine**, en séparateurs `/`. La
 * normalisation est faite par l'appelant : sans elle, `relative()` rend des
 * antislashs sous Windows et des barres obliques sous Linux, et la même règle
 * donnerait deux verdicts selon la machine — le banc ne mesurerait alors pas ce
 * que la CI exécute.
 *
 * Deux refus, et le second n'est pas une coquetterie : l'outil existe pour
 * appliquer le SQL de CE projet, et son mode d'emploi ne nomme qu'un
 * emplacement. Un fichier hors de `supabase/` n'est pas une migration, c'est une
 * erreur d'argument — et la dire vaut mieux que d'envoyer le contenu.
 */
export function verdictSurLeChemin(cheminRelatif) {
  if (!cheminRelatif.endsWith('.sql')) {
    return {
      ok: false,
      message:
        `ce n'est pas un fichier .sql : ${cheminRelatif}\n` +
        '        L’outil envoie le contenu tel quel à la base : il n’applique que du SQL.',
    };
  }

  if (!cheminRelatif.startsWith('supabase/')) {
    return {
      ok: false,
      message:
        `ce fichier est hors de supabase/ : ${cheminRelatif}\n` +
        '        Les deux emplacements légitimes sont\n' +
        '          supabase/migrations/<horodatage>_<nom>.sql\n' +
        '          supabase/exemple-contenu.sql',
    };
  }

  return { ok: true, message: '' };
}

/**
 * Ce contenu est-il du SQL, et non un module JavaScript renommé ?
 *
 * L'extension ne suffit pas : `mv migration.mjs migration.sql` passerait le
 * contrôle précédent. Un module JavaScript commence par `import`, `export` ou
 * `const … = require(`, qu'aucune instruction SQL ne commence.
 *
 * CE QUE CE CONTRÔLE NE PROUVE PAS — ET IL FAUT LE SAVOIR
 * -------------------------------------------------------
 * C'est une liste de refus, pas une preuve d'être du SQL. Elle attrape le
 * fichier qu'on lui a réellement passé un jour ; elle ne reconnaîtrait pas un
 * binaire, ni un autre langage, ni la mauvaise migration parmi les bonnes. Le
 * seul contrôle qui tranche sur ce que la base porte, c'est celui qui
 * l'interroge — `npm run securite:api` et `npm run verifier:requetes`.
 *
 * Le fichier vide est refusé pour une raison voisine : l'API répond **200** à
 * un lot vide, donc l'outil annoncerait un succès sans avoir rien appliqué.
 */
export function verdictSurLeContenu(contenu) {
  if (contenu.trim() === '') {
    return {
      ok: false,
      message: 'le fichier est vide : l’API répondrait 200 sans rien appliquer.',
    };
  }

  const module = /^\s*(import|export)\s|^\s*const\s+[^\n]*=\s*require\s*\(/m.exec(contenu);
  if (module !== null) {
    return {
      ok: false,
      message:
        `ce fichier contient du JavaScript : « ${module[0].trim()} »\n` +
        '        Il porte peut-être l’extension .sql, mais ce n’est pas du SQL.',
    };
  }

  return { ok: true, message: '' };
}

async function principal() {
  const cheminSql = process.argv[2];
  if (!cheminSql) {
    abandon('usage : node scripts/appliquer-migration.mjs <chemin, depuis la racine du dépôt>');
  }

  // Le chemin se lit depuis la racine du dépôt, pas depuis le répertoire
  // courant : l'appel est ainsi identique d'où qu'on le lance. Le message
  // d'erreur doit le dire — sans quoi on cherche une faute de frappe là où il
  // n'y a qu'une convention, et `../supabase/…` lancé depuis `scripts/` échoue
  // pour une raison qui ne dit rien de la vraie cause.
  const sql = resolve(RACINE, cheminSql);
  if (!existsSync(sql)) {
    abandon(`migration introuvable : ${sql}\n        (les chemins se lisent depuis ${RACINE})`);
  }

  // Le contenu est lu AVANT le jeton et avant tout appel réseau : un argument
  // fautif doit être refusé sans qu'aucune requête ne parte.
  const cheminRelatif = relative(RACINE, sql).split(sep).join('/');
  const surLeChemin = verdictSurLeChemin(cheminRelatif);
  if (!surLeChemin.ok) abandon(surLeChemin.message);

  const contenu = readFileSync(sql, 'utf8');
  const surLeContenu = verdictSurLeContenu(contenu);
  if (!surLeContenu.ok) abandon(surLeContenu.message);

  // --- Le jeton -------------------------------------------------------------
  let jeton = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  let origine = 'SUPABASE_ACCESS_TOKEN';
  if (!jeton) {
    const fichier = join(homedir(), '.supabase', 'access-token');
    if (existsSync(fichier)) {
      jeton = readFileSync(fichier, 'utf8').trim();
      origine = fichier;
    }
  }
  if (!jeton) {
    abandon(
      "aucun jeton Management. Lancez d'abord, dans un terminal :\n" +
        '        npx supabase login\n' +
        '      puis relancez cette commande. (Rien sur cette machine ne peut écrire\n' +
        '      dans la base sans un canal authentifié.)',
    );
  }
  // Le refus porte sur la FORME, pas sur la longueur : un seuil de longueur
  // désactiverait le contrôle sur les jetons plus courts, et un jeton d'une
  // autre nature passerait.
  if (!/^sbp_/.test(jeton)) {
    abandon(`jeton suspect : il ne commence pas par sbp_ (origine : ${origine}).`);
  }
  console.log(`Jeton : ${origine} (${jeton.length} caractères, non affiché)`);

  // --- La référence du projet, lue dans .env.local, jamais codée en dur -----
  const fichierEnv = join(RACINE, '.env.local');
  if (!existsSync(fichierEnv)) abandon(`.env.local introuvable : ${fichierEnv}`);
  const env = readFileSync(fichierEnv, 'utf8');
  const url = /^EXPO_PUBLIC_SUPABASE_URL=(.+)$/m.exec(env)?.[1]?.trim();
  if (!url) abandon('EXPO_PUBLIC_SUPABASE_URL introuvable dans .env.local');
  const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co/.exec(url)?.[1];
  if (!ref) abandon(`URL inattendue dans .env.local : ${url}`);
  console.log(`Projet : ${ref}`);

  // --- L'envoi -------------------------------------------------------------
  const lignes = contenu.split('\n').length;
  const premiere =
    contenu
      .split('\n')
      .find((l) => l.trim() !== '')
      ?.trim() ?? '';
  console.log(`Migration : ${cheminRelatif} (${lignes} lignes, ${contenu.length} caractères)`);
  // La première ligne est affichée parce que c'est la dernière chose lisible
  // avant que le contenu ne parte : un fichier qui n'est pas celui qu'on croit
  // se voit ici, sur un commentaire de tête qui ne dit pas la même chose.
  console.log(`Première ligne : ${premiere.slice(0, 100)}`);

  const reponse = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jeton}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: contenu }),
  });

  const texte = await reponse.text();
  if (!reponse.ok) {
    console.error(`[ECHEC] HTTP ${reponse.status}`);
    console.error(texte.slice(0, 2000));
    process.exit(1);
  }

  console.log(`[OK] HTTP ${reponse.status}`);
  console.log(texte.slice(0, 2000));

  // Un `[OK]` ne dit pas que la base porte ce qu'on croit : l'API répond 200
  // pour un lot vide comme pour un lot appliqué. Le contrôle qui tranche
  // interroge la base réelle, et lui seul distingue « fermé » de « absent ».
  console.log(
    '\nÉtape suivante — les deux contrôles qui interrogent la base réelle :\n' +
      '        npm run securite:api\n' +
      '        npm run verifier:requetes\n' +
      '      Un `404` sur la table nouvelle signifie « pas appliquée », pas « protégée ».',
  );
}

/**
 * N'interroge la base que si ce fichier est LANCÉ, jamais s'il est importé.
 *
 * Sans cette garde, `tests/migration-argument.test.mjs` déclencherait tout
 * l'outil en important les deux règles qu'il éprouve : le banc sortirait en
 * code 1 sur « usage : … », et la suite de tests dépendrait d'un jeton et du
 * réseau — ce que ce projet refuse partout ailleurs.
 *
 * CETTE GARDE NE SUFFIT PAS — et c'est écrit ici parce que le script voisin l'a
 * appris à ses dépens : elle ne retient que `principal()`. Tout ce qui
 * s'exécuterait au niveau du module passerait AVANT elle. Il n'y a donc, ici,
 * aucune instruction au niveau du module hormis les deux `const` de ce fichier
 * et les définitions de fonctions.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await principal();
}
