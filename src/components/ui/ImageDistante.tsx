/**
 * Image distante, avec attente et repli.
 *
 * POURQUOI CE COMPOSANT EXISTE
 * ----------------------------
 * Une image d'actualité vient du réseau. Entre l'instant où la carte apparaît
 * et celui où les pixels arrivent, il y a un vide — et un vide non dessiné se
 * remplit d'un rectangle noir ou blanc selon la plateforme. Un cadre pastel
 * avec une icône discrète occupe cette place, et l'écran ne saute pas.
 *
 * LES TROIS ÉTATS SONT DESSINÉS
 * -----------------------------
 * `chargement`, `affichee`, `echec`. Le troisième est le plus important et le
 * plus souvent oublié : une adresse morte — fichier retiré du stockage, lien
 * recopié de travers — laisserait sinon un cadre vide, que le lecteur interprète
 * comme une image lente plutôt que comme une image absente. L'icône barrée dit
 * la différence.
 *
 * PAS D'ANIMATION D'APPARITION
 * ----------------------------
 * Un fondu serait joli, mais il faudrait suivre une animation en plus de l'état
 * de chargement, et une image qui disparaît pendant un défilement rapide
 * produirait un clignotement. On affiche, simplement.
 */

import { useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '@/providers/theme-provider';
import type { TonPastel } from '@/theme';

interface ImageDistanteProps {
  readonly source: string;
  /** Dimensions et rayon. Accepte un tableau, comme tout style de vue. */
  readonly style?: StyleProp<ViewStyle>;
  /** Décrit l'image pour un lecteur d'écran. Omise, l'image est décorative. */
  readonly description?: string;
  /** Icône du repli, quand l'image ne dit rien par elle-même. */
  readonly iconeRepli?: keyof typeof Ionicons.glyphMap;
  /**
   * Ton du cadre d'attente et du repli. L'appelant y passe le ton de sa
   * catégorie : la vignette prend alors la couleur de la pastille posée
   * au-dessus, au lieu d'ajouter une teinte de plus à la carte.
   */
  readonly ton?: TonPastel;
}

export function ImageDistante({
  source,
  style,
  description,
  iconeRepli = 'image-outline',
  ton = 'bleu',
}: ImageDistanteProps): React.JSX.Element {
  const { theme } = useTheme();
  const [etat, setEtat] = useState<'chargement' | 'affichee' | 'echec'>('chargement');

  const pastel = theme.colors.pastels[ton];
  const rayon = theme.radii.lg;

  return (
    <View
      style={[styles.cadre, { borderRadius: rayon, backgroundColor: pastel.fond }, style]}
      // Décorative par défaut : une image d'illustration n'apprend rien de plus
      // que le titre qu'elle accompagne. Quand elle porte une information — la
      // photo d'un plat, par exemple — l'appelant passe `description`, et elle
      // devient annonçable.
      accessible={description !== undefined}
      accessibilityLabel={description}
      accessibilityRole={description === undefined ? 'none' : 'image'}
    >
      {etat !== 'affichee' ? (
        <View style={styles.repli} pointerEvents="none">
          <Ionicons
            name={etat === 'echec' ? 'image-outline' : iconeRepli}
            size={26}
            color={pastel.encre}
            style={etat === 'echec' ? styles.efface : undefined}
          />
        </View>
      ) : null}

      <Image
        source={{ uri: source }}
        // `cover` et non `contain` : les images publiées viennent d'horizons
        // divers, et `contain` laisserait des bandes vides de chaque côté. On
        // rogne plutôt que de déformer — un visage étiré se remarque tout de
        // suite, un cadrage serré non.
        resizeMode="cover"
        onLoad={() => {
          setEtat('affichee');
        }}
        onError={() => {
          setEtat('echec');
        }}
        style={[styles.image, { borderRadius: rayon, opacity: etat === 'affichee' ? 1 : 0 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cadre: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  repli: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  efface: {
    // L'icône du repli d'échec est volontairement estompée : elle signale une
    // absence, elle ne doit pas attirer l'œil comme le ferait une illustration.
    opacity: 0.55,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
