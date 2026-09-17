/**
 * Bouton.
 *
 * Trois variantes, et pas une de plus : une action principale, une action
 * secondaire, une action discrète. Au-delà, le choix devient une décision de
 * design à prendre sur chaque écran, et l'application finit par ne plus avoir
 * de hiérarchie lisible.
 *
 * La hauteur minimale est de 48 points : c'est la taille en dessous de laquelle
 * une cible tactile devient difficile à viser, en particulier pour quelqu'un
 * qui tient son téléphone d'une main dans la cour de l'école.
 */

import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';

export type ButtonVariant = 'principal' | 'secondaire' | 'discret';

interface ButtonProps {
  readonly libelle: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly desactive?: boolean;
  readonly enCours?: boolean;
  readonly style?: ViewStyle;
  readonly accessibilityHint?: string;
}

export function Button({
  libelle,
  onPress,
  variant = 'principal',
  desactive = false,
  enCours = false,
  style,
  accessibilityHint,
}: ButtonProps): React.JSX.Element {
  const { theme } = useTheme();

  const inactif = desactive || enCours;

  const apparence = {
    principal: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
      borderWidth: 0,
      texte: theme.colors.textOnPrimary,
    },
    secondaire: {
      backgroundColor: 'transparent',
      borderColor: theme.colors.primary,
      borderWidth: 1,
      texte: theme.colors.primary,
    },
    discret: {
      backgroundColor: theme.colors.surfaceSunken,
      borderColor: 'transparent',
      borderWidth: 0,
      texte: theme.colors.textSecondary,
    },
  } as const;

  const choix = apparence[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactif}
      accessibilityRole="button"
      accessibilityLabel={libelle}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactif, busy: enCours }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: choix.backgroundColor,
          borderColor: choix.borderColor,
          borderWidth: choix.borderWidth,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.lg,
          opacity: inactif ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {enCours ? (
        <ActivityIndicator color={choix.texte} />
      ) : (
        <AppText variant="label" style={{ color: choix.texte }}>
          {libelle}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
