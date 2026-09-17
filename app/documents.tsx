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
 * `Linking.openURL` ne dit pas si le fichier existe. Un document dont le
 * fichier a été retiré du stockage produit un lien qui ne mène nulle part, et
 * le navigateur affiche alors une erreur générique. On préfère signaler
 * l'échec dans l'application, avec la marche à suivre.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorNotice, LoadingView, Pill, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useTheme } from '@/providers/theme-provider';
import { adresseDocument, libelleCategorieDocument, listerDocuments } from '@/services/documents';
import type { DocumentUtile } from '@/types/models';
import { dateSansJour, tailleLisible } from '@/utils/date';

export default function DocumentsScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const [erreurOuverture, setErreurOuverture] = useState<string | null>(null);

  const { etat, recharger } = useAsyncData<readonly DocumentUtile[]>('documents', () =>
    listerDocuments(),
  );

  const ouvrir = useCallback(async (document: DocumentUtile) => {
    setErreurOuverture(null);
    try {
      const adresse = adresseDocument(document.storagePath);
      const prisEnCharge = await Linking.canOpenURL(adresse);
      if (!prisEnCharge) {
        setErreurOuverture(
          'Ce document ne peut pas être ouvert sur cet appareil. Essayez depuis un ordinateur.',
        );
        return;
      }
      await Linking.openURL(adresse);
    } catch {
      setErreurOuverture(
        "L'ouverture du document a échoué. Vérifiez votre connexion, puis réessayez.",
      );
    }
  }, []);

  return (
    <Screen edges={[]} scrollable>
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
                  <Ionicons name="document-text" size={20} color={theme.colors.primary} />
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

                <Ionicons name="download-outline" size={20} color={theme.colors.textMuted} />
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
