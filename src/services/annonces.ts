/**
 * Actualités du fil d'accueil.
 *
 * Les colonnes sont nommées explicitement dans chaque `select`, jamais `*`.
 * Ce n'est pas une coquetterie : une colonne ajoutée plus tard à la table — un
 * brouillon, une note interne, un identifiant d'auteur — partirait sinon vers
 * tous les téléphones sans que personne ne l'ait décidé. Nommer ce qu'on lit
 * oblige à se poser la question à chaque évolution.
 */

import type { Annonce } from '@/types/models';
import { client, executer } from '@/services/client';

interface LigneAnnonce {
  readonly id: string;
  readonly titre: string;
  readonly corps: string;
  readonly epinglee: boolean;
  readonly publiee_le: string;
}

const COLONNES = 'id, titre, corps, epinglee, publiee_le';

function versAnnonce(ligne: LigneAnnonce): Annonce {
  return {
    id: ligne.id,
    titre: ligne.titre,
    corps: ligne.corps,
    epinglee: ligne.epinglee,
    publieeLe: ligne.publiee_le,
  };
}

/**
 * Les actualités, épinglées d'abord, puis des plus récentes aux plus anciennes.
 *
 * Le tri est fait par la base et non par l'application : `order` s'appuie sur
 * l'index `annonces_fil_idx`, alors qu'un tri côté client devrait d'abord
 * rapatrier toutes les lignes, y compris celles qu'on n'affichera pas.
 */
export async function listerAnnonces(limite = 30): Promise<readonly Annonce[]> {
  const lignes = await executer<readonly LigneAnnonce[]>(
    client()
      .from('annonces')
      .select(COLONNES)
      .order('epinglee', { ascending: false })
      .order('publiee_le', { ascending: false })
      .limit(limite),
  );

  return lignes.map(versAnnonce);
}

/** Une actualité précise, pour l'écran de détail. */
export async function obtenirAnnonce(id: string): Promise<Annonce | null> {
  const lignes = await executer<readonly LigneAnnonce[]>(
    client().from('annonces').select(COLONNES).eq('id', id).limit(1),
  );

  const premiere = lignes[0];
  return premiere === undefined ? null : versAnnonce(premiere);
}
