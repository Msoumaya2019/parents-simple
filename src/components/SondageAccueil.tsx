/**
 * L'invitation à répondre au sondage, sur l'accueil.
 *
 * CE COMPOSANT NE CHOISIT NI LE SONDAGE NI LES MOTS
 * -------------------------------------------------
 * Il reçoit une `InvitationSondage` déjà décidée, et se contente de la
 * dessiner. La règle vit dans `@/lib/sondage-accueil`, hors de tout composant,
 * parce qu'elle a une raison d'être éprouvée : elle dépend de ce que
 * l'appareil sait de ses propres votes.
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
 * maintenir, et deux occasions de les faire diverger. C'est d'ailleurs ainsi
 * que la carte a menti : elle ignorait les votes de l'appareil, que seul
 * l'onglet Plus lisait, et invitait encore à répondre après coup.
 */

import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { AppText, Card } from '@/components/ui';
import type { InvitationSondage } from '@/lib/sondage-accueil';
import { useTheme } from '@/providers/theme-provider';

interface SondageAccueilProps {
  readonly invitation: InvitationSondage;
  readonly onOuvrir: () => void;
}

export function SondageAccueil({ invitation, onOuvrir }: SondageAccueilProps): React.JSX.Element {
  const { theme } = useTheme();
  const violet = theme.colors.pastels.violet;
  const { sondage, accroche, action, indication } = invitation;

  return (
    <Card
      onPress={onOuvrir}
      accessibilityLabel={`Sondage : ${sondage.question}`}
      accessibilityHint={indication}
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
            {accroche.toLocaleUpperCase('fr-FR')}
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
            {action}
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
