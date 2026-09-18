/**
 * Agenda scolaire.
 *
 * Deux listes, et non une seule : les événements à venir, et ceux qui sont
 * passés. Un parent qui cherche « c'était quand, la réunion sur les CM2 ? » a
 * besoin des deux, et une liste unique obligerait à faire défiler des mois
 * d'historique pour retrouver une date récente.
 *
 * LES DEUX LISTES PARTAGENT LE JOUR COURANT, ET NE SE RECOUVRENT PAS
 * ------------------------------------------------------------------
 * « À venir » commence au premier instant du jour courant ; « passés » s'arrête
 * juste avant. La journée entière appartient donc à la première — le seul
 * découpage où une sortie scolaire du jour et une réunion en cours restent là
 * où un parent les cherche. Comparer à l'instant courant, comme on le faisait,
 * rangeait dans le passé tout ce qui avait commencé.
 */

import type { EvenementAgenda } from '@/types/models';
import { client, executer } from '@/services/client';

interface LigneEvenement {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly debut_le: string;
  readonly fin_le: string | null;
  readonly lieu: string | null;
  readonly journee_entiere: boolean;
}

const COLONNES = 'id, titre, description, debut_le, fin_le, lieu, journee_entiere';

function versEvenement(ligne: LigneEvenement): EvenementAgenda {
  return {
    id: ligne.id,
    titre: ligne.titre,
    description: ligne.description,
    debutLe: ligne.debut_le,
    finLe: ligne.fin_le,
    lieu: ligne.lieu,
    journeeEntiere: ligne.journee_entiere,
  };
}

/**
 * Les événements d'aujourd'hui et à venir.
 *
 * `debut_le` est un `timestamptz`, la comparaison porte donc sur un instant. La
 * borne, elle, est le PREMIER INSTANT DU JOUR, et non l'instant courant : un
 * événement qui a commencé n'est pas terminé, et la réunion de 18 h doit rester
 * dans cette liste quand le parent ouvre l'application à 19 h.
 *
 * La borne porte sur `debut_le` et non sur `fin_le` parce que `fin_le` est
 * facultatif : filtrer sur la fin écarterait tous les événements sans heure de
 * fin, c'est-à-dire une bonne part d'entre eux.
 */
export async function listerProchainsEvenements(
  depuisIso: string,
  limite = 50,
): Promise<readonly EvenementAgenda[]> {
  const lignes = await executer<readonly LigneEvenement[]>(
    client()
      .from('agenda_events')
      .select(COLONNES)
      .gte('debut_le', depuisIso)
      .order('debut_le', { ascending: true })
      .limit(limite),
  );

  return lignes.map(versEvenement);
}

/** Les événements des jours précédents, du plus récent au plus ancien. */
export async function listerEvenementsPasses(
  avantIso: string,
  limite = 30,
): Promise<readonly EvenementAgenda[]> {
  const lignes = await executer<readonly LigneEvenement[]>(
    client()
      .from('agenda_events')
      .select(COLONNES)
      .lt('debut_le', avantIso)
      .order('debut_le', { ascending: false })
      .limit(limite),
  );

  return lignes.map(versEvenement);
}
