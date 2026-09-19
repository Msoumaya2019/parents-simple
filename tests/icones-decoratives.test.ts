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
 * chaque glyphe dans un `<Text>` — `build/vendor/react-native-vector-icons/
 * lib/create-icon-set.js` fait
 * `const { name, size, color, style, children, ...props } = this.props` puis
 * `<Text selectable={false} {...props}>`, et c'est ce fichier-là qu'il faut
 * citer : `build/createIconSet.js`, au nom voisin, ne fait que transmettre ses
 * props à ce composant — et `Libraries/Text/Text.js` rend un `Text` accessible
 * par défaut sur iOS (`ios: accessible !== false`). Un glyphe est un caractère
 * de la zone privée Unicode : VoiceOver s'y arrête et l'annonce, à côté du
 * libellé qui dit déjà tout.
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
 *   - `Libraries/Text/Text.js` — `ariaHidden` devient
 *     `accessibilityElementsHidden`, et quand il vaut `true`,
 *     `importantForAccessibility = 'no-hide-descendants'` ;
 *   - `Libraries/Components/View/View.js` — la même traduction, aux mêmes
 *     conditions.
 *
 * C'est le PREMIER qui porte la prop pour une icône, et non le second :
 * `Ionicons` rend un `Text`, donc c'est `Text.js` qui la traite. `View.js` ne
 * s'applique qu'aux conteneurs — le citer ici revenait à attribuer à une `View`
 * une traduction qui n'a jamais lieu pour un glyphe.
 *
 * Ces deux traductions sont RELUES dans le paquet installé par le dernier
 * `describe`, et non recopiées : une phrase de commentaire sur un paquet
 * installé se périme au premier changement de version, en silence.
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

// ---------------------------------------------------------------------------
// La traduction de `aria-hidden`, relue dans le paquet installé
// ---------------------------------------------------------------------------
// Ce qui suit ne sert qu'au dernier `describe`, et c'est pour cela qu'il est
// écrit ici plutôt qu'en tête : ces chemins ne valent que pour lui.

const TEXT_JS = join(RACINE, 'node_modules', 'react-native', 'Libraries', 'Text', 'Text.js');
const VIEW_JS = join(
  RACINE,
  'node_modules',
  'react-native',
  'Libraries',
  'Components',
  'View',
  'View.js',
);
const CREATE_ICON_SET = join(
  RACINE,
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'lib',
  'create-icon-set.js',
);

/**
 * Le corps d'un `if`, de son `{` à son `}` apparié.
 *
 * Les accolades sont COMPTÉES, et non coupées par une expression non
 * gourmande : le corps qui nous intéresse en contient un autre, et une coupure
 * au premier `}` s'arrêterait sur l'`if` imbriqué, avant la ligne cherchée. Le
 * banc deviendrait alors rouge sur un paquet inchangé.
 */
function corpsDuIf(source: string, debut: string): string | null {
  const ouverture = source.indexOf(debut);
  if (ouverture === -1) {
    return null;
  }

  const accolade = source.indexOf('{', ouverture);
  if (accolade === -1) {
    return null;
  }

  let profondeur = 0;
  for (let index = accolade; index < source.length; index += 1) {
    const caractere = source[index];
    if (caractere === '{') {
      profondeur += 1;
    } else if (caractere === '}') {
      profondeur -= 1;
      if (profondeur === 0) {
        return source.slice(accolade, index + 1);
      }
    }
  }

  return null;
}

/**
 * Vrai si ce source porte les DEUX lignes de la traduction, dans le même `if`.
 *
 * La condition porte sur le corps, et non sur la présence des deux lignes
 * quelque part dans le fichier : deux lignes éloignées l'une de l'autre ne
 * forment pas une traduction, et un contrôle qui les chercherait séparément
 * serait vert sur un fichier où elles ont cessé d'aller ensemble.
 */
function traduitAriaHidden(source: string): boolean {
  const corps = corpsDuIf(source, 'if (ariaHidden !== undefined)');
  if (corps === null) {
    return false;
  }
  return (
    /processedProps\.accessibilityElementsHidden = ariaHidden;/.test(corps) &&
    /importantForAccessibility = 'no-hide-descendants';/.test(corps)
  );
}

describe('La traduction de `aria-hidden` est relue, jamais recopiée', () => {
  it('`Text.js` la porte — c’est lui qui traite la prop d’une icône', () => {
    assert.ok(
      traduitAriaHidden(readFileSync(TEXT_JS, 'utf8')),
      '`Libraries/Text/Text.js` ne traduit plus `aria-hidden` comme l’en-tête l’affirme',
    );
  });

  it('`View.js` porte la même traduction, pour les conteneurs', () => {
    assert.ok(
      traduitAriaHidden(readFileSync(VIEW_JS, 'utf8')),
      '`Libraries/Components/View/View.js` ne traduit plus `aria-hidden` comme l’en-tête l’affirme',
    );
  });

  it('un glyphe est rendu dans un `Text`, et non dans une `View`', () => {
    const source = readFileSync(CREATE_ICON_SET, 'utf8');
    assert.match(
      source,
      /const \{ name, size, color, style, children, \.\.\.props \} = this\.props;/,
      'le composant d’icône ne sépare plus les props du glyphe : le masquage ne les atteindrait plus',
    );
    assert.match(
      source,
      /<Text selectable=\{false\} \{\.\.\.props\}>/,
      'le composant d’icône ne rend plus un `Text` : `Text.js` n’est plus le fichier qui compte',
    );
  });

  it('un bloc qui ne pose qu’une des deux lignes est refusé', () => {
    const incomplet =
      'if (ariaHidden !== undefined) {\n' +
      '  processedProps.accessibilityElementsHidden = ariaHidden;\n' +
      '}\n';
    assert.equal(traduitAriaHidden(incomplet), false, 'une traduction incomplète ne compte pas');
  });

  it('le corps d’un `if` est compté, et non coupé au premier `}`', () => {
    // La ligne cherchée est APRÈS un `if` imbriqué. Une extraction non
    // gourmande s'arrêterait au `}` de cet `if` et la manquerait — le banc
    // deviendrait rouge sur un paquet inchangé, ce qui est pire que pas de
    // banc du tout.
    const faux =
      'if (ariaHidden !== undefined) {\n' +
      '  avant();\n' +
      '  if (imbrique) {\n' +
      '    dedans();\n' +
      '  }\n' +
      '  apres();\n' +
      '}\n';

    const corps = corpsDuIf(faux, 'if (ariaHidden !== undefined)');
    assert.ok(corps !== null, 'l’extraction n’a rien trouvé');
    assert.match(corps, /dedans\(\);/, 'l’extraction n’a pas pris tout le corps');
    assert.match(corps, /apres\(\);/, 'l’extraction s’est arrêtée à l’`if` imbriqué');
  });
});
