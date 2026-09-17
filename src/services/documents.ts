/**
 * Documents utiles.
 *
 * La table ne contient que des métadonnées ; le fichier vit dans le compartiment
 * de stockage. Deux appels distincts, donc, et une précaution : l'adresse
 * publique est calculée localement, sans requête réseau. `getPublicUrl` ne
 * vérifie pas que le fichier existe — un document dont le fichier a été retiré
 * du stockage produirait un lien qui ne mène nulle part. C'est pourquoi
 * l'ouverture est tentée, et l'échec expliqué à l'écran, plutôt que de faire
 * croire à un téléchargement en cours.
 */

import type { DocumentCategorie, DocumentUtile } from '@/types/models';
import { client, executer } from '@/services/client';

interface LigneDocument {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly categorie: DocumentCategorie;
  readonly storage_path: string;
  readonly taille_octets: number | null;
  readonly publie_le: string;
}

const COLONNES = 'id, titre, description, categorie, storage_path, taille_octets, publie_le';

/** Le nom du compartiment, à un seul endroit. */
const COMPARTIMENT = 'documents';

function versDocument(ligne: LigneDocument): DocumentUtile {
  return {
    id: ligne.id,
    titre: ligne.titre,
    description: ligne.description,
    categorie: ligne.categorie,
    storagePath: ligne.storage_path,
    tailleOctets: ligne.taille_octets,
    publieLe: ligne.publie_le,
  };
}

export async function listerDocuments(limite = 100): Promise<readonly DocumentUtile[]> {
  const lignes = await executer<readonly LigneDocument[]>(
    client()
      .from('documents')
      .select(COLONNES)
      .order('publie_le', { ascending: false })
      .limit(limite),
  );

  return lignes.map(versDocument);
}

/**
 * L'adresse de téléchargement d'un document.
 *
 * Le compartiment est public en lecture : l'adresse ne contient aucun secret,
 * et peut être partagée telle quelle. Un compartiment privé exigerait une
 * signature par fichier, et donc un serveur pour la délivrer — ce que cette
 * application n'a pas.
 */
export function adresseDocument(chemin: string): string {
  const { data } = client().storage.from(COMPARTIMENT).getPublicUrl(chemin);
  return data.publicUrl;
}

/** Libellé lisible d'une catégorie de document. */
export function libelleCategorieDocument(categorie: DocumentCategorie): string {
  const libelles: Record<DocumentCategorie, string> = {
    administratif: 'Administratif',
    scolarite: 'Scolarité',
    cantine: 'Cantine',
    activites: 'Activités',
    autre: 'Autre',
  };
  return libelles[categorie];
}
