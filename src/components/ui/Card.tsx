/**
 * Carte.
 *
 * L'unité visuelle de l'application : une actualité, un menu, un événement, un
 * document. Le contour est un filet et non une ombre portée — sur Android, une
 * ombre est rendue différemment selon la version du système, et deux appareils
 * côte à côte ne montrent alors pas la même application.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/providers/theme-provider';

interface CardProps {
  readonly children: ReactNode;
  readonly onPress?: () => void;
  readonly style?: ViewStyle;
  /** Rendu atténué, pour une information passée ou déjà traitée. */
  readonly attenuee?: boolean;
  readonly accessibilityLabel?: string;
  readonly accessibilityHint?: string;
}

export function Card({
  children,
  onPress,
  style,
  attenuee = false,
  accessibilityLabel,
  accessibilityHint,
}: CardProps): React.JSX.Element {
  const { theme } = useTheme();

  const fond = {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.lg,
    padding: theme.spacing.lg,
    opacity: attenuee ? 0.6 : 1,
  };

  if (onPress === undefined) {
    return <View style={[styles.base, fond, style]}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      // La carte se ternit à l'appui : sans ce retour visuel, un parent qui
      // appuie sur une actualité n'a aucun moyen de savoir si l'application a
      // enregistré son geste, et appuie une seconde fois.
      style={({ pressed }) => [styles.base, fond, pressed && styles.pressee, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressee: {
    opacity: 0.75,
  },
});
