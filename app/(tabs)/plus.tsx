/**
 * Onglet Plus — sondages, documents et réglages.
 *
 * POURQUOI LES SONDAGES SONT AFFICHÉS ICI, ET NON DERRIÈRE UN LIEN
 * ---------------------------------------------------------------
 * Les sondages sont la seule partie de cet onglet qui change et qui attend une
 * action. Les enfouir derrière une entrée de menu ferait qu'un parent ne les
 * verrait jamais — et un sondage que personne ne voit ne sert à rien. Les
 * documents et les réglages, eux, se consultent volontairement : ils sont donc
 * derrière une entrée, ce qui garde l'écran lisible.
 *
 * LE VOTE EST ENREGISTRÉ EN DEUX ENDROITS, ET C'EST NÉCESSAIRE
 * -----------------------------------------------------------
 * Dans la base, qui fait autorité, et sur l'appareil, qui permet d'afficher
 * « votre réponse ». La table des votes étant fermée en lecture, l'application
 * n'a aucun autre moyen de savoir ce qu'elle a voté.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { SondageCard } from '@/components/SondageCard';
import { AppText, Card, ErrorNotice, LoadingView, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { enregistrerVote, lireVotesLocaux } from '@/lib/votes-locaux';
import { useTheme } from '@/providers/theme-provider';
import { listerDocuments } from '@/services/documents';
import { listerSondages, voter as voterEnBase } from '@/services/sondages';
import type { DocumentUtile, Sondage } from '@/types/models';

export default function PlusScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const router = useRouter();

  const [votes, setVotes] = useState<Record<string, string>>({});

  const sondages = useAsyncData<readonly Sondage[]>('sondages', () => listerSondages());
  const documents = useAsyncData<readonly DocumentUtile[]>('documents-plus', () =>
    listerDocuments(200),
  );

  const { recharger: rechargerSondages } = sondages;
  const { recharger: rechargerDocuments } = documents;

  const rechargerTout = useCallback(() => {
    rechargerSondages();
    rechargerDocuments();
  }, [rechargerSondages, rechargerDocuments]);

  // Le geste n'est terminé que lorsque les DEUX chargements le sont : l'écran
  // montre des sondages et des documents, et l'indicateur s'arrêterait sur le
  // premier revenu, en laissant l'autre se remplir après coup.
  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(
    sondages.etat.statut === 'chargement' || documents.etat.statut === 'chargement',
    rechargerTout,
  );

  useEffect(() => {
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
  }, []);

  const voter = useCallback(
    async (sondageId: string, choixId: string) => {
      await voterEnBase(sondageId, choixId);
      // L'écriture locale vient après celle de la base : si le vote a échoué,
      // rien ne doit laisser croire à l'écran qu'il a été pris en compte.
      await enregistrerVote(sondageId, choixId);
      setVotes((actuels) => ({ ...actuels, [sondageId]: choixId }));
      sondages.recharger();
    },
    [sondages],
  );

  const nombreDocuments = documents.etat.statut === 'succes' ? documents.etat.donnees.length : null;

  return (
    <Screen
      scrollable
      rafraichissement={{ enCours: enRafraichissement, onRefresh: tirerPourRafraichir }}
    >
      <View style={{ paddingTop: theme.spacing.lg }}>
        <AppText variant="caption" color="accent">
          Association de parents
        </AppText>
        <AppText variant="display" style={styles.titreEcran}>
          Plus
        </AppText>
        <AppText variant="body" color="muted">
          Sondages, documents utiles et réglages de l’application.
        </AppText>
      </View>

      {/* ---------------------------------------------------------------- */}
      {/*  Sondages                                                         */}
      {/* ---------------------------------------------------------------- */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <AppText variant="title" style={styles.titreSection}>
          Sondages
        </AppText>

        {sondages.etat.statut === 'chargement' ? <LoadingView /> : null}

        {sondages.etat.statut === 'erreur' ? (
          <ErrorNotice
            message={sondages.etat.message}
            technique={sondages.etat.technique}
            onReessayer={sondages.recharger}
          />
        ) : null}

        {sondages.etat.statut === 'succes' ? (
          sondages.etat.donnees.length === 0 ? (
            <Card>
              <AppText variant="body" color="muted">
                Aucun sondage en cours. Le bureau de l’association en publiera ici lorsqu’il
                souhaitera consulter les parents.
              </AppText>
            </Card>
          ) : (
            <View style={styles.liste}>
              {sondages.etat.donnees.map((sondage) => (
                <SondageCard
                  key={sondage.id}
                  sondage={sondage}
                  choixRetenu={votes[sondage.id] ?? null}
                  onVoter={voter}
                />
              ))}
            </View>
          )
        ) : null}
      </View>

      {/* ---------------------------------------------------------------- */}
      {/*  Accès rapides                                                    */}
      {/* ---------------------------------------------------------------- */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <AppText variant="title" style={styles.titreSection}>
          Utile
        </AppText>

        <View style={styles.liste}>
          <LigneAction
            icone="document-text-outline"
            titre="Documents importants"
            sousTitre={
              nombreDocuments === null
                ? 'Formulaires, calendriers, règlements'
                : nombreDocuments === 0
                  ? 'Aucun document publié'
                  : `${nombreDocuments} document${nombreDocuments > 1 ? 's' : ''} disponible${nombreDocuments > 1 ? 's' : ''}`
            }
            onPress={() => router.push('/documents')}
          />

          <LigneAction
            icone="settings-outline"
            titre="Réglages"
            sousTitre="Affichage, thème, à propos"
            onPress={() => router.push('/reglages')}
          />

          <LigneAction
            icone="lock-closed-outline"
            titre="Confidentialité"
            sousTitre="Quelles données sont conservées, et où"
            onPress={() => router.push('/confidentialite')}
          />
        </View>
      </View>

      <View style={{ height: theme.spacing.xxl }} />
    </Screen>
  );
}

interface LigneActionProps {
  readonly icone: keyof typeof Ionicons.glyphMap;
  readonly titre: string;
  readonly sousTitre: string;
  readonly onPress: () => void;
}

function LigneAction({ icone, titre, sousTitre, onPress }: LigneActionProps): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={titre}
      accessibilityHint={sousTitre}
      style={({ pressed }) => [
        styles.ligneAction,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View
        style={[
          styles.pastille,
          { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radii.md },
        ]}
      >
        <Ionicons name={icone} size={20} color={theme.colors.primary} />
      </View>

      <View style={styles.ligneActionTexte}>
        <AppText variant="label">{titre}</AppText>
        <AppText variant="caption" color="muted">
          {sousTitre}
        </AppText>
      </View>

      <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titreEcran: {
    marginTop: 2,
  },
  titreSection: {
    marginBottom: 12,
  },
  liste: {
    gap: 12,
  },
  ligneAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 64,
  },
  pastille: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneActionTexte: {
    flex: 1,
  },
});
