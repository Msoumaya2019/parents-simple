/**
 * Carte.
 *
 * L'unité visuelle de l'application : une actualité, un menu, un événement, un
 * document.
 *
 * POURQUOI LE FILET *ET* L'OMBRE
 * ------------------------------
 * Le contour seul ne suffisait plus : sur un fond gris très clair, une carte
 * blanche bordée d'un filet pâle se lit comme un cadre, pas comme un objet
 * posé sur la page. L'ombre très légère ajoutée ici détache la carte sans la
 * mettre en scène.
 *
 * Le filet reste, et ce n'est pas un doublon : c'est lui qui porte le contour
 * quand l'ombre ne se voit pas — en mode sombre, ou sur un écran de mauvaise
 * qualité. Voir `ThemeElevation` pour la raison technique qui rend l'ombre
 * acceptable aujourd'hui alors qu'elle était évitée auparavant.
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
    borderRadius: theme.radii.xl,
    padding: theme.spacing.lg,
    boxShadow: theme.elevation.carte,
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
