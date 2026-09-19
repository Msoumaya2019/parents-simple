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
 *
 * POURQUOI LES VOTES DE L'APPAREIL SONT RELUS À CHAQUE RETOUR
 * ----------------------------------------------------------
 * La carte de sondage de l'accueil ne savait rien des votes de l'appareil :
 * elle invitait à répondre, même après qu'on ait répondu. Lire la mémoire
 * locale une fois au montage n'aurait pas suffi — cet écran reste monté quand
 * on passe à l'onglet Plus, où le vote a lieu. Un parent qui votait puis
 * revenait à l'accueil retrouvait donc l'invitation d'avant. C'est la relecture
 * au retour sur l'écran, et non la lecture initiale, qui rend la carte vraie.
 */

import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { AccesRapide } from '@/components/AccesRapide';
import { AnnonceCard } from '@/components/AnnonceCard';
import { AnnonceEnAvant } from '@/components/AnnonceEnAvant';
import { BanniereAccueil } from '@/components/BanniereAccueil';
import { SondageAccueil } from '@/components/SondageAccueil';
import { EmptyState, ErrorNotice, LoadingView, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { invitationAccueil } from '@/lib/sondage-accueil';
import { lireVotesLocaux } from '@/lib/votes-locaux';
import { listerAnnonces } from '@/services/annonces';
import { listerSondages } from '@/services/sondages';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce, Sondage } from '@/types/models';

export default function AccueilScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  const [votes, setVotes] = useState<Record<string, string>>({});

  const { etat, enCours, recharger } = useAsyncData<readonly Annonce[]>('annonces', () =>
    listerAnnonces(),
  );

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
    enCours || sondages.enCours,
    rechargerTout,
  );

  // Le garde `actif` empêche d'écrire un état après la perte du foyer : la
  // lecture est asynchrone, et le parent peut avoir quitté l'écran entre-temps.
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      void (async () => {
        const table = await lireVotesLocaux();
        if (actif) {
          setVotes(table);
        }
      })();
      return () => {
        actif = false;
      };
    }, []),
  );

  const ouvrirAnnonce = useCallback(
    (id: string) => {
      router.push(`/annonce/${id}`);
    },
    [router],
  );

  // Les valeurs dérivées des deux chargements. Calculées une fois, avant
  // l'en-tête et les branches de rendu : les recalculer dans chacune serait
  // autant d'occasions de diverger.
  const annonces = etat.statut === 'succes' ? etat.donnees : [];

  // Ce que l'accueil propose, et ce qu'il en dit. La règle est dans
  // `@/lib/sondage-accueil` : elle sait, elle, si l'appareil a déjà répondu.
  const invitation =
    sondages.etat.statut === 'succes' ? invitationAccueil(sondages.etat.donnees, votes) : null;

  const marge = { paddingHorizontal: theme.spacing.lg };

  const entete = (
    // La marge basse est posée ici et non sur la grille : l'écart entre deux
    // cartes vient d'`ItemSeparatorComponent`, qui ne s'applique ni avant la
    // première ni après la dernière. Sans cette ligne, la grille de raccourcis
    // et la première actualité se toucheraient.
    <View style={{ paddingBottom: theme.spacing.md }}>
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
          invitation === null ? null : (
            <View style={[marge, { marginTop: theme.spacing.md }]}>
              <SondageAccueil
                invitation={invitation}
                onOuvrir={() => {
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
