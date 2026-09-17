/**
 * Racine de l'application.
 *
 * Trois responsabilités, et rien d'autre : fournir le thème, fournir les
 * marges de sécurité, et décrire la pile de navigation.
 *
 * POURQUOI LA PILE EST DÉCLARÉE ICI PLUTÔT QUE DÉDUITE
 * ---------------------------------------------------
 * expo-router découvre les écrans à partir des fichiers, mais il ne devine pas
 * leur en-tête. Un écran absent de cette liste s'affiche SANS en-tête, donc
 * sans flèche de retour : un parent qui ouvre une actualité ne peut plus
 * revenir en arrière autrement qu'en fermant l'application. C'est le piège le
 * plus courant de ce routeur, et il ne produit aucune erreur à la compilation.
 *
 * Chaque écran empilé reçoit donc son entrée, avec un titre en français et les
 * couleurs du thème — sans quoi l'en-tête reste blanc en mode sombre, avec un
 * titre noir illisible.
 */

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider, useTheme } from '@/providers/theme-provider';

function Pile(): React.JSX.Element {
  const { theme, mode } = useTheme();

  const entete = {
    headerStyle: { backgroundColor: theme.colors.surface },
    headerTintColor: theme.colors.primary,
    headerTitleStyle: {
      color: theme.colors.textPrimary,
      fontSize: theme.typography.size.md,
      fontWeight: theme.typography.weight.semibold,
    },
    headerShadowVisible: false,
    contentStyle: { backgroundColor: theme.colors.background },
  } as const;

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={entete}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen name="annonce/[id]" options={{ headerShown: true, title: 'Actualité' }} />

        <Stack.Screen name="documents" options={{ headerShown: true, title: 'Documents' }} />

        <Stack.Screen name="reglages" options={{ headerShown: true, title: 'Réglages' }} />

        <Stack.Screen
          name="confidentialite"
          options={{ headerShown: true, title: 'Confidentialité' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Pile />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
