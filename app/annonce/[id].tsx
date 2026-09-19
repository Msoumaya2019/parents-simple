/**
 * Détail d'une actualité.
 *
 * L'identifiant est relu depuis l'adresse. `useLocalSearchParams` peut rendre
 * un tableau si le segment est répété — ce qui n'arrive pas ici, mais le type
 * l'autorise : on prend donc la première valeur plutôt que de supposer une
 * chaîne, sinon un `id` inattendu produirait une requête avec `undefined` et
 * un écran vide sans explication.
 */

import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText, EmptyState, ErrorNotice, LoadingView, Pill, Screen } from '@/components/ui';
import { useAsyncData } from '@/hooks/useAsyncData';
import { INDICATEUR_IMPORTANT, obtenirAnnonce } from '@/services/annonces';
import { useTheme } from '@/providers/theme-provider';
import type { Annonce } from '@/types/models';
import { dateLongue, depuis } from '@/utils/date';

/**
 * Relit un paramètre d'adresse sous forme de chaîne.
 *
 * `useLocalSearchParams` rend une chaîne, ou un tableau de chaînes si le
 * segment est répété dans l'adresse — et le type le dit : son paramètre
 * générique est contraint à `Record<string, string | string[]>`.
 *
 * ON POURRAIT LE LUI DIRE, ET C'EST POUR CELA QU'ON NE LE FAIT PAS.
 * Le crochet accepte aussi le chemin de la route, et rend alors la forme
 * **déclarée** pour cette route — `useLocalSearchParams<'/annonce/[id]'>()`.
 * Ce serait une ASSERTION sur une valeur qui vient d'une adresse, pas une
 * vérification : le jour où le segment est répété, le type affirmerait une
 * chaîne sur un tableau, et l'identifiant partirait en requête sans que rien
 * ne le signale.
 *
 * On prend donc la valeur en `unknown` et on la ramène à une chaîne. C'est le
 * seul endroit du projet où le type d'entrée est volontairement inconnu, et
 * c'est parce que la valeur ne vient pas du code.
 */
function premierParametre(valeur: unknown): string {
  if (typeof valeur === 'string') {
    return valeur;
  }
  if (Array.isArray(valeur)) {
    const premier: unknown = valeur[0];
    return typeof premier === 'string' ? premier : '';
  }
  return '';
}

export default function AnnonceDetailScreen(): React.JSX.Element {
  const { theme } = useTheme();
  const parametres = useLocalSearchParams();
  const id = premierParametre(parametres.id);

  const { etat, recharger } = useAsyncData<Annonce | null>(`annonce-${id}`, () =>
    obtenirAnnonce(id),
  );

  if (etat.statut === 'chargement') {
    return (
      <Screen edges={[]}>
        <LoadingView />
      </Screen>
    );
  }

  if (etat.statut === 'erreur') {
    return (
      <Screen edges={[]} scrollable>
        <ErrorNotice message={etat.message} technique={etat.technique} onReessayer={recharger} />
      </Screen>
    );
  }

  const annonce = etat.donnees;

  if (annonce === null) {
    return (
      <Screen edges={[]}>
        <EmptyState
          titre="Actualité introuvable"
          message="Elle a peut-être été retirée depuis l’ouverture de l’application."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]} scrollable>
      <View style={{ paddingTop: theme.spacing.lg }}>
        <View style={styles.ligne}>
          <AppText variant="caption" color="muted">
            {depuis(annonce.publieeLe)}
          </AppText>
          {annonce.epinglee ? <Pill {...INDICATEUR_IMPORTANT} /> : null}
        </View>

        <AppText variant="title" style={styles.titre}>
          {annonce.titre}
        </AppText>

        <AppText variant="caption" color="muted" style={styles.date}>
          {dateLongue(annonce.publieeLe)}
        </AppText>

        <View
          style={[
            styles.separateur,
            { backgroundColor: theme.colors.border, marginVertical: theme.spacing.lg },
          ]}
        />

        <AppText variant="body" color="secondary">
          {annonce.corps}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titre: {
    marginTop: 6,
  },
  date: {
    marginTop: 4,
  },
  separateur: {
    height: StyleSheet.hairlineWidth,
  },
});
