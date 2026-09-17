/**
 * Thème de l'application.
 *
 * Deux palettes, une seule forme. Les écrans ne connaissent jamais une couleur
 * en dur : ils demandent `theme.colors.textPrimary`, et le mode clair ou sombre
 * se décide ailleurs, une fois.
 *
 * POURQUOI `useColorScheme` NE SUFFIT PAS
 * ---------------------------------------
 * Le thème système est suivi par défaut, mais un parent doit pouvoir forcer le
 * clair ou le sombre — c'est utile sur un téléphone en plein soleil, ou le soir
 * dans une chambre d'enfant. Le choix est donc stocké sur l'appareil, et
 * « Automatique » reste l'option par défaut.
 *
 * CONTRASTE
 * ---------
 * Les teintes de texte ne sont pas choisies à l'œil. `textMuted` sur `surface`
 * garde un rapport de contraste supérieur à 4,5:1 dans les deux modes, seuil
 * au-delà duquel un texte reste lisible pour un œil fatigué — ce qui est le cas
 * d'un parent qui consulte l'application en fin de journée.
 */

export type ThemeMode = 'light' | 'dark';

/** Les cinq teintes pastel de l'interface. */
export type TonPastel = 'bleu' | 'violet' | 'menthe' | 'orange' | 'corail';

/**
 * Un ton pastel : un fond clair, et une encre lisible posée dessus.
 *
 * Les deux vont ensemble et ne se choisissent jamais séparément. C'est la seule
 * façon d'empêcher qu'un écran pose une encre sombre sur un fond devenu sombre
 * en mode nuit — un défaut qui ne se voit que sur le téléphone de celui qui a
 * activé ce mode.
 */
export interface CouleursPastel {
  readonly fond: string;
  readonly encre: string;
}

export interface ThemeColors {
  /** Couleur d'action : boutons, onglet actif, accents. */
  readonly primary: string;
  /** Fond discret de la couleur d'action, pour un badge ou une puce. */
  readonly primarySoft: string;
  /** Texte posé sur `primary`. */
  readonly textOnPrimary: string;

  /** Fond général de l'application. */
  readonly background: string;
  /** Fond des cartes et des barres. */
  readonly surface: string;
  /** Fond légèrement détaché, pour un encart dans une carte. */
  readonly surfaceSunken: string;
  /** Filets de séparation. */
  readonly border: string;

  readonly textPrimary: string;
  readonly textSecondary: string;
  readonly textMuted: string;

  readonly success: string;
  readonly warning: string;
  readonly danger: string;
  readonly dangerSoft: string;

  /** Voile des images d'illustration et du bouton d'action flottant. */
  readonly overlay: string;

  /**
   * Teintes pastel décoratives : bannière, accès rapides, pastilles de
   * catégorie, carte de sondage.
   *
   * Elles ne portent JAMAIS une information à elles seules. Une pastille dit
   * toujours son libellé, et la couleur ne fait que renforcer. Environ un homme
   * sur douze distingue mal le rouge du vert : une catégorie qui ne se lirait
   * qu'à la teinte ne lui dirait rien.
   *
   * Le rapport de contraste de chaque paire `encre`/`fond` est vérifié par un
   * test, `tests/theme-contraste.test.ts`. Un ton ajouté ici sans son test ne
   * serait qu'une intention.
   */
  readonly pastels: Readonly<Record<TonPastel, CouleursPastel>>;

  /**
   * Teintes décoratives de la bannière d'accueil : ciel, soleil, feuillage.
   *
   * Elles ne portent aucun texte, sauf `ciel` et `cielBas`, sur lesquels le
   * titre et le sous-titre de la bannière sont posés — et ces deux-là sont donc
   * soumis au test de contraste comme les autres fonds.
   */
  readonly decor: {
    /** Haut du dégradé de la bannière. */
    readonly ciel: string;
    /** Bas du dégradé, qui rejoint le fond de l'écran. */
    readonly cielBas: string;
    readonly soleil: string;
    readonly feuille: string;
    readonly feuilleClaire: string;
  };
}

export interface ThemeSpacing {
  readonly xs: number;
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly xxl: number;
}

export interface ThemeRadii {
  readonly sm: number;
  readonly md: number;
  readonly lg: number;
  readonly xl: number;
  readonly pill: number;
}

/**
 * Ombres portées.
 *
 * POURQUOI `boxShadow` ET NON `shadowColor`/`elevation`
 * ----------------------------------------------------
 * Le projet évitait jusqu'ici les ombres, et le commentaire de `Card` disait
 * pourquoi : `shadowOffset`/`shadowOpacity` ne s'appliquent qu'à iOS, et
 * Android leur substitue `elevation`, rendu différemment selon la version du
 * système — deux appareils côte à côte ne montraient alors pas la même
 * application.
 *
 * `boxShadow` lève cette objection. React Native le prend en charge sur les
 * deux plateformes depuis la 0.76, et ce projet tourne sous la nouvelle
 * architecture (`newArchEnabled: true`). Une ombre très légère redevient donc
 * une décision tenable, et non un pari sur la version d'Android.
 *
 * La valeur est une chaîne, pas un objet : c'est la forme que `boxShadow`
 * accepte, et elle se lit comme en CSS.
 */
export interface ThemeElevation {
  /** Ombre des cartes, posée sous le filet de contour. */
  readonly carte: string;
}

export interface ThemeTypography {
  readonly size: {
    readonly xs: number;
    readonly sm: number;
    readonly md: number;
    readonly lg: number;
    readonly xl: number;
    readonly xxl: number;
  };
  readonly weight: {
    readonly regular: '400';
    readonly medium: '500';
    readonly semibold: '600';
    readonly bold: '700';
  };
  readonly lineHeight: {
    readonly tight: number;
    readonly normal: number;
    readonly relaxed: number;
  };
}

export interface Theme {
  readonly mode: ThemeMode;
  readonly colors: ThemeColors;
  readonly spacing: ThemeSpacing;
  readonly radii: ThemeRadii;
  readonly typography: ThemeTypography;
  readonly elevation: ThemeElevation;
}

/**
 * Espacements et rayons : communs aux deux modes.
 *
 * L'échelle est volontairement courte — six valeurs. Une échelle longue invite
 * à choisir au cas par cas, et deux écrans finissent par ne plus se ressembler.
 */
const spacing: ThemeSpacing = Object.freeze({
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
});

const radii: ThemeRadii = Object.freeze({
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
});

const typography: ThemeTypography = Object.freeze({
  size: Object.freeze({
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
  }),
  weight: Object.freeze({
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  }),
  lineHeight: Object.freeze({
    tight: 1.25,
    normal: 1.45,
    relaxed: 1.6,
  }),
});

const lightColors: ThemeColors = Object.freeze({
  primary: '#1D4ED8',
  primarySoft: '#E3EAFD',
  textOnPrimary: '#FFFFFF',

  background: '#F5F7FA',
  surface: '#FFFFFF',
  surfaceSunken: '#EEF1F6',
  border: '#DFE3EA',

  textPrimary: '#14181F',
  textSecondary: '#414A58',
  textMuted: '#5C6675',

  success: '#177245',
  warning: '#9A5B00',
  danger: '#B3261E',
  dangerSoft: '#FCEAE8',

  overlay: 'rgba(12, 16, 22, 0.45)',

  pastels: Object.freeze({
    bleu: Object.freeze({ fond: '#E4EDFD', encre: '#1B4FD8' }),
    violet: Object.freeze({ fond: '#EDE8FD', encre: '#5A3FD0' }),
    menthe: Object.freeze({ fond: '#DEF3E7', encre: '#1C7A4B' }),
    orange: Object.freeze({ fond: '#FDEFDB', encre: '#8F5600' }),
    corail: Object.freeze({ fond: '#FDE6E3', encre: '#AF2318' }),
  }),

  decor: Object.freeze({
    ciel: '#D6E7FA',
    cielBas: '#F2F8FE',
    soleil: '#F6C445',
    feuille: '#9BD8B4',
    feuilleClaire: '#C6EBD6',
  }),
});

const darkColors: ThemeColors = Object.freeze({
  // La teinte d'action est éclaircie en mode sombre : le bleu du mode clair
  // n'offre pas assez de contraste sur fond noir, et devient difficile à lire.
  primary: '#7FA6FF',
  primarySoft: '#1B2740',
  textOnPrimary: '#0B1220',

  background: '#0F1319',
  surface: '#171C24',
  surfaceSunken: '#20262F',
  border: '#2C333E',

  textPrimary: '#F2F4F7',
  textSecondary: '#C7CDD6',
  textMuted: '#9AA3AF',

  success: '#5FD39A',
  warning: '#E0B054',
  danger: '#FF8A80',
  dangerSoft: '#3A1F1D',

  overlay: 'rgba(0, 0, 0, 0.6)',

  // Les pastels du mode sombre ne sont pas les mêmes teintes assombries : un
  // fond clair baissé en luminosité devient terne, et une encre foncée posée
  // dessus devient illisible. Chaque ton est donc redéfini — fond profond,
  // encre claire — et le test de contraste couvre les deux modes.
  pastels: Object.freeze({
    bleu: Object.freeze({ fond: '#1B2740', encre: '#A8C4FF' }),
    violet: Object.freeze({ fond: '#27203E', encre: '#C9B6FF' }),
    menthe: Object.freeze({ fond: '#143020', encre: '#74DCA6' }),
    orange: Object.freeze({ fond: '#33260E', encre: '#EFBE72' }),
    corail: Object.freeze({ fond: '#3A1F1D', encre: '#FFA79E' }),
  }),

  // Le ciel de nuit reste bleu, mais profond : un ciel clair baissé en
  // luminosité devient gris, et la bannière perdrait ce qui la distingue du
  // reste de l'écran. Le soleil et le feuillage sont assombris pour ne pas
  // luire sur un fond sombre.
  decor: Object.freeze({
    ciel: '#16233A',
    cielBas: '#1B2430',
    soleil: '#C99A34',
    feuille: '#2F6048',
    feuilleClaire: '#244835',
  }),
});

const lightElevation: ThemeElevation = Object.freeze({
  // Volontairement à la limite du perceptible. Une ombre plus marquée ferait
  // « flotter » les cartes au-dessus du fond, ce qui convient à une application
  // de commerce et beaucoup moins à une information scolaire : ce qu'on veut
  // ici, c'est détacher la carte, pas la mettre en scène.
  carte: '0 1px 3px rgba(15, 23, 42, 0.07), 0 1px 2px rgba(15, 23, 42, 0.04)',
});

const darkElevation: ThemeElevation = Object.freeze({
  // Sur fond sombre, une ombre claire ne se voit pas et une ombre noire se
  // devine à peine. Elle est conservée, plus dense, pour que la carte garde le
  // même relief d'un mode à l'autre — c'est le filet de contour qui fait
  // l'essentiel du travail dans les deux cas.
  carte: '0 1px 3px rgba(0, 0, 0, 0.5)',
});

export const lightTheme: Theme = Object.freeze({
  mode: 'light',
  colors: lightColors,
  spacing,
  radii,
  typography,
  elevation: lightElevation,
});

export const darkTheme: Theme = Object.freeze({
  mode: 'dark',
  colors: darkColors,
  spacing,
  radii,
  typography,
  elevation: darkElevation,
});

export function themeFor(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
