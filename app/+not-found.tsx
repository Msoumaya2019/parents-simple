/**
 * Écran affiché pour une adresse inconnue.
 *
 * Ce cas se produit quand un lien profond pointe vers une page qui n'existe
 * plus — une actualité partagée puis retirée, par exemple. Sans cet écran,
 * expo-router affiche un message technique en anglais.
 */

import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Screen } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

export default function NotFoundScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  return (
    <Screen centre>
      <View style={styles.bloc}>
        <AppText variant="title" style={styles.centre}>
          Page introuvable
        </AppText>
        <AppText variant="body" color="muted" style={[styles.centre, styles.espace]}>
          Cette page n’existe pas ou a été retirée. Revenez à l’accueil pour retrouver les
          informations de l’école.
        </AppText>

        <Button
          libelle="Revenir à l’accueil"
          onPress={() => router.replace('/')}
          style={{ marginTop: theme.spacing.xl }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloc: {
    alignItems: 'center',
    maxWidth: 340,
  },
  centre: {
    textAlign: 'center',
  },
  espace: {
    marginTop: 8,
  },
});
