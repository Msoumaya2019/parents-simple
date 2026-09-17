/**
 * Navigation principale.
 *
 * ```
 *   Accueil   Cantine   Agenda   Contact   Plus
 * ```
 *
 * Cinq onglets, pas six : au-delà, les libellés deviennent trop étroits pour
 * être lus sans plisser les yeux, et les cibles tactiles se resserrent sous le
 * seuil où l'on touche juste du premier coup.
 *
 * POURQUOI LE LIBELLÉ EST AFFICHÉ SOUS L'ICÔNE
 * --------------------------------------------
 * Une icône seule — un calendrier, une assiette — n'est pas comprise de la même
 * façon par tout le monde. Le mot lève l'ambiguïté pour un coût dérisoire, et
 * c'est aussi ce qui rend les onglets utilisables par un lecteur d'écran.
 *
 * POURQUOI LA BARRE EST FOURNIE PAR L'APPLICATION
 * -----------------------------------------------
 * `tabBar` remplace la barre par défaut, qui ne sait pas dessiner la pastille
 * arrondie de la maquette. Le raisonnement est dans `BarreOnglets`. Conséquence
 * à connaître : les options `tabBarStyle`, `tabBarActiveTintColor`,
 * `tabBarInactiveTintColor` et `tabBarLabelStyle` ne sont PLUS lues par
 * personne, et les laisser ici donnerait à croire qu'on peut régler l'apparence
 * depuis ce fichier. L'apparence se règle dans `BarreOnglets`, l'identité des
 * onglets ici.
 *
 * POURQUOI `expo-router/js-tabs` ET NON `expo-router`
 * ---------------------------------------------------
 * L'export `Tabs` de la racine est marqué déprécié en SDK 57 ; `js-tabs` est le
 * même navigateur, et il expose en plus le type `BottomTabBarProps` et le
 * contexte de hauteur dont la barre a besoin. C'est aussi ce qui évite
 * d'importer un chemin interne au paquet.
 */

import { Tabs } from 'expo-router/js-tabs';

import { BarreOnglets, type IconesOnglet, type IconesOnglets } from '@/components/BarreOnglets';

interface Onglet extends IconesOnglet {
  /** Nom du fichier dans `app/(tabs)/`, tel que le routeur le présente. */
  readonly nom: string;
  readonly titre: string;
}

const ONGLETS: readonly Onglet[] = [
  { nom: 'index', titre: 'Accueil', icone: 'home-outline', iconeActive: 'home' },
  { nom: 'cantine', titre: 'Cantine', icone: 'restaurant-outline', iconeActive: 'restaurant' },
  { nom: 'agenda', titre: 'Agenda', icone: 'calendar-outline', iconeActive: 'calendar' },
  { nom: 'contact', titre: 'Contact', icone: 'chatbubble-outline', iconeActive: 'chatbubble' },
  { nom: 'plus', titre: 'Plus', icone: 'ellipsis-horizontal', iconeActive: 'ellipsis-horizontal' },
];

/**
 * Les icônes, indexées par nom de route. La barre reçoit `route.name`, pas
 * l'ordre de ce tableau : c'est ce qui lui permet de retrouver l'icône de
 * chaque onglet sans dépendre de leur position.
 */
const ICONES: IconesOnglets = Object.fromEntries(
  ONGLETS.map(({ nom, icone, iconeActive }) => [nom, { icone, iconeActive }]),
);

export default function TabsLayout(): React.JSX.Element {
  return (
    <Tabs
      tabBar={(props) => <BarreOnglets {...props} icones={ICONES} />}
      screenOptions={{ headerShown: false }}
    >
      {ONGLETS.map((onglet) => (
        <Tabs.Screen
          key={onglet.nom}
          name={onglet.nom}
          options={{ title: onglet.titre, tabBarAccessibilityLabel: onglet.titre }}
        />
      ))}
    </Tabs>
  );
}
