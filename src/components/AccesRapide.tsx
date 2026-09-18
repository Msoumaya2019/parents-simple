/**
 * Un raccourci de l'accueil.
 *
 * Quatre de ces cartes forment une grille de deux colonnes. Chacune mène à un
 * onglet existant : ce composant ne crée aucune navigation, il en offre une
 * entrée de plus vers celle qui existe déjà.
 *
 * POURQUOI LA CIBLE TACTILE EST LA CARTE ENTIÈRE
 * ----------------------------------------------
 * Le chevron suggère qu'on peut appuyer, mais c'est la carte entière qui
 * répond. Une carte dont seul le chevron serait actif obligerait à viser une
 * zone de quelques millimètres, ce qui est déjà difficile pour un adulte
 * distrait et impossible pour quelqu'un qui tient son téléphone d'une main.
 *
 * Le libellé accessible réunit le titre et le sous-titre : « Cantine, Menus et
 * infos ». Un lecteur d'écran qui n'annoncerait que « Cantine » laisserait
 * ignorer ce que la carte contient.
 */

import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import type { TonPastel } from '@/theme';

interface AccesRapideProps {
  readonly titre: string;
  readonly sousTitre: string;
  readonly icone: keyof typeof Ionicons.glyphMap;
  readonly ton: TonPastel;
  readonly onPress: () => void;
}

export function AccesRapide({
  titre,
  sousTitre,
  icone,
  ton,
  onPress,
}: AccesRapideProps): React.JSX.Element {
  const { theme } = useTheme();
  const pastel = theme.colors.pastels[ton];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${titre}, ${sousTitre}`}
      accessibilityHint="Ouvre cette rubrique"
      style={({ pressed }) => [
        styles.carte,
        {
          backgroundColor: pastel.fond,
          borderRadius: theme.radii.xl,
          padding: theme.spacing.md,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.rond,
          {
            // Le rond est plus clair que la carte qui le porte, et l'icône
            // reprend l'encre du ton : la hiérarchie se lit sans qu'aucun
            // contour soit nécessaire.
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radii.pill,
          },
        ]}
      >
        <Ionicons name={icone} size={20} color={pastel.encre} aria-hidden />
      </View>

      <View style={styles.textes}>
        <AppText variant="label" style={styles.titre}>
          {titre}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={2}>
          {sousTitre}
        </AppText>
      </View>

      <Ionicons name="chevron-forward" size={16} color={pastel.encre} aria-hidden />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    // Hauteur minimale : les quatre cartes doivent s'aligner, même si un
    // sous-titre tient sur deux lignes et un autre sur une seule.
    minHeight: 76,
  },
  rond: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textes: {
    flex: 1,
  },
  titre: {
    marginBottom: 1,
  },
});
