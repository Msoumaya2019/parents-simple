/**
 * L'actualité mise en avant, en tête du fil.
 *
 * C'est la carte que le parent lit en premier. Elle a donc droit à plus de
 * place : titre plus grand, résumé plus long, image plus large.
 *
 * DEUX DISPOSITIONS, ET POURQUOI
 * ------------------------------
 * Sur un grand iPhone, l'image se place à droite du texte, comme sur la
 * maquette. Sur un petit — un iPhone SE, par exemple — la même disposition
 * laisserait au texte une colonne d'une centaine de points, où un titre de
 * quatre mots tiendrait sur cinq lignes. L'image passe alors sous le texte et
 * occupe toute la largeur.
 *
 * Le seuil est mesuré sur la largeur réelle de la fenêtre, jamais sur le modèle
 * de l'appareil : une taille de police agrandie change la place disponible
 * autant qu'un écran plus étroit.
 */

import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText, Card, ImageDistante, LienAction, Pill } from '@/components/ui';
import { CATEGORIES_ANNONCE, adresseImage } from '@/services/annonces';
import { extraire } from '@/components/AnnonceCard';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce } from '@/types/models';
import { depuis } from '@/utils/date';

/** En dessous de cette largeur, l'image passe sous le texte. */
const SEUIL_ETROIT = 380;

interface AnnonceEnAvantProps {
  readonly annonce: Annonce;
  readonly onPress: () => void;
}

export function AnnonceEnAvant({ annonce, onPress }: AnnonceEnAvantProps): React.JSX.Element {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();

  const categorie = CATEGORIES_ANNONCE[annonce.categorie];
  const image = annonce.imageUrl;
  const etroit = width < SEUIL_ETROIT;

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`À la une : ${annonce.titre}`}
      accessibilityHint="Ouvre le texte complet"
    >
      <View style={[styles.entete, { gap: theme.spacing.sm }]}>
        {/* Une actualité épinglée porte l'indicateur d'importance ; les autres
            portent leur catégorie. Les afficher toutes les deux sur la même
            ligne donnerait deux pastilles pour une seule information. */}
        {annonce.epinglee ? (
          <Pill libelle="Important" ton="corail" icone="megaphone" />
        ) : (
          <Pill libelle={categorie.libelle} ton={categorie.ton} icone={categorie.icone} />
        )}
        <AppText variant="caption" color="muted">
          {depuis(annonce.publieeLe)}
        </AppText>
      </View>

      <AppText variant="title" style={styles.titre}>
        {annonce.titre}
      </AppText>

      {image === null ? (
        <AppText variant="body" color="secondary" numberOfLines={5} style={styles.resume}>
          {extraire(annonce.corps, 240)}
        </AppText>
      ) : (
        <View
          style={[
            etroit ? styles.empile : styles.cote,
            { gap: theme.spacing.md, marginTop: theme.spacing.md },
          ]}
        >
          <AppText
            variant="body"
            color="secondary"
            numberOfLines={etroit ? 4 : 7}
            style={styles.texteResume}
          >
            {extraire(annonce.corps, 240)}
          </AppText>

          <ImageDistante
            source={adresseImage(image)}
            iconeRepli={categorie.icone}
            style={
              etroit
                ? [styles.imageLarge, { borderRadius: theme.radii.lg }]
                : [styles.imageCarree, { borderRadius: theme.radii.lg }]
            }
          />
        </View>
      )}

      <View style={styles.pied}>
        <LienAction libelle="Lire la suite" couleur={theme.colors.primary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titre: {
    marginTop: 10,
  },
  resume: {
    marginTop: 8,
  },
  texteResume: {
    flex: 1,
  },
  cote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  empile: {
    flexDirection: 'column',
  },
  imageCarree: {
    width: 132,
    height: 132,
  },
  imageLarge: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  pied: {
    marginTop: 12,
  },
});
