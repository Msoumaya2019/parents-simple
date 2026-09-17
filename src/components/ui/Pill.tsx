/**
 * Puce d'information.
 *
 * Sert à marquer une actualité épinglée, une catégorie, ou un état. Le texte
 * porte toujours l'information seul : la couleur ne fait que la renforcer.
 * C'est une exigence d'accessibilité — environ un homme sur douze distingue mal
 * le rouge du vert, et une puce qui ne se lit qu'à la couleur ne lui dit rien.
 */

import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';

export type PillTon = 'neutre' | 'accent' | 'succes' | 'alerte' | 'danger';

interface PillProps {
  readonly libelle: string;
  readonly ton?: PillTon;
}

export function Pill({ libelle, ton = 'neutre' }: PillProps): React.JSX.Element {
  const { theme } = useTheme();

  const tons = {
    neutre: { fond: theme.colors.surfaceSunken, texte: theme.colors.textSecondary },
    accent: { fond: theme.colors.primarySoft, texte: theme.colors.primary },
    succes: { fond: theme.colors.surfaceSunken, texte: theme.colors.success },
    alerte: { fond: theme.colors.surfaceSunken, texte: theme.colors.warning },
    danger: { fond: theme.colors.dangerSoft, texte: theme.colors.danger },
  } as const;

  const choix = tons[ton];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: choix.fond,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 3,
        },
      ]}
    >
      <AppText variant="caption" style={{ color: choix.texte }}>
        {libelle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
  },
});
