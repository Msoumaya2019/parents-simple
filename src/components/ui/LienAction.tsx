/**
 * Lien d'action, en bas d'une carte.
 *
 * « Lire la suite → ». Il ne navigue pas lui-même : c'est la carte entière qui
 * est pressable, et ce lien en est l'indication visuelle. Poser un second
 * gestionnaire de clic à l'intérieur d'une carte déjà cliquable donnerait deux
 * zones réactives imbriquées, dont la plus petite serait difficile à viser.
 *
 * C'est pourquoi il n'a pas de rôle accessible : un lecteur d'écran annonce la
 * carte comme un bouton, avec son titre, et lirait « Lire la suite » une seconde
 * fois sans rien apprendre de plus.
 *
 * La flèche qui suit le libellé est masquée aux lecteurs d'écran, pour la même
 * raison : elle ne dit rien que le libellé ne dise déjà.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';

interface LienActionProps {
  readonly libelle: string;
  readonly couleur: string;
}

export function LienAction({ libelle, couleur }: LienActionProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={[styles.base, { gap: theme.spacing.xs }]} pointerEvents="none">
      <AppText variant="label" style={{ color: couleur }}>
        {libelle}
      </AppText>
      <Ionicons name="arrow-forward" size={15} color={couleur} aria-hidden />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
});
