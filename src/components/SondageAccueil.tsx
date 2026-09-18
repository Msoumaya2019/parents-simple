/**
 * L'invitation à répondre au sondage, sur l'accueil.
 *
 * ELLE N'APPARAÎT QUE S'IL Y A UN SONDAGE OUVERT
 * ----------------------------------------------
 * C'est la règle demandée, et c'est aussi la seule tenable : une carte
 * « Donnez votre avis » qui ne mène à aucun sondage apprend au parent que ce
 * bouton-là ne sert à rien. Il cesse alors de le voir, y compris le jour où un
 * sondage existe. L'écran décide de l'afficher ; ce composant suppose qu'on ne
 * l'appelle que lorsqu'il y a quelque chose à montrer.
 *
 * POURQUOI ELLE MÈNE AILLEURS AU LIEU DE VOTER ICI
 * -----------------------------------------------
 * Le vote vit dans l'onglet Plus, avec ses choix, ses résultats et ses règles —
 * les scores n'apparaissent qu'après avoir voté, pour ne pas orienter la
 * réponse. Redessiner tout cela sur l'accueil donnerait deux écrans de vote à
 * maintenir, et deux occasions de les faire diverger.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, Card } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import type { Sondage } from '@/types/models';

/**
 * L'accroche de la carte.
 *
 * Écrite ici, comme la formule de la bannière : elle ne change pas, et lui
 * donner une table serait plus de travail que de la modifier.
 */
const ACCROCHE = 'Votre avis nous intéresse';

interface SondageAccueilProps {
  readonly sondage: Sondage;
  readonly onParticiper: () => void;
}

export function SondageAccueil({ sondage, onParticiper }: SondageAccueilProps): React.JSX.Element {
  const { theme } = useTheme();
  const violet = theme.colors.pastels.violet;

  return (
    <Card
      onPress={onParticiper}
      accessibilityLabel={`Sondage : ${sondage.question}`}
      accessibilityHint="Ouvre le sondage pour répondre"
      style={{ backgroundColor: violet.fond, borderColor: violet.fond }}
    >
      <View style={[styles.rangee, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.icone,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg },
          ]}
        >
          <Ionicons name="stats-chart" size={22} color={violet.encre} aria-hidden />
        </View>

        <View style={styles.colonne}>
          {/* En capitales à l'écran seulement. La carte est un bouton et porte
              son propre libellé accessible : ses enfants ne sont pas annoncés
              séparément, donc cette chaîne n'est jamais lue telle quelle — ce
              qui évite qu'un lecteur d'écran l'épelle lettre par lettre. */}
          <AppText variant="caption" style={{ color: violet.encre }}>
            {ACCROCHE.toLocaleUpperCase('fr-FR')}
          </AppText>

          <AppText variant="subtitle" style={styles.question} numberOfLines={3}>
            {sondage.question}
          </AppText>

          {sondage.precisions === null || sondage.precisions.trim() === '' ? null : (
            <AppText variant="caption" color="muted" numberOfLines={2} style={styles.precis}>
              {sondage.precisions}
            </AppText>
          )}
        </View>

        {/* Un bouton qui n'en est pas un : c'est la carte entière qui répond.
            Un second bouton imbriqué serait de toute façon inatteignable — un
            lecteur d'écran ne descend pas dans les enfants d'un élément
            accessible — et annoncerait deux cibles pour une seule action. */}
        <View
          style={[styles.bouton, { backgroundColor: violet.encre, borderRadius: theme.radii.pill }]}
        >
          <AppText variant="label" color="onAccent">
            Participer
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icone: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colonne: {
    flex: 1,
  },
  question: {
    marginTop: 2,
  },
  precis: {
    marginTop: 2,
  },
  bouton: {
    paddingHorizontal: 16,
    // 44 points de haut : la plus petite cible tactile qu'on puisse viser du
    // premier coup, seuil que les guides d'Apple fixent à 44.
    minHeight: 44,
    justifyContent: 'center',
  },
});
