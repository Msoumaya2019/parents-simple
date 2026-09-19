/**
 * Documents importants.
 *
 * L'OUVERTURE PASSE PAR LE NAVIGATEUR DU SYSTÈME
 * ----------------------------------------------
 * Un PDF s'ouvre dans Safari ou Chrome, où le parent retrouve ses gestes
 * habituels : zoom, partage, enregistrement dans Fichiers, impression. Une
 * visionneuse intégrée à l'application obligerait à réimplémenter tout cela,
 * moins bien, et empêcherait d'enregistrer le document.
 *
 * L'ÉCHEC D'OUVERTURE EST EXPLIQUÉ
 * --------------------------------
 * `Linking.openURL` ne dit pas si le fichier existe : il confie l'adresse au
 * système, qui ouvre le navigateur même quand il n'y a rien derrière. Le
 * fichier est donc interrogé avant, et son absence signalée dans
 * l'application — plutôt que par un JSON d'erreur dans un onglet.
 *
 * Le contrôle ne bloque que sur une preuve positive d'absence : le signal
 * `NoSuchKey` de Supabase Storage, reconnu par son code **ou** par le texte
 * `Object not found` de sa réponse — `fichierAbsent` accepte les deux, et
 * `scripts/verifier-requetes-app.mjs` compare sa formulation à celle du service
 * pour que les deux ne divergent pas. Un statut inattendu laisse l'ouverture se
 * faire : refuser un document qui existe serait pire que d'afficher une erreur
 * de navigateur.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorNotice, LoadingView, Pill, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useRafraichissement } from '@/hooks/useRafraichissement';
import { useTheme } from '@/providers/theme-provider';
import {
  adresseDocument,
  fichierAbsent,
  libelleCategorieDocument,
  listerDocuments,
} from '@/services/documents';
import type { DocumentUtile } from '@/types/models';
import { dateSansJour, tailleLisible } from '@/utils/date';

export default function DocumentsScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);

  const { etat, enCours, recharger } = useAsyncData<readonly DocumentUtile[]>('documents', () =>
    listerDocuments(),
  );

  const { enRafraichissement, tirerPourRafraichir } = useRafraichissement(enCours, recharger);

  const ouvrir = useCallback(async (document: DocumentUtile) => {
    setErreurOuverture(null);
    try {
      const adresse = adresseDocument(document.storagePath);

      // On interroge le fichier avant de confier l'adresse au navigateur.
      // `Linking.openURL` se contente de la passer au système : il réussit même
      // quand la page derrière affiche une erreur. Sans ce contrôle, un
      // document retiré du stockage ouvrirait un onglet montrant le JSON brut
      // de la base — mesuré : statut 400, `"code":"NoSuchKey"` — que le parent
      // ne peut pas interpréter.
      //
      // La requête ne demande qu'un octet : le fichier n'est pas téléchargé
      // deux fois, et la réponse porte le corps qui distingue les causes.
      const reponse = await fetch(adresse, { headers: { Range: 'bytes=0-0' } });

      if (!reponse.ok) {
        const corps = await reponse.text();

        // On ne refuse d'ouvrir que sur une preuve positive d'absence. Un
        // statut inattendu laisse l'ouverture se faire : mieux vaut un onglet
        // d'erreur qu'un document existant déclaré indisponible.
        if (fichierAbsent(corps)) {
          setErreurOuverture(
            "Ce document n'est plus disponible. Signalez-le à l'association si vous en avez besoin.",
          );
          return;
        }
      }

      // Pas de `canOpenURL` : pour une adresse `https`, le navigateur du
      // système la prend toujours en charge. Le contrôle ne peut donc rien
      // apprendre, et son échec — possible sur Android récent si les intentions
      // ne sont pas déclarées — afficherait un refus faux.
      await Linking.openURL(adresse);
    } catch {
      setErreurOuverture(
        "L'ouverture du document a échoué. Vérifiez votre connexion, puis réessayez.",
      );
    }
  }, []);

  return (
    <Screen
      edges={[]}
      scrollable
      rafraichissement={{ enCours: enRafraichissement, onRefresh: tirerPourRafraichir }}
    >
      <View style={{ paddingTop: theme.spacing.lg }}>
        <AppText variant="body" color="muted">
          Formulaires, calendriers et documents utiles aux familles. Ils s’ouvrent dans votre
          navigateur, où vous pouvez les enregistrer.
        </AppText>
      </View>

      {erreurOuverture !== null ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <ErrorNotice message={erreurOuverture} />
        </View>
      ) : null}

      {etat.statut === 'chargement' ? <LoadingView /> : null}

      {etat.statut === 'erreur' ? (
        <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
      ) : null}

      {etat.statut === 'succes' ? (
        etat.donnees.length === 0 ? (
          <EmptyState
            titre="Aucun document publié"
            message="Les documents déposés par l’association apparaîtront ici."
          />
        ) : (
          <View style={[styles.liste, { marginTop: theme.spacing.lg }]}>
            {etat.donnees.map((document) => (
              <Pressable
                key={document.id}
                onPress={() => {
                  void ouvrir(document);
                }}
                accessibilityRole="link"
                accessibilityLabel={`Ouvrir le document : ${document.titre}`}
                accessibilityHint="Ouvre le document dans votre navigateur"
                style={({ pressed }) => [
                  styles.ligne,
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
                  <Ionicons
                    name="document-text"
                    size={20}
                    color={theme.colors.primary}
                    aria-hidden
                  />
                </View>

                <View style={styles.texte}>
                  <AppText variant="label">{document.titre}</AppText>

                  {document.description !== null && document.description.trim() !== '' ? (
                    <AppText variant="caption" color="muted" style={styles.description}>
                      {document.description}
                    </AppText>
                  ) : null}

                  <View style={styles.meta}>
                    <Pill libelle={libelleCategorieDocument(document.categorie)} ton="neutre" />
                    <AppText variant="caption" color="muted">
                      {dateSansJour(document.publieLe)}
                      {document.tailleOctets === null
                        ? ''
                        : ` · ${tailleLisible(document.tailleOctets)}`}
                    </AppText>
                  </View>
                </View>

                <Ionicons
                  name="download-outline"
                  size={20}
                  color={theme.colors.textMuted}
                  aria-hidden
                />
              </Pressable>
            ))}
          </View>
        )
      ) : null}

      <View style={{ height: theme.spacing.xxl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  liste: {
    gap: 12,
  },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 72,
  },
  pastille: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texte: {
    flex: 1,
  },
  description: {
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
});
