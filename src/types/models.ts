/**
 * Types du domaine.
 *
 * Ils reproduisent le schéma SQL de `supabase/migrations/`. Une colonne
 * renommée d'un côté et pas de l'autre ne produit aucune erreur à la
 * compilation : elle produit un `undefined` à l'affichage, sur le téléphone
 * d'un parent. Les deux fichiers se modifient donc ensemble.
 */

export type MessageCategorie = 'cantine' | 'transport' | 'vie_scolaire' | 'activites' | 'autre';

export type DocumentCategorie = 'administratif' | 'scolarite' | 'cantine' | 'activites' | 'autre';

/** Une actualité du fil d'accueil. */
export interface Annonce {
  readonly id: string;
  readonly titre: string;
  readonly corps: string;
  /** Une annonce épinglée reste en tête du fil, quel que soit son âge. */
  readonly epinglee: boolean;
  readonly publieeLe: string;
}

/** Le menu d'un jour de service. */
export interface MenuCantine {
  readonly id: string;
  /** Jour civil au format `AAAA-MM-JJ`, sans fuseau horaire. */
  readonly serviceDate: string;
  readonly entree: string | null;
  readonly plat: string | null;
  readonly dessert: string | null;
  readonly allergenes: readonly string[];
  readonly notes: string | null;
}

/** Un événement de l'agenda scolaire. */
export interface EvenementAgenda {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  /** Instant ISO 8601. */
  readonly debutLe: string;
  readonly finLe: string | null;
  readonly lieu: string | null;
  readonly journeeEntiere: boolean;
}

/** Les métadonnées d'un document. Le fichier lui-même est dans Storage. */
export interface DocumentUtile {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly categorie: DocumentCategorie;
  readonly storagePath: string;
  readonly tailleOctets: number | null;
  readonly publieLe: string;
}

/** Un sondage et l'état du vote de cet appareil. */
export interface Sondage {
  readonly id: string;
  readonly question: string;
  readonly precisions: string | null;
  readonly ouvert: boolean;
  readonly clotureLe: string | null;
  readonly choix: readonly ChoixSondage[];
}

/** Une réponse possible à un sondage, avec son décompte. */
export interface ChoixSondage {
  readonly id: string;
  readonly libelle: string;
  readonly votes: number;
}

/** Un message déposé pour le bureau, tel qu'il est envoyé. */
export interface NouveauMessage {
  readonly sujet: string;
  readonly corps: string;
  readonly categorie: MessageCategorie;
  /** Facultatif : exiger une adresse ferait renoncer une partie des parents. */
  readonly reponseA: string | null;
}
