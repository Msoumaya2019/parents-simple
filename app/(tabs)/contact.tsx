/**
 * Onglet Contact — écrire au bureau de l'association.
 *
 * CE QUI EST DIT À L'UTILISATEUR, ET POURQUOI
 * -------------------------------------------
 * Le formulaire rappelle, avant l'envoi, ce que devient le message et ce qui
 * l'accompagne. Un parent qui écrit au sujet de son enfant a le droit de savoir
 * que rien ne l'identifie, sauf s'il choisit de laisser une adresse. C'est une
 * information, pas une clause juridique : elle est donc écrite en clair, à
 * l'endroit où la question se pose.
 *
 * Le rappel sur l'adresse est également utile : sans adresse, le bureau ne peut
 * pas répondre. Beaucoup de parents écrivent en s'attendant à une réponse, et
 * découvrent le contraire trop tard.
 *
 * LA VALIDATION DE L'ADRESSE EST CELLE DU SCHÉMA
 * ----------------------------------------------
 * Seuls le sujet et le message sont exigés ; l'adresse est facultative. Mais
 * lorsqu'elle est renseignée, la base impose une forme plausible — un arobase,
 * un point, pas d'espace — et refuse le reste. Le formulaire applique donc
 * exactement la même règle, et le dit avant l'envoi : sans cela, un parent qui
 * écrivait son numéro de téléphone à cette place remplissait tout, appuyait sur
 * « Envoyer », et recevait une erreur générique qui ne parlait ni d'adresse ni
 * de format — et qui l'invitait à réessayer, ce qui échouait à l'identique.
 *
 * Une validation PLUS stricte serait un autre défaut : refuser une adresse
 * valide décourage plus qu'une adresse erronée, qui se voit à l'absence de
 * réponse. Le motif est donc recopié du schéma, et non inventé ici.
 */

import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Pill, Screen, TextField } from '@/components/ui';
import {
  adresseReponseAcceptable,
  MESSAGE_ADRESSE_INVALIDE,
  normaliserAdresseReponse,
} from '@/lib/adresse-reponse';
import { useTheme } from '@/providers/theme-provider';
import { CATEGORIES_MESSAGE, envoyerMessage, libelleCategorieMessage } from '@/services/messages';
import type { MessageCategorie } from '@/types/models';

const LONGUEUR_SUJET = 160;
const LONGUEUR_MESSAGE = 4000;
const LONGUEUR_ADRESSE = 254;
const MESSAGE_MINIMUM = 10;

export default function ContactScreen(): React.JSX.Element {
  const { theme } = useTheme();

  const [sujet, setSujet] = useState('');
  const [corps, setCorps] = useState('');
  const [categorie, setCategorie] = useState<MessageCategorie>('vie_scolaire');
  const [adresse, setAdresse] = useState('');

  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurSujet, setErreurSujet] = useState<string | null>(null);
  const [erreurCorps, setErreurCorps] = useState<string | null>(null);
  const [erreurAdresse, setErreurAdresse] = useState<string | null>(null);

  const reinitialiser = useCallback(() => {
    setSujet('');
    setCorps('');
    setAdresse('');
    setCategorie('vie_scolaire');
    setEnvoye(false);
    setErreur(null);
    setErreurSujet(null);
    setErreurCorps(null);
    setErreurAdresse(null);
  }, []);

  const envoyer = useCallback(async () => {
    const sujetPropre = sujet.trim();
    const corpsPropre = corps.trim();

    // Ce qui partira réellement. La règle de validation porte sur cette valeur,
    // jamais sur la saisie : c'est ce qui garantit que l'écran ne peut pas
    // accepter une adresse que la base refusera.
    const adresseEnvoyee = normaliserAdresseReponse(adresse);

    let valide = true;

    if (sujetPropre === '') {
      setErreurSujet('Indiquez un objet, même en quelques mots.');
      valide = false;
    } else {
      setErreurSujet(null);
    }

    if (corpsPropre.length < MESSAGE_MINIMUM) {
      setErreurCorps(`Écrivez au moins ${MESSAGE_MINIMUM} caractères.`);
      valide = false;
    } else {
      setErreurCorps(null);
    }

    // La base refuse une adresse qui n'a pas la forme `x@y.z` — et son refus
    // arrive ici sous la forme d'un message générique qui parle de chargement.
    // On applique donc la même règle AVANT d'envoyer, pour que le parent lise
    // ce qui ne va pas à l'endroit où cela ne va pas. Le champ vide reste
    // accepté : `adresseReponseAcceptable` en fait explicitement le cas.
    if (!adresseReponseAcceptable(adresse)) {
      setErreurAdresse(MESSAGE_ADRESSE_INVALIDE);
      valide = false;
    } else {
      setErreurAdresse(null);
    }

    if (!valide) {
      return;
    }

    setEnvoiEnCours(true);
    setErreur(null);

    try {
      await envoyerMessage({
        sujet: sujetPropre,
        corps: corpsPropre,
        categorie,
        reponseA: adresseEnvoyee,
      });
      setEnvoye(true);
      setSujet('');
      setCorps('');
      setAdresse('');
    } catch (inconnue) {
      // Le message d'erreur vient de `traduireErreur`, qui distingue la
      // cadence d'envoi, la connexion et les autres cas. On l'affiche tel quel
      // plutôt que d'imposer ici une formulation générique.
      setErreur(
        inconnue instanceof Error
          ? inconnue.message
          : "Le message n'a pas pu être envoyé. Réessayez dans un instant.",
      );
    } finally {
      setEnvoiEnCours(false);
    }
  }, [adresse, categorie, corps, sujet]);

  return (
    <Screen scrollable>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={{ paddingTop: theme.spacing.lg }}>
          <AppText variant="caption" color="accent">
            Association de parents
          </AppText>
          <AppText variant="display" style={styles.titreEcran}>
            Contact
          </AppText>
          <AppText variant="body" color="muted">
            Une question, un souci avec l’école, une idée à proposer ? Écrivez-nous.
          </AppText>
        </View>

        {envoye ? (
          <Card style={{ marginTop: theme.spacing.lg }}>
            <Pill libelle="Message envoyé" ton="succes" />
            <AppText variant="subtitle" style={{ marginTop: theme.spacing.sm }}>
              Merci, votre message est bien arrivé.
            </AppText>
            <AppText variant="body" color="secondary" style={{ marginTop: theme.spacing.xs }}>
              Le bureau de l’association en prend connaissance. Si vous avez laissé une adresse, une
              réponse vous sera envoyée directement.
            </AppText>
            <Button
              libelle="Écrire un autre message"
              variant="secondaire"
              onPress={reinitialiser}
              style={{ marginTop: theme.spacing.lg }}
            />
          </Card>
        ) : (
          <View style={[styles.formulaire, { marginTop: theme.spacing.lg }]}>
            <View>
              <AppText variant="label" color="secondary" style={styles.libelleGroupe}>
                Objet de votre message
              </AppText>
              <View style={styles.categories}>
                {CATEGORIES_MESSAGE.map((valeur) => (
                  <Pressable
                    key={valeur}
                    onPress={() => setCategorie(valeur)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: categorie === valeur }}
                    accessibilityLabel={libelleCategorieMessage(valeur)}
                    style={[
                      styles.categorie,
                      {
                        borderRadius: theme.radii.pill,
                        paddingHorizontal: theme.spacing.md,
                        paddingVertical: theme.spacing.sm,
                        backgroundColor:
                          categorie === valeur
                            ? theme.colors.primarySoft
                            : theme.colors.surfaceSunken,
                        borderColor: categorie === valeur ? theme.colors.primary : 'transparent',
                      },
                    ]}
                  >
                    <AppText
                      variant="caption"
                      style={{
                        color:
                          categorie === valeur ? theme.colors.primary : theme.colors.textSecondary,
                      }}
                    >
                      {libelleCategorieMessage(valeur)}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>

            <TextField
              label="Sujet"
              obligatoire
              value={sujet}
              onChangeText={setSujet}
              placeholder="Par exemple : problème de car le mardi soir"
              maxLength={LONGUEUR_SUJET}
              erreur={erreurSujet}
            />

            <TextField
              label="Votre message"
              obligatoire
              value={corps}
              onChangeText={setCorps}
              placeholder="Décrivez la situation. Plus votre message est précis, plus il sera facile d’y répondre."
              multiline
              maxLength={LONGUEUR_MESSAGE}
              erreur={erreurCorps}
            />

            <TextField
              label="Adresse e-mail pour la réponse"
              value={adresse}
              onChangeText={setAdresse}
              placeholder="prenom.nom@exemple.fr"
              keyboardType="email-address"
              autoCapitalize="none"
              maxLength={LONGUEUR_ADRESSE}
              aide="Sans adresse, le bureau ne pourra pas vous répondre personnellement."
              erreur={erreurAdresse}
            />

            {erreur !== null ? (
              <Card style={{ borderColor: theme.colors.danger }}>
                <AppText variant="label" color="danger">
                  {erreur}
                </AppText>
              </Card>
            ) : null}

            <Button
              libelle="Envoyer au bureau"
              onPress={() => {
                void envoyer();
              }}
              enCours={envoiEnCours}
              accessibilityHint="Transmet votre message au bureau de l’association"
            />

            <AppText variant="caption" color="muted" style={styles.mention}>
              Votre message est transmis au bureau de l’association. Aucune information personnelle
              n’y est jointe : rien ne vous identifie, sauf l’adresse que vous choisissez
              d’indiquer. Les messages sont conservés le temps nécessaire à leur traitement.
            </AppText>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titreEcran: {
    marginTop: 2,
  },
  formulaire: {
    gap: 20,
  },
  libelleGroupe: {
    marginBottom: 8,
  },
  categories: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categorie: {
    borderWidth: 1,
  },
  mention: {
    lineHeight: 18,
  },
});
