/**
 * Les icônes qui accompagnent un texte sont masquées aux lecteurs d'écran.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `src/components/ui/Pill.tsx` promet, dans son en-tête, que son icône
 * « est masquée aux lecteurs d'écran, puisque le libellé dit déjà tout ». La
 * promesse n'était tenue par rien : `<Ionicons>` recevait un nom, une taille et
 * une couleur, et rien d'autre.
 *
 * Le défaut est réel, et pas seulement théorique. `@expo/vector-icons` rend
 * chaque glyphe dans un `<Text>` — `create-icon-set.js` fait
 * `const { name, size, color, style, children, ...props } = this.props` puis
 * `<Text selectable={false} {...props}>` — et `Libraries/Text/Text.js` rend un
 * `Text` accessible par défaut sur iOS (`ios: accessible !== false`). Un glyphe
 * est un caractère de la zone privée Unicode : VoiceOver s'y arrête et
 * l'annonce, à côté du libellé qui dit déjà tout.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * Toute balise `<Ionicons>` du projet porte `aria-hidden`. La règle est
 * appliquée **par élément**, jamais par un compte : un fichier ajouté qui
 * contient une icône non masquée fait échouer le banc.
 *
 * `aria-hidden` est le bon levier, et il est vérifié plutôt que supposé. Dans
 * les paquets installés :
 *
 *   - `Libraries/Components/View/View.js` — `ariaHidden` devient
 *     `accessibilityElementsHidden`, et quand il vaut `true`,
 *     `importantForAccessibility = 'no-hide-descendants'` ;
 *   - `Libraries/Text/Text.js` — la même traduction, aux mêmes conditions.
 *
 * Le premier fichier suffit à `Ionicons`, qui rend un `Text` et lui transmet
 * ses props ; le second est la raison pour laquelle le masquage est nécessaire.
 *
 * DEUX SITUATIONS, UNE SEULE RÈGLE
 * --------------------------------
 * Le masquage corrige un défaut quand l'icône n'est pas déjà dans un conteneur
 * accessible : `Pill` et `LienAction` posent leurs enfants dans un `View` nu,
 * qui n'est pas accessible (`View.js` ne calcule aucun `_accessible`), donc
 * chaque `Text` est lu séparément. Il est redondant quand un `Pressable`
 * englobant porte déjà `accessibilityLabel` — `Pressable.js` fait
 * `accessible: accessible !== false`, donc il est accessible par défaut, et ses
 * enfants sont fusionnés dans son annonce.
 *
 * Les deux cas reçoivent le même traitement, délibérément : la règle est ainsi
 * vérifiable par élément, sans exception à lire ni sous-arbre à analyser. Le
 * cas redondant ne coûte rien ; il ne retire rien à une annonce portée par le
 * parent, qui a son propre libellé.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que le masquage **fonctionne**. Aucun moteur de rendu n'est installé —
 * `react-test-renderer` et `@testing-library/react-native` sont absents — donc
 * le banc lit la présence de la prop, jamais son effet. C'est la même limite
 * que partout ailleurs dans ce dépôt : il tient ce qui est écrit, pas ce qui
 * s'affiche.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const DOSSIERS = [join(RACINE, 'src', 'components'), join(RACINE, 'app')];

/**
 * Les fichiers qui portent une icône, et eux seuls.
 *
 * La liste est fermée. Un fichier ajouté avec une icône fait échouer le banc
 * tant qu'il n'y figure pas, et un fichier qui perd la sienne aussi : c'est ce
 * qui empêche l'inventaire de se vider en silence, un banc qui ne trouve plus
 * rien passant toujours.
 */
const FICHIERS_A_ICONE: readonly string[] = [
  'app/(tabs)/cantine.tsx',
  'app/(tabs)/plus.tsx',
  'app/documents.tsx',
  'app/reglages.tsx',
  'src/components/AccesRapide.tsx',
  'src/components/BanniereAccueil.tsx',
  'src/components/BarreOnglets.tsx',
  'src/components/SondageAccueil.tsx',
  'src/components/ui/ImageDistante.tsx',
  'src/components/ui/LienAction.tsx',
  'src/components/ui/Pill.tsx',
];

/**
 * Le nombre de balises attendues dans tout le projet.
 *
 * Il protège l'extraction elle-même : si le découpage cessait de reconnaître
 * une balise, le compte baisserait et le banc le dirait, au lieu de passer en
 * ne contrôlant plus rien.
 */
const NOMBRE_DE_BALISES = 15;

/** Le source privé de ses commentaires, comme partout dans ce dépôt. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function fichiersTsx(dossier: string): readonly string[] {
  const trouves: string[] = [];

  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      trouves.push(...fichiersTsx(chemin));
    } else if (entree.endsWith('.tsx')) {
      trouves.push(chemin);
    }
  }

  return trouves;
}

interface Balise {
  readonly fichier: string;
  readonly ligne: number;
  /** La balise telle qu'elle est écrite, commentaires compris. */
  readonly texte: string;
}

/**
 * Les balises `<Ionicons>` d'un fichier, avec leur ligne.
 *
 * L'extraction se fait sur le source **brut** : les commentaires ont été
 * retirés plus haut dans d'autres bancs, mais ici ils décaleraient les numéros
 * de ligne, et un message d'erreur qui désigne la mauvaise ligne ne sert à
 * rien. C'est le test du masquage, plus bas, qui retire les commentaires — à
 * l'intérieur de la balise, là où un commentaire pourrait faire croire à une
 * prop absente.
 */
function balisesIonicons(chemin: string): readonly Balise[] {
  const brut = readFileSync(chemin, 'utf8');
  const balises: Balise[] = [];

  let index = brut.indexOf('<Ionicons');
  while (index !== -1) {
    const fin = brut.indexOf('/>', index);
    // Une balise non auto-fermante n'existe pas dans ce projet ; si elle
    // apparaissait, on lirait jusqu'au `>` suivant plutôt que de tout avaler.
    const limite = fin === -1 ? brut.indexOf('>', index) : fin + 2;
    const texte = brut.slice(index, limite === -1 ? index + 400 : limite);

    balises.push({
      fichier: chemin,
      ligne: brut.slice(0, index).split('\n').length,
      texte,
    });

    index = brut.indexOf('<Ionicons', index + 1);
  }

  return balises;
}

/** Vrai si la balise porte `aria-hidden`, commentaires de la balise exclus. */
function estMasquee(balise: Balise): boolean {
  const nettoyee = sansCommentaires(balise.texte);
  return /\baria-hidden\b(?!\s*=\s*\{?\s*false)/.test(nettoyee);
}

/**
 * Le chemin relatif, en séparateurs obliques.
 *
 * `relative` rend des antislashs sous Windows et des obliques sous Linux : un
 * banc qui comparerait l'un à l'autre passerait sur la CI et échouerait ici, ou
 * l'inverse. Les noms des fichiers attendus sont donc écrits en obliques, et
 * tout chemin lu est ramené à cette forme.
 */
function cheminRelatif(chemin: string): string {
  return relative(RACINE, chemin).replace(/\\/g, '/');
}

const FICHIERS = DOSSIERS.flatMap(fichiersTsx).sort();
const BALISES = FICHIERS.flatMap(balisesIonicons);
const PORTEURS = [...new Set(BALISES.map((balise) => cheminRelatif(balise.fichier)))].sort();

function situer(balise: Balise): string {
  return `${cheminRelatif(balise.fichier)}:${balise.ligne}`;
}

describe('L’inventaire des icônes est complet, et fermé', () => {
  it('les fichiers porteurs d’une icône sont exactement ceux attendus', () => {
    assert.deepEqual(
      PORTEURS,
      [...FICHIERS_A_ICONE].sort(),
      'un fichier a gagné ou perdu une icône : il doit être inscrit dans FICHIERS_A_ICONE',
    );
  });

  it(`le projet compte ${NOMBRE_DE_BALISES} balises, toutes retrouvées`, () => {
    assert.equal(
      BALISES.length,
      NOMBRE_DE_BALISES,
      'le découpage ne reconnaît plus toutes les balises, ou une icône a été ajoutée',
    );
  });

  it('l’extraction atteint la fin de chaque balise', () => {
    for (const balise of BALISES) {
      assert.match(
        balise.texte,
        /\/>$/,
        `${situer(balise)} : la balise n’a pas été lue jusqu’à sa fermeture`,
      );
    }
  });
});

describe('Chaque icône est masquée aux lecteurs d’écran', () => {
  for (const balise of BALISES) {
    it(`${situer(balise)}`, () => {
      assert.ok(
        estMasquee(balise),
        `${situer(balise)} : cette icône accompagne un texte qui dit déjà tout. ` +
          'Sans `aria-hidden`, un lecteur d’écran l’annonce en plus du libellé.',
      );
    });
  }
});

describe('Le banc ne se satisfait pas d’un commentaire', () => {
  it('une balise dont seul le commentaire nomme aria-hidden est refusée', () => {
    // Le piège déjà payé dans ce dépôt : un banc qui lit un source est
    // satisfait par une phrase de commentaire. Ici la phrase est dans la
    // balise elle-même, juste avant la prop absente.
    const piege: Balise = {
      fichier: join(RACINE, 'faux.tsx'),
      ligne: 1,
      texte: '<Ionicons\n  name="sparkles"\n  // aria-hidden est posé plus bas\n  size={14}\n/>',
    };

    assert.equal(estMasquee(piege), false, 'un commentaire ne vaut pas une prop');
  });

  it('la prop posée, elle, est reconnue', () => {
    const correcte: Balise = {
      fichier: join(RACINE, 'faux.tsx'),
      ligne: 1,
      texte: '<Ionicons name="sparkles" size={14} aria-hidden />',
    };

    assert.equal(estMasquee(correcte), true);
  });

  it('un masquage désactivé ne compte pas', () => {
    const desactivee: Balise = {
      fichier: join(RACINE, 'faux.tsx'),
      ligne: 1,
      texte: '<Ionicons name="sparkles" size={14} aria-hidden={false} />',
    };

    assert.equal(estMasquee(desactivee), false, 'aria-hidden={false} ne masque rien');
  });
});
