/**
 * Onglet Agenda — les dates importantes.
 *
 * DEUX VUES, ET NON UNE LISTE UNIQUE
 * ----------------------------------
 * « Quand est la réunion sur les CM2 ? » se répond dans la liste des
 * événements passés ; « qu'est-ce qui arrive la semaine prochaine ? » se répond
 * dans celle des événements à venir. Une liste unique obligerait à faire défiler
 * des mois d'historique, et la distance à parcourir grandirait avec le temps —
 * exactement l'inverse de ce qu'on souhaite.
 *
 * L'ÉVÉNEMENT EN COURS EST MARQUÉ
 * -------------------------------
 * Une réunion de 18 h à 20 h est encore « à venir » pour la base tant que son
 * début n'est pas passé. Sans indication, un parent qui ouvre l'application à
 * 19 h voit une réunion listée comme si elle n'avait pas commencé. Le marquage
 * « En ce moment » lève cette ambiguïté.
 */

import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, EmptyState, ErrorNotice, LoadingView, Pill, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { useTheme } from '@/providers/theme-provider';
import { listerEvenementsPasses, listerProchainsEvenements } from '@/services/agenda';
import type { EvenementAgenda } from '@/types/models';
import { dateLongue, estEnCours, estPasse, heure } from '@/utils/date';

type Vue = 'avenir' | 'passes';

export default function AgendaScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [vue, setVue] = useState<Vue>('avenir');

  const { etat, recharger } = useAsyncData<readonly EvenementAgenda[]>(`agenda-${vue}`, () => {
    const maintenant = new Date().toISOString();
    return vue === 'avenir'
      ? listerProchainsEvenements(maintenant)
      : listerEvenementsPasses(maintenant);
  });

  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(
    etat.statut === 'chargement',
    recharger,
  );

  const entete = (
    <View style={{ paddingTop: theme.spacing.lg }}>
      <AppText variant="caption" color="accent">
        Vie de l’école
      </AppText>
      <AppText variant="display" style={styles.titreEcran}>
        Agenda
      </AppText>
      <AppText variant="body" color="muted">
        Réunions, sorties, vacances et dates à retenir.
      </AppText>

      <View
        style={[
          styles.segments,
          {
            backgroundColor: theme.colors.surfaceSunken,
            borderRadius: theme.radii.md,
            marginTop: theme.spacing.lg,
            padding: 3,
          },
        ]}
      >
        <Segment libelle="À venir" actif={vue === 'avenir'} onPress={() => setVue('avenir')} />
        <Segment libelle="Passés" actif={vue === 'passes'} onPress={() => setVue('passes')} />
      </View>
    </View>
  );

  return (
    <Screen
      scrollable
      rafraichissement={{ enCours: enRafraichissement, onRefresh: tirerPourRafraichir }}
    >
      {entete}

      {etat.statut === 'chargement' ? <LoadingView /> : null}

      {etat.statut === 'erreur' ? (
        <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
      ) : null}

      {etat.statut === 'succes' ? (
        <View style={[styles.liste, { marginTop: theme.spacing.lg }]}>
          {etat.donnees.length === 0 ? (
            <EmptyState
              titre={vue === 'avenir' ? 'Aucune date à venir' : 'Aucun événement passé'}
              message={
                vue === 'avenir'
                  ? 'Les prochaines dates publiées par l’école apparaîtront ici.'
                  : 'Les événements terminés seront conservés ici.'
              }
            />
          ) : (
            etat.donnees.map((evenement) => (
              <EvenementCard key={evenement.id} evenement={evenement} />
            ))
          )}
        </View>
      ) : null}
    </Screen>
  );
}

function Segment({
  libelle,
  actif,
  onPress,
}: {
  readonly libelle: string;
  readonly actif: boolean;
  readonly onPress: () => void;
}): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: actif }}
      accessibilityLabel={libelle}
      style={[
        styles.segment,
        {
          borderRadius: theme.radii.sm,
          paddingVertical: theme.spacing.sm,
          backgroundColor: actif ? theme.colors.surface : 'transparent',
        },
      ]}
    >
      <AppText variant="label" color={actif ? 'primary' : 'muted'} style={styles.segmentTexte}>
        {libelle}
      </AppText>
    </Pressable>
  );
}

function EvenementCard({ evenement }: { readonly evenement: EvenementAgenda }): React.JSX.Element {
  const { theme } = useTheme();

  const enCours = estEnCours(evenement.debutLe, evenement.finLe);
  const termine = estPasse(evenement.debutLe, evenement.finLe);

  // L'heure de fin n'est affichée que si elle est connue, et seulement si elle
  // diffère du début : « 18 h – 18 h » n'apporte rien et donne l'impression
  // d'une saisie approximative.
  const plage = useMemo(() => {
    if (evenement.journeeEntiere) {
      return 'Toute la journée';
    }
    const debut = heure(evenement.debutLe);
    if (evenement.finLe === null) {
      return debut;
    }
    const fin = heure(evenement.finLe);
    return fin === debut ? debut : `${debut} – ${fin}`;
  }, [evenement.debutLe, evenement.finLe, evenement.journeeEntiere]);

  return (
    <Card attenuee={termine}>
      <View style={styles.enteteEvenement}>
        <View style={styles.blocTexte}>
          <AppText variant="subtitle">{evenement.titre}</AppText>
          <AppText variant="caption" color="accent" style={styles.plage}>
            {dateLongue(evenement.debutLe)} · {plage}
          </AppText>
        </View>
        {enCours ? <Pill libelle="En ce moment" ton="succes" /> : null}
      </View>

      {evenement.lieu !== null && evenement.lieu.trim() !== '' ? (
        <AppText variant="body" color="secondary" style={{ marginTop: theme.spacing.sm }}>
          {evenement.lieu}
        </AppText>
      ) : null}

      {evenement.description !== null && evenement.description.trim() !== '' ? (
        <AppText variant="body" color="muted" style={{ marginTop: theme.spacing.sm }}>
          {evenement.description}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  titreEcran: {
    marginTop: 2,
  },
  segments: {
    flexDirection: 'row',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
  },
  segmentTexte: {
    textAlign: 'center',
  },
  liste: {
    gap: 12,
  },
  enteteEvenement: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  blocTexte: {
    flex: 1,
  },
  plage: {
    marginTop: 4,
  },
});
