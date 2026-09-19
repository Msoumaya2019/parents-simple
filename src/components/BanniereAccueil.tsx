/**
 * Bannière de l'accueil.
 *
 * C'est la première chose qu'un parent voit en ouvrant l'application. Elle doit
 * dire trois choses — de quelle école il s'agit, où il se trouve, et ce qu'il
 * trouvera ici — sans qu'il ait à lire quoi que ce soit d'autre.
 *
 * POURQUOI IL N'Y A PAS DE PHOTO
 * ------------------------------
 * La maquette prévoit une photographie de l'école. Aucune n'est disponible :
 * une photo d'établissement montre des enfants, et en publier une engage des
 * droits que l'association doit régler elle-même. La bannière fonctionne donc
 * sans, et l'emplacement existe.
 *
 * Pour l'occuper : déposer un fichier dans `assets/` — par exemple
 * `assets/banniere-ecole.jpg` — puis remplacer le `null` de `PHOTO_BANNIERE`,
 * plus bas, par le `require` correspondant. Le dégradé qui protège le texte
 * s'active alors automatiquement.
 *
 * POURQUOI LE TEXTE RESTE LISIBLE MÊME AVEC UNE PHOTO
 * ---------------------------------------------------
 * Une photo d'école est claire en haut — un ciel — et chargée en bas. Poser un
 * titre dessus sans précaution donne un texte illisible sur les photos claires
 * et invisible sur les sombres. Le dégradé horizontal qui recouvre la photo
 * n'est donc pas décoratif : il garantit que la zone du texte garde la teinte
 * du ciel, quelle que soit l'image.
 */

import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import { AppText } from '@/components/ui';
import { useTheme } from '@/providers/theme-provider';

/**
 * La photo de bannière, ou `null`.
 *
 * Remplacer par `require('../../assets/banniere-ecole.jpg')` après avoir déposé
 * le fichier. La constante doit rester un `require` littéral : un chemin
 * construit à l'exécution ne serait pas résolu à la compilation, et l'image
 * manquerait sans que rien ne le signale.
 */
const PHOTO_BANNIERE: ImageSourcePropType | null = null;

/**
 * La formule affichée sous le sous-titre.
 *
 * Écrite ici et non dans la base : elle ne change pas d'une année sur l'autre,
 * et lui donner une table serait plus de travail que de la modifier. Le jour où
 * l'association voudra la changer elle-même depuis le tableau de bord, elle
 * deviendra une colonne comme les autres.
 */
const FORMULE = 'Une belle année ensemble !';

/** Angles des rayons du soleil, en degrés. */
const RAYONS = [0, 45, 90, 135, 180, 225, 270, 315];

/** Un soleil discret : un disque et huit rayons. */
function Soleil({ couleur }: { readonly couleur: string }): React.JSX.Element {
  return (
    <View style={styles.soleil} pointerEvents="none">
      {RAYONS.map((angle) => (
        <View
          key={angle}
          style={[
            styles.rayon,
            {
              backgroundColor: couleur,
              // L'ordre des transformations compte : on tourne d'abord le repère,
              // puis on s'éloigne le long de l'axe ainsi tourné. L'inverse
              // empilerait les huit rayons au même endroit.
              transform: [{ rotate: `${angle}deg` }, { translateY: -18 }],
            },
          ]}
        />
      ))}
      <View style={[styles.disque, { backgroundColor: couleur }]} />
    </View>
  );
}

/**
 * Une feuille, dessinée par deux rayons opposés très arrondis.
 *
 * `borderTopLeftRadius` et `borderBottomRightRadius` élevés, les deux autres
 * nuls : la forme obtenue est une feuille, sans avoir à dessiner de courbe.
 */
function Feuille({
  couleur,
  taille,
  rotation,
  style,
}: {
  readonly couleur: string;
  readonly taille: number;
  readonly rotation: string;
  readonly style: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: taille,
          height: taille,
          backgroundColor: couleur,
          borderTopLeftRadius: taille,
          borderBottomRightRadius: taille,
          transform: [{ rotate: rotation }],
        },
        style,
      ]}
    />
  );
}

interface BanniereAccueilProps {
  readonly surTitre: string;
  readonly titre: string;
  readonly sousTitre: string;
  /**
   * Colle la bannière aux bords de l'écran, avec les seuls angles du bas
   * arrondis.
   *
   * C'est la disposition de la maquette : en haut de l'écran, une bannière qui
   * flotterait avec quatre angles arrondis laisserait voir le fond de chaque
   * côté, et se lirait comme une carte parmi d'autres plutôt que comme
   * l'en-tête de la page.
   */
  readonly pleineLargeur?: boolean;
}

export function BanniereAccueil({
  surTitre,
  titre,
  sousTitre,
  pleineLargeur = false,
}: BanniereAccueilProps): React.JSX.Element {
  const { theme } = useTheme();
  const { ciel, cielBas, soleil, feuille, feuilleClaire } = theme.colors.decor;

  const angles = pleineLargeur
    ? { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTopWidth: 0 }
    : null;

  return (
    <View
      style={[
        styles.banniere,
        { borderRadius: theme.radii.xl, borderColor: theme.colors.border },
        angles,
      ]}
    >
      <LinearGradient
        colors={[ciel, cielBas]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.35, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {PHOTO_BANNIERE === null ? null : (
        <>
          <Image source={PHOTO_BANNIERE} resizeMode="cover" style={styles.photo} />
          {/* Le voile qui protège le texte. Il part du ciel opaque à gauche et
              s'efface vers la droite, là où la photo peut se montrer. */}
          <LinearGradient
            colors={[ciel, `${ciel}E6`, `${ciel}00`]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 0.8, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </>
      )}

      <Soleil couleur={soleil} />
      <Feuille couleur={feuille} taille={54} rotation="-18deg" style={styles.feuilleHaute} />
      <Feuille couleur={feuilleClaire} taille={40} rotation="24deg" style={styles.feuilleBasse} />

      <View style={[styles.contenu, { padding: theme.spacing.lg }]}>
        <AppText variant="caption" color="accent">
          {surTitre}
        </AppText>

        <AppText variant="display" style={styles.titre}>
          {titre}
        </AppText>

        <AppText variant="body" color="secondary" style={styles.sousTitre}>
          {sousTitre}
        </AppText>

        <View style={styles.formule}>
          <AppText variant="label" color="accent" style={styles.formuleTexte}>
            {FORMULE}
          </AppText>
          <Ionicons name="sparkles" size={14} color={theme.colors.primary} aria-hidden />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banniere: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'flex-end',
    // Une hauteur minimale plutôt qu'une hauteur fixe : le titre grossit avec
    // la taille de police choisie par le parent, et une bannière figée
    // rognerait le texte au lieu de s'agrandir.
    minHeight: 190,
  },
  photo: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  contenu: {
    // Le texte ne s'étend jamais sur toute la largeur : la photo, quand il y en
    // a une, occupe la droite.
    maxWidth: '82%',
  },
  titre: {
    marginTop: 2,
  },
  sousTitre: {
    marginTop: 6,
  },
  formule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  formuleTexte: {
    fontStyle: 'italic',
  },
  soleil: {
    position: 'absolute',
    top: 14,
    right: 26,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disque: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  rayon: {
    position: 'absolute',
    width: 3,
    height: 9,
    borderRadius: 2,
  },
  // Les deux feuilles sont sur le bord GAUCHE, comme sur la maquette — l'une
  // haute, l'autre basse. Les nommer « gauche » et « droite » aurait été faux :
  // la seconde déborde par la gauche, à 26 points du bord.
  feuilleHaute: {
    top: 18,
    left: -16,
  },
  feuilleBasse: {
    bottom: -10,
    left: 26,
  },
});
