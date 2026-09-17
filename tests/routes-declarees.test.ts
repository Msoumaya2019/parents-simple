/**
 * Tests de l'accord entre les routes déclarées et les fichiers de `app/`.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * `app/_layout.tsx` le dit lui-même : « Un écran absent de cette liste s'affiche
 * SANS en-tête, donc sans flèche de retour […] C'est le piège le plus courant de
 * ce routeur, et il ne produit aucune erreur à la compilation. »
 *
 * Deux sources portent la même vérité sans pouvoir se lire : les fichiers posés
 * dans `app/`, que le routeur découvre, et les noms écrits à la main dans les
 * deux `_layout.tsx`. Un fichier ajouté sans déclaration — ou une déclaration
 * laissée en place après un renommage — ne casse rien : ni `tsc`, ni ESLint, ni
 * l'export. Le défaut n'apparaît que sur le téléphone, sous la forme d'un écran
 * sans retour ou d'un onglet sans libellé.
 *
 * Ce que ce fichier vérifie est donc exactement ce qu'un essai manuel éprouve
 * en premier : que chaque bouton mène quelque part, et que chaque destination
 * est atteignable.
 *
 * DEUX EXTRÊMES QUI NE DOIVENT PAS ÊTRE CONFONDUS
 * ----------------------------------------------
 * Un écart se lit dans les deux sens, et les deux sont des défauts :
 *
 *   - un fichier SANS déclaration — l'écran existe mais s'ouvre sans en-tête,
 *     ou l'onglet s'affiche avec l'icône de repli et le nom de sa route ;
 *   - une déclaration SANS fichier — la route est morte, et un lien qui la vise
 *     ne mène nulle part.
 *
 * Le contrôle compare donc des ensembles, il ne cherche pas seulement ce qui
 * manque.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

/** Extensions qu'expo-router reconnaît comme une route. */
const EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

/** Fichiers de `app/` qui ne sont pas des routes. */
const NON_ROUTES = new Set(['_layout.tsx', '+not-found.tsx']);

/**
 * Les cinq onglets, dans l'ordre de la maquette. L'ordre compte : il décide de
 * la position des pastilles dans la barre, et une permutation serait une
 * régression visible sans être une erreur.
 */
const ONGLETS_ATTENDUS = ['Accueil', 'Cantine', 'Agenda', 'Contact', 'Plus'];

/** Les écarts entre ce que le disque porte et ce que les déclarations nomment. */
function ecarts(
  fichiers: readonly string[],
  declares: readonly string[],
): { readonly manquants: readonly string[]; readonly fantomes: readonly string[] } {
  const poses = new Set(fichiers);
  const nommes = new Set(declares);

  return {
    // Sur le disque, absent des déclarations : l'écran existe et n'est pas
    // annoncé.
    manquants: fichiers.filter((nom) => !nommes.has(nom)),
    // Déclaré, sans fichier : la route est morte.
    fantomes: declares.filter((nom) => !poses.has(nom)),
  };
}

/**
 * Le message d'échec, qui NOMME les fichiers en cause.
 *
 * POURQUOI CE MESSAGE EST ÉCRIT ICI ET NON LAISSÉ À L'ASSERTION
 * -----------------------------------------------------------
 * La première version comparait des longueurs avant de comparer les ensembles.
 * Un fichier ajouté sans déclaration produisait alors « fichiers d'onglets
 * introuvables — 6 !== 5 » : un message qui dit le contraire de la situation, et
 * qui envoie chercher un fichier manquant alors qu'il y en a un de trop. Un
 * diagnostic faux coûte plus cher qu'une absence de diagnostic.
 */
function rapport(manquants: readonly string[], fantomes: readonly string[]): string {
  const lignes: string[] = [];
  if (manquants.length > 0) {
    lignes.push(`posé(s) dans app/ sans déclaration : ${manquants.join(', ')}`);
  }
  if (fantomes.length > 0) {
    lignes.push(`déclaré(s) sans fichier : ${fantomes.join(', ')}`);
  }
  return lignes.join(' — ');
}

/**
 * Le nom de route d'un chemin de fichier, tel qu'expo-router le présente.
 *
 * `app/annonce/[id].tsx` devient `annonce/[id]`. Les parenthèses d'un groupe —
 * `(tabs)` — sont conservées : c'est ainsi que la pile racine nomme le groupe,
 * et les retirer ferait diverger les deux côtés de la comparaison.
 */
function nomDeRoute(chemin: string): string {
  const extension = EXTENSIONS.find((candidate) => chemin.endsWith(candidate));
  if (extension === undefined) {
    // On lève plutôt que de rendre le chemin tel quel : un fichier d'une
    // extension imprévue ferait entrer dans la comparaison un nom qui ne
    // correspondrait à rien, et le test échouerait sur un faux écart.
    throw new Error(`Extension de route inconnue : « ${chemin} »`);
  }
  return chemin.slice(0, -extension.length);
}

/** Tous les fichiers d'un dossier, récursivement, en chemins relatifs POSIX. */
function fichiersSous(dossier: string, prefixe = ''): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(join(dossier, prefixe), { withFileTypes: true })) {
    const chemin = prefixe === '' ? entree.name : `${prefixe}/${entree.name}`;
    if (entree.isDirectory()) {
      trouves.push(...fichiersSous(dossier, chemin));
    } else {
      trouves.push(chemin);
    }
  }
  return trouves;
}

/** Les noms déclarés par `Stack.Screen`, sur une ou plusieurs lignes. */
function nomsDeLaPile(source: string): string[] {
  return [...source.matchAll(/Stack\.Screen\s+name="([^"]+)"/g)].map((trouve) => trouve[1] ?? '');
}

/** Les noms et titres d'onglets déclarés par `ONGLETS`. */
function ongletsDeclares(source: string): { readonly nom: string; readonly titre: string }[] {
  return [...source.matchAll(/\{\s*nom:\s*'([^']+)',\s*titre:\s*'([^']+)'/g)].map((trouve) => ({
    nom: trouve[1] ?? '',
    titre: trouve[2] ?? '',
  }));
}

const RACINE = process.cwd();
const DOSSIER_APP = join(RACINE, 'app');
const SOURCE_PILE = readFileSync(join(DOSSIER_APP, '_layout.tsx'), 'utf8');
const SOURCE_ONGLETS = readFileSync(join(DOSSIER_APP, '(tabs)', '_layout.tsx'), 'utf8');

describe('routes déclarées', () => {
  it('la comparaison voit les écarts dans les deux sens', () => {
    // Sans ce cas, un `ecarts` qui rendrait toujours deux listes vides passerait
    // au vert sur un dépôt parfaitement cohérent — c'est-à-dire un contrôle qui
    // ne contrôle rien. On éprouve donc la comparaison sur une entrée fausse.
    assert.deepEqual(ecarts(['a', 'b'], ['a']), { manquants: ['b'], fantomes: [] });
    assert.deepEqual(ecarts(['a'], ['a', 'b']), { manquants: [], fantomes: ['b'] });
    assert.deepEqual(ecarts(['a'], ['a']), { manquants: [], fantomes: [] });
  });

  it('le nom d’une route se déduit de son chemin, groupe compris', () => {
    assert.equal(nomDeRoute('annonce/[id].tsx'), 'annonce/[id]');
    assert.equal(nomDeRoute('documents.ts'), 'documents');
    assert.throws(() => nomDeRoute('reglages.mdx'), /Extension de route inconnue/);
  });

  it('les déclarations sont lues, y compris sur plusieurs lignes', () => {
    const source = [
      '<Stack.Screen name="(tabs)" options={{ headerShown: false }} />',
      '<Stack.Screen',
      '  name="confidentialite"',
      '  options={{ headerShown: true }}',
      '/>',
    ].join('\n');

    assert.deepEqual(nomsDeLaPile(source), ['(tabs)', 'confidentialite']);
  });

  it('chaque onglet déclaré a son fichier, et réciproquement', () => {
    const fichiers = fichiersSous(DOSSIER_APP)
      .filter((chemin) => chemin.startsWith('(tabs)/'))
      .map((chemin) => chemin.slice('(tabs)/'.length))
      .filter((chemin) => !NON_ROUTES.has(chemin))
      .map(nomDeRoute);

    const declares = ongletsDeclares(SOURCE_ONGLETS).map((onglet) => onglet.nom);

    // L'extraction doit avoir trouvé quelque chose, sans quoi l'accord
    // passerait à vide — deux listes vides étant parfaitement égales. On
    // n'exige PAS un nombre attendu : ce serait refaire le travail du test des
    // titres, avec un message moins juste.
    assert.ok(declares.length > 0, 'aucun onglet déclaré extrait — l’analyse ne fonctionne plus');
    assert.ok(fichiers.length > 0, 'aucun fichier d’onglet trouvé — l’analyse ne fonctionne plus');

    const { manquants, fantomes } = ecarts(fichiers, declares);
    assert.deepEqual(
      { manquants, fantomes },
      { manquants: [], fantomes: [] },
      rapport(manquants, fantomes),
    );
  });

  it('les onglets portent les cinq titres de la maquette, dans l’ordre', () => {
    assert.deepEqual(
      ongletsDeclares(SOURCE_ONGLETS).map((onglet) => onglet.titre),
      ONGLETS_ATTENDUS,
    );
  });

  it('chaque écran de la pile a son fichier, et réciproquement', () => {
    const fichiers = fichiersSous(DOSSIER_APP)
      .filter((chemin) => !chemin.startsWith('(tabs)/'))
      .filter((chemin) => !NON_ROUTES.has(chemin))
      .map(nomDeRoute);

    // Le groupe `(tabs)` n'est pas un fichier : c'est le dossier lui-même, et
    // la pile le déclare sous ce nom.
    const declares = nomsDeLaPile(SOURCE_PILE);

    assert.ok(
      declares.length > 0,
      'aucune déclaration de pile extraite — l’analyse ne fonctionne plus',
    );
    assert.ok(fichiers.length > 0, 'aucun fichier d’écran trouvé — l’analyse ne fonctionne plus');

    const { manquants, fantomes } = ecarts([...fichiers, '(tabs)'], declares);
    assert.deepEqual(
      { manquants, fantomes },
      { manquants: [], fantomes: [] },
      rapport(manquants, fantomes),
    );
  });
});
