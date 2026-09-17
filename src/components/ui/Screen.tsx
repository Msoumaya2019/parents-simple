/**
 * Enveloppe d'écran.
 *
 * Gère le fond, les bords sûrs et l'espacement horizontal, une fois pour tous
 * les écrans. Le paramètre `edges` mérite une explication, parce qu'il ne se
 * devine pas :
 *
 *   - un onglet n'a pas d'en-tête : c'est à l'écran de tenir compte de
 *     l'encoche, d'où `top` ;
 *   - un écran empilé par-dessus les onglets a un en-tête qui s'en charge, donc
 *     `top` doit être retiré — sinon l'en-tête et l'écran se cumulent, et le
 *     titre descend d'un centimètre pour rien ;
 *   - une modale n'a pas de barre d'onglets sous elle : sans `bottom`, son
 *     dernier bouton tombe sous la barre gestuelle de l'iPhone.
 */

import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/providers/theme-provider';

interface ScreenProps {
  readonly children: ReactNode;
  readonly edges?: readonly Edge[];
  /** Rend le contenu défilable. À désactiver pour une liste virtualisée. */
  readonly scrollable?: boolean;
  readonly centre?: boolean;
  readonly sansPadding?: boolean;
}

export function Screen({
  children,
  edges = ['top'],
  scrollable = false,
  centre = false,
  sansPadding = false,
}: ScreenProps): React.JSX.Element {
  const { theme } = useTheme();

  const fond = { backgroundColor: theme.colors.background };
  const contenu = [sansPadding ? null : styles.padding, centre ? styles.centre : null];

  return (
    <SafeAreaView style={[styles.flex, fond]} edges={[...edges]}>
      {scrollable ? (
        <ScrollView
          contentContainerStyle={[contenu, styles.scrollContent]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contenu]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  padding: {
    paddingHorizontal: 16,
  },
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 32,
  },
});
