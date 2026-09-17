/**
 * Réglages.
 *
 * DEUX SECTIONS, ET UNE SEULE QUI APPELLE UNE ACTION
 * --------------------------------------------------
 * L'apparence, qui se règle ; et l'état de l'application, qui se constate. La
 * seconde n'est pas décorative : quand l'application n'affiche aucune donnée,
 * la première question est de savoir si c'est l'école qui n'a rien publié ou
 * l'application qui n'est pas reliée à sa base. Cette section répond à cette
 * question sans qu'il faille appeler quelqu'un.
 *
 * Le diagnostic n'expose aucun secret : l'adresse de la base est tronquée, et
 * la clé publique n'est jamais affichée. Elle est de toute façon extractible du
 * binaire, mais l'afficher à l'écran en faciliterait la copie — y compris par
 * capture d'écran, dans un message.
 */

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Screen } from '@/components/ui';
import { appConfig } from '@/config/env';
import { useTheme, type PreferenceTheme } from '@/providers/theme-provider';

const OPTIONS: readonly {
  readonly valeur: PreferenceTheme;
  readonly libelle: string;
  readonly description: string;
}[] = [
  {
    valeur: 'auto',
    libelle: 'Automatique',
    description: 'Suit le réglage de votre téléphone',
  },
  { valeur: 'light', libelle: 'Clair', description: 'Fond clair, texte foncé' },
  { valeur: 'dark', libelle: 'Sombre', description: 'Fond sombre, texte clair' },
];

export default function ReglagesScreen(): React.JSX.Element {
  const { theme, preference, definirPreference } = useTheme();

  const version = Constants.expoConfig?.version ?? '0.1.0';
  const adresseBase =
    appConfig.supabase === null
      ? null
      : // On n'affiche que l'hôte : la clé publique, même si elle est
        // extractible du binaire, n'a pas à être recopiée à l'écran.
        appConfig.supabase.url.replace(/^https:\/\//, '');

  return (
    <Screen edges={[]} scrollable>
      <View style={{ paddingTop: theme.spacing.lg }}>
        <AppText variant="title">Apparence</AppText>
        <AppText variant="body" color="muted" style={styles.sousTitre}>
          Choisissez l’affichage qui vous convient le mieux.
        </AppText>

        <View style={[styles.options, { marginTop: theme.spacing.md }]}>
          {OPTIONS.map((option) => {
            const choisie = preference === option.valeur;
            return (
              <Pressable
                key={option.valeur}
                onPress={() => definirPreference(option.valeur)}
                accessibilityRole="radio"
                accessibilityState={{ selected: choisie }}
                accessibilityLabel={option.libelle}
                accessibilityHint={option.description}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: choisie ? theme.colors.primary : theme.colors.border,
                    borderWidth: choisie ? 1.5 : StyleSheet.hairlineWidth,
                    borderRadius: theme.radii.lg,
                    padding: theme.spacing.lg,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <View style={styles.optionTexte}>
                  <AppText variant="label">{option.libelle}</AppText>
                  <AppText variant="caption" color="muted">
                    {option.description}
                  </AppText>
                </View>

                {choisie ? (
                  <Ionicons name="checkmark-circle" size={22} color={theme.colors.primary} />
                ) : (
                  <View
                    style={[styles.cercle, { borderColor: theme.colors.border, borderRadius: 11 }]}
                  />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/*  État de l'application                                              */}
      {/* ------------------------------------------------------------------ */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <AppText variant="title">État de l’application</AppText>
        <AppText variant="body" color="muted" style={styles.sousTitre}>
          À consulter si aucune information ne s’affiche.
        </AppText>

        <Card style={{ marginTop: theme.spacing.md }}>
          <LigneDiagnostic
            libelle="Base de données"
            valeur={adresseBase === null ? 'Non configurée' : adresseBase}
            correcte={adresseBase !== null}
          />
          <LigneDiagnostic libelle="Version" valeur={version} correcte />

          {appConfig.configError !== null ? (
            <AppText variant="caption" color="danger" style={{ marginTop: theme.spacing.md }}>
              {appConfig.configError}
            </AppText>
          ) : null}
        </Card>
      </View>

      {/* ------------------------------------------------------------------ */}
      {/*  À propos                                                           */}
      {/* ------------------------------------------------------------------ */}
      <View style={{ marginTop: theme.spacing.xl }}>
        <AppText variant="title">À propos</AppText>

        <Card style={{ marginTop: theme.spacing.md }}>
          <AppText variant="body" color="secondary">
            Application d’information des parents des écoles maternelle et élémentaire Frères
            Lumières, à Montmagny.
          </AppText>
          <AppText variant="caption" color="muted" style={{ marginTop: theme.spacing.sm }}>
            Cette application ne demande aucun compte et ne collecte aucune donnée personnelle sans
            votre démarche. Le détail figure dans la rubrique Confidentialité.
          </AppText>
        </Card>
      </View>

      <View style={{ height: theme.spacing.xxl }} />
    </Screen>
  );
}

function LigneDiagnostic({
  libelle,
  valeur,
  correcte,
}: {
  readonly libelle: string;
  readonly valeur: string;
  readonly correcte: boolean;
}): React.JSX.Element {
  const { theme } = useTheme();

  return (
    <View style={[styles.ligneDiagnostic, { paddingVertical: theme.spacing.sm }]}>
      <View style={styles.diagnosticLibelle}>
        <Ionicons
          name={correcte ? 'checkmark-circle-outline' : 'alert-circle-outline'}
          size={18}
          color={correcte ? theme.colors.success : theme.colors.warning}
        />
        <AppText variant="body" color="secondary">
          {libelle}
        </AppText>
      </View>
      <AppText variant="caption" color="muted" numberOfLines={1} style={styles.diagnosticValeur}>
        {valeur}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  sousTitre: {
    marginTop: 4,
  },
  options: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 64,
  },
  optionTexte: {
    flex: 1,
  },
  cercle: {
    width: 22,
    height: 22,
    borderWidth: 1.5,
  },
  ligneDiagnostic: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  diagnosticLibelle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  diagnosticValeur: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
