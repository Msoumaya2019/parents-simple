/**
 * Onglet Cantine — les menus de la semaine.
 *
 * POURQUOI UNE SEMAINE, ET NON UNE LISTE CONTINUE
 * -----------------------------------------------
 * Un parent consulte la cantine pour répondre à une question précise : « qu'est
 * ce qu'il mange demain ? », ou « qu'est-ce qu'il a mangé aujourd'hui ? ». Une
 * liste continue obligerait à faire défiler pour trouver la bonne date, et la
 * position à atteindre changerait chaque jour. La semaine est la décision
 * qu'on prend en préparant les affaires du lendemain.
 *
 * LES JOURS SANS MENU SONT AFFICHÉS
 * ---------------------------------
 * Mercredi, samedi et dimanche n'ont en général pas de menu, et un jour férié
 * non plus. Les passer sous silence ferait croire à un défaut d'affichage. Ils
 * apparaissent donc, avec une mention qui distingue **deux** situations :
 * « Pas de cantine ce jour-là. » quand la base ne porte aucune ligne pour ce
 * jour, et « Menu non renseigné. » quand la ligne existe mais est vide — le
 * repas est prévu, on ne sait pas encore ce qu'il contient. Les confondre
 * ferait passer un retard de publication pour une fermeture.
 *
 * LA SEMAINE AFFICHÉE N'EST PAS TOUJOURS CELLE D'AUJOURD'HUI
 * ----------------------------------------------------------
 * Six jours sur sept, l'écran ouvre sur la semaine qui contient la date du
 * jour. Le dimanche, non : la semaine qui se termine n'a plus un seul jour
 * d'école devant elle, et « demain » — le lundi qui suit — appartient à la
 * semaine suivante. Ouvrir sur la semaine révolue affichait sept cartes dont
 * six atténuées, et laissait le parent chercher à la main la semaine qu'il
 * venait préparer. La règle est dans `semaineDeCantine`, avec les autres
 * fonctions de date : elle est ainsi éprouvable sans charger cet écran.
 *
 * La navigation est bornée à quelques semaines en arrière et en avant : au-delà,
 * les menus ne sont pas encore publiés — ou plus conservés — et laisser défiler
 * indéfiniment ne mènerait qu'à des écrans vides.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, ErrorNotice, LoadingView, Pill, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { useTheme } from '@/providers/theme-provider';
import { listerMenus } from '@/services/cantine';
import type { MenuCantine } from '@/types/models';
import {
  decalerJours,
  jourCivilCourt,
  jourCourant,
  semaineDeCantine,
  versJourCivil,
} from '@/utils/date';

/** Nombre de semaines explorables de part et d'autre de la semaine courante. */
const SEMAINES_EN_ARRIERE = 4;
const SEMAINES_EN_AVANT = 4;

const NOMS_JOURS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
] as const;

export default function CantineScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [decalage, setDecalage] = useState(0);

  // Le lundi de la semaine affichée. Recalculé à chaque changement de semaine,
  // et non mémorisé : la date du jour peut changer si l'application reste
  // ouverte toute la nuit, ce qui arrive sur un téléphone qu'on ne ferme pas.
  // La semaine de départ n'est pas toujours celle d'aujourd'hui : voir l'en-tête.
  const lundi = useMemo(() => {
    const base = semaineDeCantine();
    return decalerJours(base, decalage * 7);
  }, [decalage]);

  const dimanche = useMemo(() => decalerJours(lundi, 6), [lundi]);
  const cle = versJourCivil(lundi);

  const { etat, enCours, recharger } = useAsyncData<readonly MenuCantine[]>(`menus-${cle}`, () =>
    listerMenus(cle, 7),
  );

  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(enCours, recharger);

  const aujourdhui = jourCourant();

  const parJour = useMemo(() => {
    const index = new Map<string, MenuCantine>();
    if (etat.statut === 'succes') {
      for (const menu of etat.donnees) {
        index.set(menu.serviceDate, menu);
      }
    }
    return index;
  }, [etat]);

  const changerSemaine = useCallback((delta: number) => {
    setDecalage((actuel) => {
      const suivant = actuel + delta;
      if (suivant < -SEMAINES_EN_ARRIERE || suivant > SEMAINES_EN_AVANT) {
        return actuel;
      }
      return suivant;
    });
  }, []);

  // Le libellé suit le décalage, pas la semaine ouverte : le dimanche,
  // « Cette semaine » désigne donc la semaine qui commence le lendemain. C'est
  // celle que le parent prépare, et c'est la même phrase que les six autres
  // jours — un libellé spécial pour le dimanche ne ferait que déplacer la
  // question.
  const titreSemaine =
    decalage === 0
      ? 'Cette semaine'
      : decalage === -1
        ? 'La semaine dernière'
        : decalage === 1
          ? 'La semaine prochaine'
          : `Semaine du ${jourCivilCourt(versJourCivil(lundi))}`;

  const entete = (
    <View style={{ paddingTop: theme.spacing.lg }}>
      <AppText variant="caption" color="accent">
        Restauration scolaire
      </AppText>
      <AppText variant="display" style={styles.titreEcran}>
        Cantine
      </AppText>
      <AppText variant="body" color="muted">
        Les menus servis à l’école, du lundi au vendredi.
      </AppText>

      <View
        style={[
          styles.barreSemaine,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.lg,
            marginTop: theme.spacing.lg,
            paddingHorizontal: theme.spacing.sm,
          },
        ]}
      >
        <BoutonSemaine
          direction="precedent"
          actif={decalage > -SEMAINES_EN_ARRIERE}
          onPress={() => changerSemaine(-1)}
        />
        <View style={styles.libelleSemaine}>
          <AppText variant="label">{titreSemaine}</AppText>
          <AppText variant="caption" color="muted">
            {jourCivilCourt(versJourCivil(lundi))} – {jourCivilCourt(versJourCivil(dimanche))}
          </AppText>
        </View>
        <BoutonSemaine
          direction="suivant"
          actif={decalage < SEMAINES_EN_AVANT}
          onPress={() => changerSemaine(1)}
        />
      </View>
    </View>
  );

  return (
    <Screen
      scrollable
      rafraichissement={{ enCours: enRafraichissement, onRefresh: tirerPourRafraichir }}
    >
      {entete}

      {etat.statut === 'chargement' ? <LoadingView message="Chargement des menus…" /> : null}

      {etat.statut === 'erreur' ? (
        <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
      ) : null}

      {etat.statut === 'succes' ? (
        <View style={[styles.jours, { marginTop: theme.spacing.lg }]}>
          {NOMS_JOURS.map((nom, index) => {
            const jour = versJourCivil(decalerJours(lundi, index));
            return (
              <JourCard
                key={jour}
                nom={nom}
                jour={jour}
                menu={parJour.get(jour) ?? null}
                estAujourdhui={jour === aujourdhui}
                estPasse={jour < aujourdhui}
              />
            );
          })}

          {etat.donnees.length === 0 ? (
            <EmptyState
              titre="Aucun menu publié pour cette semaine"
              message="Les menus sont publiés par l’école, en général la semaine précédente."
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

/** Flèche de navigation entre les semaines. */
function BoutonSemaine({
  direction,
  actif,
  onPress,
}: {
  readonly direction: 'precedent' | 'suivant';
  readonly actif: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();
  const estPrecedent = direction === 'precedent';

  return (
    <Pressable
      onPress={onPress}
      disabled={!actif}
      accessibilityRole="button"
      accessibilityLabel={estPrecedent ? 'Semaine précédente' : 'Semaine suivante'}
      accessibilityState={{ disabled: !actif }}
      // Zone tactile de 44 points, même si l'icône en fait 22 : c'est la taille
      // minimale pour viser sans se tromper, et la flèche est étroite.
      style={({ pressed }) => [
        styles.boutonSemaine,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: pressed ? theme.colors.surfaceSunken : 'transparent',
          opacity: actif ? 1 : 0.25,
        },
      ]}
    >
      <Ionicons
        name={estPrecedent ? 'chevron-back' : 'chevron-forward'}
        size={22}
        color={theme.colors.primary}
        aria-hidden
      />
    </Pressable>
  );
}

interface JourCardProps {
  readonly nom: string;
  readonly jour: string;
  readonly menu: MenuCantine | null;
  readonly estAujourdhui: boolean;
  readonly estPasse: boolean;
}

function JourCard({ nom, jour, menu, estAujourdhui, estPasse }: JourCardProps): React.JSX.Element {
  const { theme } = useTheme();

  const aUnMenu = menu !== null;
  const contientQuelqueChose =
    aUnMenu && (menu.plat !== null || menu.entree !== null || menu.dessert !== null);

  return (
    <Card
      attenuee={estPasse && !estAujourdhui}
      style={estAujourdhui ? { borderColor: theme.colors.primary, borderWidth: 1.5 } : undefined}
    >
      <View style={styles.enteteJour}>
        <View>
          <AppText variant="label">{nom}</AppText>
          <AppText variant="caption" color="muted">
            {jourCivilCourt(jour)}
          </AppText>
        </View>
        {estAujourdhui ? <Pill libelle="Aujourd’hui" ton="accent" /> : null}
      </View>

      {contientQuelqueChose ? (
        <View style={[styles.lignes, { marginTop: theme.spacing.md }]}>
          {menu.entree !== null && menu.entree.trim() !== '' ? (
            <LigneMenu libelle="Entrée" valeur={menu.entree} />
          ) : null}
          {menu.plat !== null && menu.plat.trim() !== '' ? (
            <LigneMenu libelle="Plat" valeur={menu.plat} />
          ) : null}
          {menu.dessert !== null && menu.dessert.trim() !== '' ? (
            <LigneMenu libelle="Dessert" valeur={menu.dessert} />
          ) : null}
        </View>
      ) : (
        <AppText variant="body" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {aUnMenu ? 'Menu non renseigné.' : 'Pas de cantine ce jour-là.'}
        </AppText>
      )}

      {menu !== null && menu.allergenes.length > 0 ? (
        <View style={[styles.allergenes, { marginTop: theme.spacing.md }]}>
          {menu.allergenes.map((allergene) => (
            <Pill key={allergene} libelle={allergene} ton="alerte" />
          ))}
        </View>
      ) : null}

      {menu !== null && menu.notes !== null && menu.notes.trim() !== '' ? (
        <AppText variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {menu.notes}
        </AppText>
      ) : null}
    </Card>
  );
}

function LigneMenu({
  libelle,
  valeur,
}: {
  readonly libelle: string;
  readonly valeur: string;
}): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={styles.ligneMenu}>
      <AppText variant="caption" color="muted" style={[styles.libelleMenu, { minWidth: 62 }]}>
        {libelle}
      </AppText>
      <AppText variant="body" color="secondary" style={styles.valeurMenu}>
        {valeur}
      </AppText>
      <View style={{ height: theme.spacing.xs }} />
    </View>
  );
}

const styles = StyleSheet.create({
  titreEcran: {
    marginTop: 2,
  },
  barreSemaine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
  },
  libelleSemaine: {
    flex: 1,
    alignItems: 'center',
  },
  boutonSemaine: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jours: {
    gap: 12,
  },
  enteteJour: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lignes: {
    gap: 2,
  },
  ligneMenu: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  libelleMenu: {
    paddingTop: 3,
  },
  valeurMenu: {
    flex: 1,
  },
  allergenes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
