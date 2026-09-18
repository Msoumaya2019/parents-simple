/**
 * Barre d'onglets.
 *
 * POURQUOI ELLE EST ÉCRITE À LA MAIN
 * ----------------------------------
 * La maquette demande une pastille arrondie derrière l'onglet actif. Aucun des
 * deux leviers offerts par la bibliothèque ne le permet :
 *
 *   - `tabBarIcon` est rendu DEUX FOIS, superposées — une version active et une
 *     version inactive qui se fondent l'une dans l'autre — dans une boîte de
 *     31 × 28 points. Une pastille posée là serait dessinée deux fois, et
 *     rognée à 31 points de large ;
 *   - `tabBarActiveBackgroundColor` colorerait bien le fond de l'onglet, mais
 *     le rayon de ce fond est calculé par la bibliothèque et vaut `0` pour une
 *     barre en bas d'écran — il ne vaut 10 que pour une barre latérale. On
 *     obtiendrait un rectangle plein, pas la pastille de la maquette.
 *
 * CE QUI EST REPRIS DE L'IMPLÉMENTATION PAR DÉFAUT
 * -----------------------------------------------
 * L'appui émet `tabPress` puis navigue si l'événement n'a pas été intercepté,
 * et l'onglet déjà actif ne renavigue pas : c'est ce qui permet à un écran de
 * remonter en haut de sa liste en réappuyant sur son onglet. Le libellé
 * accessible annonce la position — « Cantine, onglet 2 sur 5 ».
 *
 * POURQUOI LA HAUTEUR N'EST PAS FIXÉE
 * -----------------------------------
 * Rien n'impose de hauteur à une barre fournie par l'appelant : elle est en
 * flux normal, sous les écrans. Elle prend donc la hauteur de son contenu et
 * grandit avec la taille de police du téléphone, au lieu de rogner le libellé.
 * Elle reste bornée : le libellé tient sur une ligne, plafonné à 1,5 fois la
 * taille normale. Au-delà, « Accueil » se tronquerait en « Acc… », ce qui ne se
 * lit pas — un mot entier à 18 points vaut mieux qu'un mot coupé à 36.
 *
 * La hauteur mesurée est publiée dans le contexte de la bibliothèque, sans quoi
 * `useBottomTabBarHeight` répondrait 49 points pour une barre qui en mesure 84.
 */

import { Ionicons } from '@expo/vector-icons';
import { BottomTabBarHeightCallbackContext, type BottomTabBarProps } from 'expo-router/js-tabs';
import { use } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

/** Icônes d'un onglet, dans ses deux états. */
export interface IconesOnglet {
  readonly icone: keyof typeof Ionicons.glyphMap;
  readonly iconeActive: keyof typeof Ionicons.glyphMap;
}

/** Icônes par nom de route. Voir `app/(tabs)/_layout.tsx`. */
export type IconesOnglets = Readonly<Record<string, IconesOnglet>>;

/**
 * Repli d'un onglet dont l'icône n'a pas été déclarée. Un fichier ajouté dans
 * `app/(tabs)/` sans entrée dans la table apparaîtrait ainsi, plutôt que de
 * rester invisible — un écran qu'on ne peut pas atteindre est un écran perdu.
 */
const ICONE_REPLI: IconesOnglet = { icone: 'ellipse-outline', iconeActive: 'ellipse' };

/** Voir « Pourquoi la hauteur n'est pas fixée » : au-delà, le mot se tronque. */
const ECHELLE_LIBELLE_MAX = 1.5;

const TAILLE_ICONE = 20;

interface BarreOngletsProps extends BottomTabBarProps {
  readonly icones: IconesOnglets;
}

export function BarreOnglets({
  state,
  descriptors,
  navigation,
  insets,
  icones,
}: BarreOngletsProps): React.JSX.Element {
  const { theme } = useTheme();
  const signalerHauteur = use(BottomTabBarHeightCallbackContext);

  const actif = theme.colors.pastels.bleu;

  return (
    <View
      role="tablist"
      onLayout={(evenement) => {
        signalerHauteur?.(evenement.nativeEvent.layout.height);
      }}
      style={[
        styles.barre,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingTop: theme.spacing.xs,
          paddingBottom: theme.spacing.xs + insets.bottom,
        },
      ]}
    >
      {state.routes.map((route, position) => {
        // Le descripteur est typé comme pouvant manquer, sans que cela puisse
        // arriver : le navigateur le construit à partir des mêmes routes. S'il
        // manquait malgré tout, l'onglet reste rendu et prend le nom de sa
        // route — le faire disparaître rendrait un écran inatteignable.
        const options = descriptors[route.key]?.options;
        const selectionne = state.index === position;
        const icone = icones[route.name] ?? ICONE_REPLI;

        // `tabBarLabel` peut être une fonction ; ce projet ne s'en sert pas et
        // le titre déclaré suffit alors à nommer l'onglet.
        const brut = options?.tabBarLabel;
        const libelle = typeof brut === 'string' ? brut : (options?.title ?? route.name);

        const onPress = () => {
          const evenement = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!selectionne && !evenement.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        };

        const couleur = selectionne ? actif.encre : theme.colors.textMuted;

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={onLongPress}
            // `role: 'tab'` ne produit pas l'annonce attendue sur iOS — la
            // bibliothèque retombe elle aussi sur `button` pour cette
            // plateforme —, et le libellé explicite porte alors l'information.
            role={Platform.select({ ios: 'button', default: 'tab' })}
            aria-selected={selectionne}
            accessibilityLabel={
              options?.tabBarAccessibilityLabel ??
              `${libelle}, onglet ${position + 1} sur ${state.routes.length}`
            }
            accessibilityLargeContentTitle={libelle}
            accessibilityShowsLargeContentViewer
            // La barre par défaut accompagnait chaque appui d'une ondulation sur
            // Android ; réécrire la barre l'avait fait disparaître. On reprend
            // ici la convention du projet — `Card` ternit la sienne de la même
            // façon —, qui vaut sur les deux plateformes. Sans elle, appuyer
            // sur l'onglet DÉJÀ actif ne change rien à l'écran : le geste semble
            // n'avoir pas été enregistré.
            style={({ pressed }) => [styles.onglet, pressed && styles.ongletAppuye]}
          >
            <View
              style={[
                styles.pastille,
                {
                  backgroundColor: selectionne ? actif.fond : 'transparent',
                  borderRadius: theme.radii.lg,
                },
              ]}
            >
              <Ionicons
                name={selectionne ? icone.iconeActive : icone.icone}
                size={TAILLE_ICONE}
                color={couleur}
                aria-hidden
              />
              <AppText
                variant="caption"
                numberOfLines={1}
                maxFontSizeMultiplier={ECHELLE_LIBELLE_MAX}
                style={{ color: couleur }}
              >
                {libelle}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  onglet: {
    // Les cinq onglets se partagent la largeur à parts égales. Aucune largeur
    // fixe : elle serait fausse sur l'un des formats d'iPhone.
    flex: 1,
    justifyContent: 'center',
  },
  ongletAppuye: {
    // Même valeur que `Card.pressee` : deux composants qui s'estompent
    // différemment à l'appui se liraient comme deux applications.
    opacity: 0.75,
  },
  pastille: {
    alignItems: 'center',
    justifyContent: 'center',
    // La pastille occupe presque toute la largeur de l'onglet, comme sur la
    // maquette, mais garde un écart avec sa voisine : deux pastilles jointives
    // se liraient comme un seul bloc.
    marginHorizontal: 4,
    paddingVertical: 2,
    gap: 1,
  },
});
