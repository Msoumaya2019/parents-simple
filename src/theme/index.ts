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
});

export const lightTheme: Theme = Object.freeze({
  mode: 'light',
  colors: lightColors,
  spacing,
  radii,
  typography,
});

export const darkTheme: Theme = Object.freeze({
  mode: 'dark',
  colors: darkColors,
  spacing,
  radii,
  typography,
});

export function themeFor(mode: ThemeMode): Theme {
  return mode === 'dark' ? darkTheme : lightTheme;
}
