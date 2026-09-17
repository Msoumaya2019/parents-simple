/**
 * Onglet Accueil — les dernières actualités.
 *
 * La liste est virtualisée (`FlatList`) plutôt qu'enveloppée dans un
 * `ScrollView` : le fil peut contenir plusieurs dizaines d'actualités, et un
 * `ScrollView` les monterait toutes d'un coup, y compris celles qui ne seront
 * jamais vues.
 *
 * L'en-tête de liste — le titre de l'écran — défile avec le contenu. C'est
 * volontaire : sur un petit téléphone, une barre de titre fixe mange une
 * hauteur précieuse au profit d'une information qui n'apprend rien après la
 * première seconde.
 */

import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AnnonceCard } from '@/components/AnnonceCard';
import { AppText, EmptyState, ErrorNotice, LoadingView, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { listerAnnonces } from '@/services/annonces';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce } from '@/types/models';

export default function AccueilScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  const { etat, recharger } = useAsyncData<readonly Annonce[]>('annonces', () => listerAnnonces());

  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(
    etat.statut === 'chargement',
    recharger,
  );

  const ouvrirAnnonce = useCallback(
    (id: string) => {
      router.push(`/annonce/${id}`);
    },
    [router],
  );

  const entete = (
    <View style={[styles.entete, { paddingTop: theme.spacing.lg }]}>
      <AppText variant="caption" color="accent">
        École Frères Lumières
      </AppText>
      <AppText variant="display" style={styles.titreEcran}>
        Accueil
      </AppText>
      <AppText variant="body" color="muted">
        Les informations de l’école et de l’association de parents.
      </AppText>
    </View>
  );

  if (etat.statut === 'chargement' && !enRafraichissement) {
    return (
      <Screen>
        {entete}
        <LoadingView message="Chargement des actualités…" />
      </Screen>
    );
  }

  if (etat.statut === 'erreur') {
    return (
      <Screen scrollable>
        {entete}
        <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
      </Screen>
    );
  }

  const annonces = etat.statut === 'succes' ? etat.donnees : [];

  return (
    <Screen sansPadding>
      <FlatList
        data={annonces}
        keyExtractor={(annonce) => annonce.id}
        contentContainerStyle={[
          styles.liste,
          { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
        ]}
        ListHeaderComponent={entete}
        ItemSeparatorComponent={() => <View style={{ height: theme.spacing.md }} />}
        refreshControl={
          <RefreshControl
            refreshing={enRafraichissement}
            onRefresh={tirerPourRafraichir}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            titre="Aucune actualité pour le moment"
            message="Les informations publiées par l’école et l’association apparaîtront ici."
          />
        }
        renderItem={({ item }) => (
          <AnnonceCard annonce={item} onPress={() => ouvrirAnnonce(item.id)} />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  entete: {
    paddingBottom: 16,
  },
  titreEcran: {
    marginTop: 2,
  },
  liste: {
    flexGrow: 1,
  },
});
