/**
 * Racine de l'application.
 *
 * Trois responsabilités, et rien d'autre : fournir le thème, fournir les
 * marges de sécurité, et décrire la pile de navigation.
 *
 * POURQUOI LA PILE EST DÉCLARÉE ICI PLUTÔT QUE DÉDUITE
 * ---------------------------------------------------
 * expo-router découvre les écrans à partir des fichiers, et il les rend même
 * sans qu'on les déclare : `useSortedScreens` ne filtre sur les écrans
 * déclarés que si on le lui demande. Ce qui manque alors n'est pas l'en-tête :
 * le navigateur en affiche un tant que `headerShown` n'est pas mis à `false` —
 * `native-stack/types.d.ts` dit « The header is shown by default » — et
 * `screenOptions` ci-dessous lui donne déjà les couleurs du thème.
 *
 * Ce qui manque, c'est le TITRE. Sans déclaration, c'est le nom de la route qui
 * se lit dans l'en-tête : « annonce/[id] », « documents », « +not-found ». Un
 * parent y trouve un chemin de fichier, pas un titre.
 *
 * L'inverse compte autant : un écran conçu SANS en-tête doit le dire, sinon il
 * en reçoit un — et son `Screen` garde alors `top` dans ses marges sûres, si
 * bien que l'en-tête et l'écran se cumulent, ce que l'en-tête de `Screen`
 * décrit. C'est le cas de `+not-found`, qui centre son contenu.
 *
 * L'écart ne produit aucune erreur à la compilation : ni `tsc` ni ESLint ne
 * voient un titre manquant. C'est pourquoi `tests/routes-declarees.test.ts`
 * compare les deux sources.
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

        {/* Un écran de fin de parcours, qui porte son propre titre en corps de
            page : lui laisser un en-tête y afficherait « +not-found », et son
            `Screen` cumulerait la marge haute de l'écran avec celle de
            l'en-tête. */}
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
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
