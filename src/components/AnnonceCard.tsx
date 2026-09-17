/**
 * Une actualité dans le fil.
 *
 * L'extrait est coupé à la fin d'un mot, et non à un nombre de caractères
 * fixe : une coupure au milieu d'un mot se lit comme une faute de frappe, et
 * c'est la première chose qu'un parent voit.
 *
 * Le texte est réduit à trois lignes par le moteur de rendu, ce qui garantit
 * que toutes les cartes du fil ont la même hauteur, quelle que soit la
 * longueur de l'actualité. Un fil dont les cartes varient du simple au triple
 * est difficile à parcourir.
 */

import { StyleSheet, View } from 'react-native';

import { AppText, Card, Pill } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce } from '@/types/models';
import { depuis } from '@/utils/date';

interface AnnonceCardProps {
  readonly annonce: Annonce;
  readonly onPress: () => void;
}

/** Extrait limité à `max` caractères, coupé sur une frontière de mot. */
export function extraire(corps: string, max = 180): string {
  const propre = corps.replace(/\s+/g, ' ').trim();
  if (propre.length <= max) {
    return propre;
  }

  const coupe = propre.slice(0, max);
  const dernierEspace = coupe.lastIndexOf(' ');
  const base = dernierEspace > max * 0.6 ? coupe.slice(0, dernierEspace) : coupe;
  return `${base.trimEnd()}…`;
}

export function AnnonceCard({ annonce, onPress }: AnnonceCardProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Actualité : ${annonce.titre}`}
      accessibilityHint="Ouvre le texte complet"
    >
      <View style={styles.entete}>
        <AppText variant="caption" color="muted">
          {depuis(annonce.publieeLe)}
        </AppText>
        {annonce.epinglee ? <Pill libelle="Important" ton="accent" /> : null}
      </View>

      <AppText variant="subtitle" style={styles.titre}>
        {annonce.titre}
      </AppText>

      <AppText variant="body" color="secondary" numberOfLines={3} style={styles.extrait}>
        {extraire(annonce.corps)}
      </AppText>

      <AppText variant="label" color="accent" style={{ marginTop: theme.spacing.sm }}>
        Lire la suite
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titre: {
    marginTop: 6,
  },
  extrait: {
    marginTop: 6,
  },
});
