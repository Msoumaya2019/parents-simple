/**
 * États vides, chargement, erreur.
 *
 * Trois états qu'un écran affiche malgré lui, et qu'il est tentant de traiter
 * à la va-vite. Ils ont pourtant un point commun : ce sont les seuls moments où
 * un parent ne voit rien de ce qu'il est venu chercher. Un écran blanc, ou un
 * « Erreur » sans phrase, fait conclure que l'application ne marche pas.
 *
 * Chaque message dit donc deux choses : ce qui se passe, et quoi faire.
 */

import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';

interface LoadingViewProps {
  readonly message?: string;
}

export function LoadingView({ message = 'Chargement…' }: LoadingViewProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={styles.bloc} accessibilityRole="progressbar" accessibilityLabel={message}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <AppText variant="caption" color="muted" style={styles.espace}>
        {message}
      </AppText>
    </View>
  );
}

interface EmptyStateProps {
  readonly titre: string;
  readonly message: string;
}

export function EmptyState({ titre, message }: EmptyStateProps): React.JSX.Element {
  return (
    <View style={styles.bloc}>
      <AppText variant="subtitle" color="secondary" style={styles.centreTexte}>
        {titre}
      </AppText>
      <AppText variant="caption" color="muted" style={[styles.espace, styles.centreTexte]}>
        {message}
      </AppText>
    </View>
  );
}

interface ErrorNoticeProps {
  readonly message: string;
  /** Détail technique, affiché en développement uniquement. */
  readonly technique?: string | null;
  readonly onReessayer?: () => void;
}

export function ErrorNotice({
  message,
  technique,
  onReessayer,
}: ErrorNoticeProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.erreur,
        {
          backgroundColor: theme.colors.dangerSoft,
          borderColor: theme.colors.danger,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
        },
      ]}
      accessibilityRole="alert"
    >
      <AppText variant="label" color="danger">
        {message}
      </AppText>

      {technique !== null && technique !== undefined ? (
        <AppText variant="caption" color="muted" style={styles.espace}>
          {technique}
        </AppText>
      ) : null}

      {onReessayer !== undefined ? (
        <AppText
          variant="label"
          color="accent"
          style={styles.espace}
          onPress={onReessayer}
          accessibilityRole="button"
        >
          Réessayer
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  centreTexte: {
    textAlign: 'center',
  },
  espace: {
    marginTop: 8,
  },
  erreur: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
