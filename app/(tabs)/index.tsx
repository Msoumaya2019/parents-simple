/**
 * Onglet Accueil — les dernières actualités.
 *
 * La liste est virtualisée (`FlatList`) plutôt qu'enveloppée dans un
 * `ScrollView` : le fil peut contenir plusieurs dizaines d'actualités, et un
 * `ScrollView` les monterait toutes d'un coup, y compris celles qui ne seront
 * jamais vues.
 *
 * POURQUOI LA PREMIÈRE ACTUALITÉ A SA PROPRE CARTE
 * ------------------------------------------------
 * La liste est triée par la base : les actualités épinglées d'abord, puis des
 * plus récentes aux plus anciennes. La première est donc celle que le bureau a
 * voulu mettre en avant, et elle reçoit une carte plus grande — `AnnonceEnAvant`
 * plutôt qu'`AnnonceCard`. C'est le même objet, présenté autrement.
 *
 * POURQUOI LA BANNIÈRE EST HORS DES MARGES
 * ----------------------------------------
 * Le conteneur de liste n'a pas de marge horizontale : chaque section pose la
 * sienne. C'est ce qui permet à la bannière de toucher les deux bords de
 * l'écran, comme sur la maquette, tout en laissant les cartes en retrait. Une
 * marge posée une fois pour toutes sur le conteneur aurait obligé à en sortir
 * par un contre-style négatif, ce qui se casse au premier changement de marge.
 */

import { useCallback } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AccesRapide } from '@/components/AccesRapide';
import { AnnonceCard } from '@/components/AnnonceCard';
import { AnnonceEnAvant } from '@/components/AnnonceEnAvant';
import { BanniereAccueil } from '@/components/BanniereAccueil';
import { SondageAccueil } from '@/components/SondageAccueil';
import { AppText, EmptyState, ErrorNotice, LoadingView, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { listerAnnonces } from '@/services/annonces';
import { listerSondages } from '@/services/sondages';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce, Sondage } from '@/types/models';
import { sondageFerme } from '@/utils/date';

export default function AccueilScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  const { etat, recharger } = useAsyncData<readonly Annonce[]>('annonces', () => listerAnnonces());

  // Les sondages sont chargés séparément, et leur échec n'empêche pas le fil de
  // s'afficher : une invitation à voter qui ne charge pas ne doit pas priver le
  // parent des actualités de l'école.
  const sondages = useAsyncData<readonly Sondage[]>('sondages-accueil', () => listerSondages(5));

  const { recharger: rechargerSondages } = sondages;
  const rechargerTout = useCallback(() => {
    recharger();
    rechargerSondages();
  }, [recharger, rechargerSondages]);

  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(
    etat.statut === 'chargement' || sondages.etat.statut === 'chargement',
    rechargerTout,
  );

  const ouvrirAnnonce = useCallback(
    (id: string) => {
      router.push(`/annonce/${id}`);
    },
    [router],
  );

  // Les deux valeurs dérivées sont calculées ici, avant l'en-tête : `entete`
  // consulte `annonces.length` pour décider s'il affiche le titre de section, et
  // une `const` déclarée plus bas serait en zone morte temporelle au moment de
  // cette lecture.
  const annonces = etat.statut === 'succes' ? etat.donnees : [];

  // Un sondage déjà clôturé ne mérite pas une invitation : le parent ne pourrait
  // qu'y constater un résultat. On ne propose que ce à quoi on peut répondre.
  const sondageOuvert =
    sondages.etat.statut === 'succes'
      ? (sondages.etat.donnees.find(
          (candidat) => !sondageFerme(candidat.ouvert, candidat.clotureLe),
        ) ?? null)
      : null;

  const marge = { paddingHorizontal: theme.spacing.lg };

  const entete = (
    <View>
      <BanniereAccueil
        pleineLargeur
        surTitre="École Frères Lumières"
        titre="Accueil"
        sousTitre="Les informations de l’école et de l’association de parents."
      />

      <View style={[marge, styles.raccourcis, { marginTop: theme.spacing.lg }]}>
        <View style={[styles.rangee, { gap: theme.spacing.md }]}>
          <AccesRapide
            titre="Nous contacter"
            sousTitre="Une question ?"
            icone="chatbubble-ellipses"
            ton="bleu"
            onPress={() => {
              router.push('/contact');
            }}
          />
          <AccesRapide
            titre="Sondages"
            sousTitre="Donnez votre avis"
            icone="stats-chart"
            ton="violet"
            onPress={() => {
              router.push('/plus');
            }}
          />
        </View>

        <View style={[styles.rangee, { gap: theme.spacing.md }]}>
          <AccesRapide
            titre="Cantine"
            sousTitre="Menus et infos"
            icone="restaurant"
            ton="menthe"
            onPress={() => {
              router.push('/cantine');
            }}
          />
          <AccesRapide
            titre="Agenda"
            sousTitre="Tous les événements"
            icone="calendar"
            ton="orange"
            onPress={() => {
              router.push('/agenda');
            }}
          />
        </View>
      </View>

      {annonces.length > 0 ? (
        <View style={[marge, { marginTop: theme.spacing.lg }]}>
          <AppText variant="title">Dernières actualités</AppText>
        </View>
      ) : null}
    </View>
  );

  if (etat.statut === 'chargement' && !enRafraichissement) {
    return (
      <Screen sansPadding>
        {entete}
        <LoadingView message="Chargement des actualités…" />
      </Screen>
    );
  }

  if (etat.statut === 'erreur') {
    return (
      <Screen sansPadding>
        {entete}
        <View style={marge}>
          <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen sansPadding>
      <FlatList
        data={annonces}
        keyExtractor={(annonce) => annonce.id}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
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
          <View style={[marge, { marginTop: theme.spacing.md }]}>
            <EmptyState
              titre="Aucune actualité pour le moment"
              message="Les informations publiées par l’école et l’association apparaîtront ici."
            />
          </View>
        }
        ListFooterComponent={
          sondageOuvert === null ? null : (
            <View style={[marge, { marginTop: theme.spacing.md }]}>
              <SondageAccueil
                sondage={sondageOuvert}
                onParticiper={() => {
                  router.push('/plus');
                }}
              />
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <View style={marge}>
            {index === 0 ? (
              <AnnonceEnAvant annonce={item} onPress={() => ouvrirAnnonce(item.id)} />
            ) : (
              <AnnonceCard annonce={item} onPress={() => ouvrirAnnonce(item.id)} />
            )}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  raccourcis: {
    gap: 12,
  },
  rangee: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
});
