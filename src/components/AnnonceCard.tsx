/**
 * Une actualité dans le fil, sous sa forme compacte.
 *
 * C'est le composant réutilisable demandé : il sait afficher une image
 * facultative, une catégorie et sa couleur, un titre, un résumé, une date, un
 * indicateur d'importance et une invitation à lire la suite. La forme longue,
 * pour l'actualité mise en avant, est `AnnonceEnAvant` — les deux partagent les
 * mêmes données et la même pastille, mais pas la même mise en page : une carte
 * de tête se lit, une carte de liste se parcourt.
 *
 * L'extrait est coupé à la fin d'un mot, et non à un nombre de caractères
 * fixe : une coupure au milieu d'un mot se lit comme une faute de frappe, et
 * c'est la première chose qu'un parent voit.
 *
 * L'IMAGE EST FACULTATIVE, ET SON ABSENCE N'EST PAS UN TROU
 * ---------------------------------------------------------
 * La plupart des actualités n'ont pas d'image. Sans image, la vignette
 * disparaît et le texte occupe toute la largeur — il ne reste pas un cadre vide
 * à sa place. C'est ce qui distingue une information sans illustration d'une
 * illustration qui n'a pas chargé.
 */

import { StyleSheet, View } from 'react-native';

import { AppText, Card, ImageDistante, LienAction, Pill } from '@/components/ui';
import { CATEGORIES_ANNONCE, adresseImage } from '@/services/annonces';
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

  const categorie = CATEGORIES_ANNONCE[annonce.categorie];
  const image = annonce.imageUrl;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`Actualité : ${annonce.titre}`}
      accessibilityHint="Ouvre le texte complet"
    >
      <View style={[styles.rangee, { gap: theme.spacing.md }]}>
        {image === null ? null : (
          <ImageDistante
            source={adresseImage(image)}
            iconeRepli={categorie.icone}
            style={[styles.vignette, { borderRadius: theme.radii.lg }]}
          />
        )}

        <View style={styles.colonne}>
          <View style={[styles.entete, { gap: theme.spacing.sm }]}>
            <Pill libelle={categorie.libelle} ton={categorie.ton} icone={categorie.icone} />
            {annonce.epinglee ? <Pill libelle="Important" ton="corail" icone="megaphone" /> : null}
          </View>

          <AppText variant="subtitle" style={styles.titre} numberOfLines={3}>
            {annonce.titre}
          </AppText>

          <AppText variant="body" color="secondary" numberOfLines={2} style={styles.extrait}>
            {extraire(annonce.corps)}
          </AppText>

          <View style={styles.pied}>
            <LienAction libelle="Lire la suite" couleur={theme.colors.primary} />
            <AppText variant="caption" color="muted">
              {depuis(annonce.publieeLe)}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  vignette: {
    width: 76,
    height: 76,
  },
  colonne: {
    flex: 1,
  },
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  titre: {
    marginTop: 8,
  },
  extrait: {
    marginTop: 4,
  },
  pied: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
