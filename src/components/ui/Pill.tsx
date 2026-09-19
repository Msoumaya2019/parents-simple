/**
 * Puce d'information.
 *
 * Sert à marquer une actualité épinglée, une catégorie, ou un état. Le texte
 * porte toujours l'information seul : la couleur ne fait que la renforcer.
 * C'est une exigence d'accessibilité — environ un homme sur douze distingue mal
 * le rouge du vert, et une puce qui ne se lirait qu'à la couleur ne lui dirait
 * rien.
 *
 * DEUX FAMILLES DE TONS, UN SEUL VOCABULAIRE POUR L'APPELANT
 * ----------------------------------------------------------
 * Les tons sémantiques — `neutre`, `accent`, `succes`, `alerte`, `danger` —
 * disent un état, et leur couleur est décidée par le thème. Les tons pastel —
 * `bleu`, `violet`, `menthe`, `orange`, `corail` — disent une famille, et
 * servent aux catégories. Les deux se passent par la même propriété : un
 * appelant qui affiche « Cantine » écrit `ton="menthe"` sans avoir à savoir de
 * quelle famille il s'agit.
 *
 * L'icône est facultative et purement décorative : elle est masquée aux
 * lecteurs d'écran, puisque le libellé dit déjà tout.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui/AppText';
import { useTheme } from '@/providers/theme-provider';
import type { Theme, TonPastel } from '@/theme';

export type PillTon = 'neutre' | 'accent' | 'succes' | 'alerte' | 'danger' | TonPastel;

interface PillProps {
  readonly libelle: string;
  readonly ton?: PillTon;
  readonly icone?: keyof typeof Ionicons.glyphMap;
}

/** Vrai si ce ton appartient à la palette pastel. */
function estPastel(ton: PillTon): ton is TonPastel {
  return (
    ton === 'bleu' || ton === 'violet' || ton === 'menthe' || ton === 'orange' || ton === 'corail'
  );
}

function couleurs(theme: Theme, ton: PillTon): { readonly fond: string; readonly encre: string } {
  if (estPastel(ton)) {
    return theme.colors.pastels[ton];
  }

  const semantiques = {
    neutre: { fond: theme.colors.surfaceSunken, encre: theme.colors.textSecondary },
    accent: { fond: theme.colors.primarySoft, encre: theme.colors.primary },
    succes: { fond: theme.colors.surfaceSunken, encre: theme.colors.success },
    alerte: { fond: theme.colors.surfaceSunken, encre: theme.colors.warning },
    danger: { fond: theme.colors.dangerSoft, encre: theme.colors.danger },
  } as const;

  return semantiques[ton];
}

export function Pill({ libelle, ton = 'neutre', icone }: PillProps): React.JSX.Element {
  const { theme } = useTheme();
  const choix = couleurs(theme, ton);

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: choix.fond,
          borderRadius: theme.radii.pill,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: 4,
          gap: theme.spacing.xs,
        },
      ]}
    >
      {icone === undefined ? null : (
        <Ionicons
          name={icone}
          size={13}
          color={choix.encre}
          // Le glyphe est un caractère : sans ce masquage, un lecteur d'écran
          // l'annonce comme un élément de plus, à côté du libellé qui dit déjà
          // tout. `aria-hidden` est traduit par React Native en
          // `accessibilityElementsHidden`, et en `importantForAccessibility`
          // valant `no-hide-descendants` — vérifié dans
          // `Libraries/Text/Text.js` de la version installée. C'est bien ce
          // fichier-là qu'il faut lire : `Ionicons` rend un `Text`, et non une
          // `View` — voir `create-icon-set.js`, qui écrit `<Text {...props}>`.
          aria-hidden
        />
      )}
      <AppText variant="caption" style={{ color: choix.encre }}>
        {libelle}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
  },
});
