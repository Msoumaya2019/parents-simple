/**
 * Texte de l'application.
 *
 * Aucun écran n'utilise `<Text>` directement. Deux raisons :
 *
 *   - la couleur doit venir du thème, jamais d'une valeur écrite sur place.
 *     Un texte en `#333` est illisible en mode sombre, et le défaut ne se voit
 *     que sur le téléphone d'un parent qui a activé ce mode ;
 *   - `allowFontScaling` est laissé actif, et la hauteur de ligne suit la
 *     taille du texte. Un parent qui a agrandi la police de son téléphone —
 *     parce qu'il voit mal — doit pouvoir lire l'application. Une hauteur de
 *     ligne fixe ferait se chevaucher les lignes dès la première augmentation.
 */

import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { useTheme } from '@/providers/theme-provider';
import type { Theme } from '@/theme';

export type TextVariant = 'display' | 'title' | 'subtitle' | 'body' | 'label' | 'caption';

export type TextColor =
  'primary' | 'secondary' | 'muted' | 'accent' | 'onAccent' | 'success' | 'danger';

interface AppTextProps extends TextProps {
  readonly variant?: TextVariant;
  readonly color?: TextColor;
  readonly children?: ReactNode;
}

function couleur(theme: Theme, role: TextColor): string {
  switch (role) {
    case 'primary':
      return theme.colors.textPrimary;
    case 'secondary':
      return theme.colors.textSecondary;
    case 'muted':
      return theme.colors.textMuted;
    case 'accent':
      return theme.colors.primary;
    case 'onAccent':
      return theme.colors.textOnPrimary;
    case 'success':
      return theme.colors.success;
    case 'danger':
      return theme.colors.danger;
  }
}

export function AppText({
  variant = 'body',
  color = 'primary',
  style,
  children,
  ...rest
}: AppTextProps): React.JSX.Element {
  const { theme } = useTheme();

  const base = {
    color: couleur(theme, color),
    fontSize: theme.typography.size.md,
    lineHeight: Math.round(theme.typography.size.md * theme.typography.lineHeight.normal),
  };

  const parVariante = {
    display: {
      fontSize: theme.typography.size.xxl,
      fontWeight: theme.typography.weight.bold,
      lineHeight: Math.round(theme.typography.size.xxl * theme.typography.lineHeight.tight),
      letterSpacing: -0.4,
    },
    title: {
      fontSize: theme.typography.size.xl,
      fontWeight: theme.typography.weight.semibold,
      lineHeight: Math.round(theme.typography.size.xl * theme.typography.lineHeight.tight),
      letterSpacing: -0.2,
    },
    subtitle: {
      fontSize: theme.typography.size.lg,
      fontWeight: theme.typography.weight.semibold,
      lineHeight: Math.round(theme.typography.size.lg * theme.typography.lineHeight.normal),
    },
    body: {
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.regular,
      lineHeight: Math.round(theme.typography.size.md * theme.typography.lineHeight.relaxed),
    },
    label: {
      fontSize: theme.typography.size.sm,
      fontWeight: theme.typography.weight.semibold,
      lineHeight: Math.round(theme.typography.size.sm * theme.typography.lineHeight.normal),
    },
    caption: {
      fontSize: theme.typography.size.xs,
      fontWeight: theme.typography.weight.medium,
      lineHeight: Math.round(theme.typography.size.xs * theme.typography.lineHeight.normal),
    },
  } as const;

  return (
    <Text {...rest} style={[base, parVariante[variant], style]}>
      {children}
    </Text>
  );
}
