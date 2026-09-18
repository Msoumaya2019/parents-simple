/**
 * Un sondage, avec ses choix ou ses résultats.
 *
 * LES RÉSULTATS N'APPARAISSENT QU'APRÈS LE VOTE
 * --------------------------------------------
 * Afficher les scores avant de voter oriente la réponse : celui qui voit que
 * 80 % des parents ont choisi une option hésite à exprimer l'avis contraire.
 * Sur un sondage d'association, où l'on cherche à recueillir l'avis de tous et
 * non à confirmer un avis majoritaire, cette influence fausse la mesure.
 *
 * Un sondage fermé montre toujours ses résultats : il n'y a plus rien à
 * orienter, et un parent doit pouvoir consulter ce à quoi il a répondu.
 *
 * LA BARRE DE PROGRESSION PORTE TOUJOURS UN POURCENTAGE ÉCRIT
 * ----------------------------------------------------------
 * Une barre seule ne se lit pas au pixel près, et elle est invisible pour un
 * lecteur d'écran. Le nombre est donc affiché à côté, dans tous les cas.
 *
 * UN VOTE PAR APPAREIL, ET IL NE SE REJOUE PAS
 * -------------------------------------------
 * La base ne remplace pas un vote déjà déposé : `on conflict do nothing` fait
 * qu'un second appui n'ajoute rien. Les choix deviennent donc inactifs dès qu'un
 * vote est connu, plutôt que d'accepter un appui que la base ignorerait —
 * l'écran montrerait alors une réponse qui n'existe pas.
 *
 * Quand le vote est connu mais pas le choix — la base a refusé un vote, et elle
 * ne dit jamais lequel elle détient — les résultats s'affichent quand même, sans
 * qu'aucun choix soit mis en avant, et la mention sous le décompte le dit.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Card, Pill } from '@/components/ui';
import { voteSansChoix } from '@/lib/votes-locaux';
import { useTheme } from '@/providers/theme-provider';
import { partVotes, totalVotes } from '@/services/sondages';
import type { ChoixSondage, Sondage } from '@/types/models';
import { sondageFerme } from '@/utils/date';

interface SondageCardProps {
  readonly sondage: Sondage;
  /** Choix déjà retenu par cet appareil, ou `null`. */
  readonly choixRetenu: string | null;
  readonly onVoter: (sondageId: string, choixId: string) => Promise<void>;
}

export function SondageCard({
  sondage,
  choixRetenu,
  onVoter,
}: SondageCardProps): React.JSX.Element {
  const { theme } = useTheme();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const ferme = sondageFerme(sondage.ouvert, sondage.clotureLe);
  const aVote = choixRetenu !== null;
  const choixConnu = aVote && !voteSansChoix(choixRetenu);
  const montrerResultats = aVote || ferme;
  const total = totalVotes(sondage);

  // Un vote déjà déposé ne se rejoue pas : la base l'ignorerait, et l'écran
  // afficherait alors une réponse qu'elle ne détient pas.
  const inactif = ferme || aVote || enCours !== null;

  const mentionVote = !aVote
    ? ''
    : choixConnu
      ? ' Votre réponse est enregistrée.'
      : ' Un vote a déjà été enregistré depuis cet appareil.';

  const voterPour = async (choixId: string): Promise<void> => {
    // Le même critère que la désactivation des lignes : une seule règle, pour
    // qu'un appui ne puisse pas partir là où l'écran l'interdit.
    if (inactif) {
      return;
    }
    setEnCours(choixId);
    setErreur(null);
    try {
      await onVoter(sondage.id, choixId);
    } catch (inconnue) {
      setErreur(
        inconnue instanceof Error
          ? inconnue.message
          : "Le vote n'a pas pu être enregistré. Réessayez dans un instant.",
      );
    } finally {
      setEnCours(null);
    }
  };

  return (
    <Card>
      <View style={styles.entete}>
        <AppText variant="subtitle" style={styles.question}>
          {sondage.question}
        </AppText>
        {ferme ? <Pill libelle="Clôturé" ton="neutre" /> : null}
      </View>

      {sondage.precisions !== null && sondage.precisions.trim() !== '' ? (
        <AppText variant="body" color="muted" style={{ marginTop: theme.spacing.xs }}>
          {sondage.precisions}
        </AppText>
      ) : null}

      <View style={[styles.choix, { marginTop: theme.spacing.md }]}>
        {sondage.choix.map((choix) => (
          <ChoixLigne
            key={choix.id}
            choix={choix}
            sondage={sondage}
            retenu={choixRetenu === choix.id}
            montrerResultats={montrerResultats}
            desactive={inactif}
            enCours={enCours === choix.id}
            onPress={() => {
              void voterPour(choix.id);
            }}
          />
        ))}
      </View>

      {sondage.choix.length === 0 ? (
        <AppText variant="caption" color="muted">
          Ce sondage n’a pas encore de réponses proposées.
        </AppText>
      ) : null}

      <AppText variant="caption" color="muted" style={{ marginTop: theme.spacing.md }}>
        {total === 0
          ? 'Aucun vote pour le moment.'
          : `${total} vote${total > 1 ? 's' : ''} exprimé${total > 1 ? 's' : ''}.`}
        {mentionVote}
      </AppText>

      {erreur !== null ? (
        <AppText variant="caption" color="danger" style={{ marginTop: theme.spacing.sm }}>
          {erreur}
        </AppText>
      ) : null}
    </Card>
  );
}

interface ChoixLigneProps {
  readonly choix: ChoixSondage;
  readonly sondage: Sondage;
  readonly retenu: boolean;
  readonly montrerResultats: boolean;
  readonly desactive: boolean;
  readonly enCours: boolean;
  readonly onPress: () => void;
}

function ChoixLigne({
  choix,
  sondage,
  retenu,
  montrerResultats,
  desactive,
  enCours,
  onPress,
}: ChoixLigneProps): React.JSX.Element {
  const { theme } = useTheme();

  const part = partVotes(sondage, choix);
  const pourcentage = Math.round(part * 100);

  const fond = retenu
    ? theme.colors.primarySoft
    : montrerResultats
      ? theme.colors.surfaceSunken
      : theme.colors.surface;

  const bordure = retenu ? theme.colors.primary : theme.colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={desactive}
      accessibilityRole="radio"
      accessibilityState={{ selected: retenu, disabled: desactive, busy: enCours }}
      accessibilityLabel={
        montrerResultats ? `${choix.libelle}, ${pourcentage} pour cent` : choix.libelle
      }
      accessibilityHint={desactive ? undefined : 'Enregistre votre réponse'}
      style={({ pressed }) => [
        styles.choixLigne,
        {
          backgroundColor: fond,
          borderColor: bordure,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          opacity: desactive && !retenu && montrerResultats ? 0.75 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {montrerResultats ? (
        // La barre est posée en fond, sous le texte : elle indique la part sans
        // prendre la place du libellé, qui reste lisible quelle que soit sa
        // longueur.
        <View
          pointerEvents="none"
          style={[
            styles.barreFond,
            {
              backgroundColor: retenu ? theme.colors.primary : theme.colors.border,
              opacity: retenu ? 0.28 : 0.35,
              width: `${Math.max(pourcentage, 2)}%`,
              borderTopLeftRadius: theme.radii.sm,
              borderBottomLeftRadius: theme.radii.sm,
            },
          ]}
        />
      ) : null}

      <View style={styles.choixContenu}>
        <AppText variant="body" color={retenu ? 'accent' : 'secondary'} style={styles.choixTexte}>
          {choix.libelle}
        </AppText>
        {montrerResultats ? (
          <AppText variant="label" color={retenu ? 'accent' : 'muted'}>
            {pourcentage} %
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  entete: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  question: {
    flex: 1,
  },
  choix: {
    gap: 8,
  },
  choixLigne: {
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    minHeight: 48,
  },
  barreFond: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  choixContenu: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  choixTexte: {
    flex: 1,
  },
});
