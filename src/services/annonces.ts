/**
 * Actualités du fil d'accueil.
 *
 * Les colonnes sont nommées explicitement dans chaque `select`, jamais `*`.
 * Ce n'est pas une coquetterie : une colonne ajoutée plus tard à la table — un
 * brouillon, une note interne, un identifiant d'auteur — partirait sinon vers
 * tous les téléphones sans que personne ne l'ait décidé. Nommer ce qu'on lit
 * oblige à se poser la question à chaque évolution.
 */

import type { Ionicons } from '@expo/vector-icons';

import type { Annonce, AnnonceCategorie } from '@/types/models';
import type { TonPastel } from '@/theme';
import { client, executer } from '@/services/client';

interface LigneAnnonce {
  readonly id: string;
  readonly titre: string;
  readonly corps: string;
  readonly epinglee: boolean;
  readonly publiee_le: string;
  readonly categorie: AnnonceCategorie;
  readonly image_url: string | null;
}

const COLONNES = 'id, titre, corps, epinglee, publiee_le, categorie, image_url';

function versAnnonce(ligne: LigneAnnonce): Annonce {
  return {
    id: ligne.id,
    titre: ligne.titre,
    corps: ligne.corps,
    epinglee: ligne.epinglee,
    publieeLe: ligne.publiee_le,
    categorie: ligne.categorie,
    imageUrl: ligne.image_url,
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

/** Le nom du compartiment des images d'actualité, à un seul endroit. */
const COMPARTIMENT_IMAGES = 'annonces';

/**
 * L'adresse d'une image d'actualité.
 *
 * La colonne accepte deux formes, et c'est délibéré : une adresse complète, pour
 * une image déjà en ligne que le bureau peut coller depuis le tableau de bord,
 * ou un chemin dans le compartiment `annonces`, pour une image téléversée.
 *
 * L'ordre des deux tests compte. On commence par reconnaître une adresse
 * complète, et tout le reste est traité comme un chemin. L'ordre inverse — le
 * chemin d'abord — transformerait `https://exemple.fr/photo.jpg` en une adresse
 * de stockage pointant vers un fichier littéralement nommé « https:… », et
 * l'image serait introuvable sans que rien n'explique pourquoi.
 */
export function adresseImage(valeur: string): string {
  if (/^https?:\/\//i.test(valeur)) {
    return valeur;
  }

  const { data } = client().storage.from(COMPARTIMENT_IMAGES).getPublicUrl(valeur);
  return data.publicUrl;
}

/**
 * Ce que chaque catégorie affiche : son libellé, son ton et son icône.
 *
 * Les trois sont réunis dans la même table, et non dispersés dans les écrans.
 * Séparés, ils divergent : on renomme une catégorie dans un écran et pas dans
 * l'autre, et la même actualité finit par porter deux pastilles différentes
 * selon l'endroit où on la lit.
 *
 * Le `ton` est un nom de la palette du thème, pas une couleur. C'est ce qui
 * permet au mode sombre d'exister sans que ce fichier en sache rien.
 */
export const CATEGORIES_ANNONCE: Readonly<
  Record<
    AnnonceCategorie,
    {
      readonly libelle: string;
      readonly ton: TonPastel;
      readonly icone: keyof typeof Ionicons.glyphMap;
    }
  >
> = Object.freeze({
  actualite: { libelle: 'Actualité', ton: 'bleu', icone: 'information-circle' },
  cantine: { libelle: 'Cantine', ton: 'menthe', icone: 'restaurant' },
  agenda: { libelle: 'Agenda', ton: 'violet', icone: 'calendar' },
  a_venir: { libelle: 'À venir', ton: 'orange', icone: 'time' },
  association: { libelle: 'Association', ton: 'corail', icone: 'people' },
});
