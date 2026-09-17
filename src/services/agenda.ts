/**
 * Agenda scolaire.
 *
 * Deux listes, et non une seule : les événements à venir, et ceux qui sont
 * passés. Un parent qui cherche « c'était quand, la réunion sur les CM2 ? » a
 * besoin des deux, et une liste unique obligerait à faire défiler des mois
 * d'historique pour retrouver une date récente.
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
 * Les prochains événements.
 *
 * La borne est un instant ISO : `debut_le` est un `timestamptz`, la comparaison
 * porte donc sur un moment précis, et non sur un jour.
 *
 * Un événement sans heure de fin est inclus tant que son début n'est pas passé.
 * C'est le comportement souhaité — on ne peut pas savoir qu'il est terminé — et
 * c'est pourquoi la borne porte sur `debut_le` et non sur `fin_le`.
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

/** Les événements passés, du plus récent au plus ancien. */
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
