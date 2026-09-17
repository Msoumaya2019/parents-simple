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
 * La hauteur de la barre additionne une base et la marge basse du thème : sur
 * un iPhone à encoche, l'indicateur d'accueil recouvre le bas de la barre, et
 * sans cette marge le libellé se retrouve sous la barre gestuelle.
 */

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/providers/theme-provider';

type NomIcone = keyof typeof Ionicons.glyphMap;

interface Onglet {
  readonly nom: string;
  readonly titre: string;
  readonly icone: NomIcone;
  readonly iconeActive: NomIcone;
}

const ONGLETS: readonly Onglet[] = [
  { nom: 'index', titre: 'Accueil', icone: 'home-outline', iconeActive: 'home' },
  { nom: 'cantine', titre: 'Cantine', icone: 'restaurant-outline', iconeActive: 'restaurant' },
  { nom: 'agenda', titre: 'Agenda', icone: 'calendar-outline', iconeActive: 'calendar' },
  { nom: 'contact', titre: 'Contact', icone: 'chatbubble-outline', iconeActive: 'chatbubble' },
  { nom: 'plus', titre: 'Plus', icone: 'ellipsis-horizontal', iconeActive: 'ellipsis-horizontal' },
];

export default function TabsLayout(): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + theme.spacing.md,
          paddingTop: theme.spacing.sm,
          paddingBottom: theme.spacing.md,
        },
        tabBarLabelStyle: {
          fontSize: theme.typography.size.xs,
          fontWeight: theme.typography.weight.medium,
        },
      }}
    >
      {ONGLETS.map((onglet) => (
        <Tabs.Screen
          key={onglet.nom}
          name={onglet.nom}
          options={{
            title: onglet.titre,
            tabBarAccessibilityLabel: onglet.titre,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? onglet.iconeActive : onglet.icone}
                color={color}
                size={size}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
