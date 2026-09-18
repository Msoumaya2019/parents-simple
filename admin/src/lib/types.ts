/**
 * Les types de la base, écrits à la main.
 *
 * POURQUOI À LA MAIN
 * ------------------
 * Supabase sait générer ce fichier (`supabase gen types typescript`), mais la
 * commande demande la ligne de commande Supabase et un jeton d'accès à l'API de
 * gestion — deux choses que ce projet n'a délibérément pas en local. Le fichier
 * est donc écrit ici, et il doit suivre `supabase/migrations/`.
 *
 * Ce n'est pas une copie de confort, mais il faut dire exactement ce qu'elle
 * apporte. Ce qui est refusé à la compilation, c'est une faute de frappe dans
 * un objet d'écriture — écrire `corp` au lieu de `corps` — parce que la forme
 * de l'objet est comparée à ce type. Ce qui ne l'est PAS, et c'est le piège :
 * les chaînes passées à `select` dans `contenu.ts`, que le client Supabase ne
 * compare à rien, et les valeurs d'énumération ci-dessous, que rien ne relie au
 * type de la base. Ces deux-là sont tenues par `scripts/check-admin.mjs`, qui
 * relit les migrations — parce qu'aucun contrôle de type ne le fera jamais.
 *
 * POURQUOI DES `type` ET NON DES `interface`
 * ------------------------------------------
 * Le client Supabase exige que chaque table expose ses lignes comme un
 * `Record<string, unknown>`. Or une `interface` n'obtient PAS de signature
 * d'index implicite en TypeScript, alors qu'un alias de type en obtient une.
 * Écrits en `interface`, ces types ne satisfont donc pas la contrainte, et le
 * message d'erreur ne dit rien d'utile. C'est la seule raison — et elle suffit.
 */

export type CategorieAnnonce = 'actualite' | 'cantine' | 'agenda' | 'a_venir' | 'association';

export type CategorieDocument = 'administratif' | 'scolarite' | 'cantine' | 'activites' | 'autre';

/** Libellés affichés, dans l'ordre où ils apparaissent dans la liste déroulante. */
export const CATEGORIES_ANNONCE: readonly {
  readonly valeur: CategorieAnnonce;
  readonly libelle: string;
}[] = [
  { valeur: 'actualite', libelle: "Actualité de l'école" },
  { valeur: 'cantine', libelle: 'Cantine' },
  { valeur: 'agenda', libelle: 'Agenda' },
  { valeur: 'a_venir', libelle: 'À venir' },
  { valeur: 'association', libelle: "Vie de l'association" },
];

export const CATEGORIES_DOCUMENT: readonly {
  readonly valeur: CategorieDocument;
  readonly libelle: string;
}[] = [
  { valeur: 'administratif', libelle: 'Administratif' },
  { valeur: 'scolarite', libelle: 'Scolarité' },
  { valeur: 'cantine', libelle: 'Cantine' },
  { valeur: 'activites', libelle: 'Activités' },
  { valeur: 'autre', libelle: 'Autre' },
];

// ---------------------------------------------------------------------------
//  Annonces
// ---------------------------------------------------------------------------

export type Annonce = {
  readonly id: string;
  readonly titre: string;
  readonly corps: string;
  readonly epinglee: boolean;
  readonly publiee_le: string;
  readonly categorie: CategorieAnnonce;
  readonly image_url: string | null;
};

export type AnnonceInsert = {
  readonly id?: string;
  readonly titre: string;
  readonly corps: string;
  readonly categorie: CategorieAnnonce;
  readonly epinglee?: boolean;
  readonly image_url?: string | null;
  readonly publiee_le?: string;
};

export type AnnonceUpdate = {
  readonly titre?: string;
  readonly corps?: string;
  readonly categorie?: CategorieAnnonce;
  readonly epinglee?: boolean;
  readonly image_url?: string | null;
  readonly publiee_le?: string;
};

// ---------------------------------------------------------------------------
//  Cantine
// ---------------------------------------------------------------------------

export type MenuCantine = {
  readonly id: string;
  readonly service_date: string;
  readonly entree: string | null;
  readonly plat: string | null;
  readonly dessert: string | null;
  readonly allergenes: readonly string[] | null;
  readonly notes: string | null;
};

export type MenuCantineInsert = {
  readonly id?: string;
  readonly service_date: string;
  readonly entree?: string | null;
  readonly plat?: string | null;
  readonly dessert?: string | null;
  readonly notes?: string | null;
};

export type MenuCantineUpdate = {
  readonly service_date?: string;
  readonly entree?: string | null;
  readonly plat?: string | null;
  readonly dessert?: string | null;
  readonly notes?: string | null;
};

// ---------------------------------------------------------------------------
//  Agenda
// ---------------------------------------------------------------------------

export type EvenementAgenda = {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly debut_le: string;
  readonly fin_le: string | null;
  readonly lieu: string | null;
  readonly journee_entiere: boolean;
};

export type EvenementAgendaInsert = {
  readonly id?: string;
  readonly titre: string;
  readonly description?: string | null;
  readonly debut_le: string;
  readonly fin_le?: string | null;
  readonly lieu?: string | null;
  readonly journee_entiere?: boolean;
};

export type EvenementAgendaUpdate = {
  readonly titre?: string;
  readonly description?: string | null;
  readonly debut_le?: string;
  readonly fin_le?: string | null;
  readonly lieu?: string | null;
  readonly journee_entiere?: boolean;
};

// ---------------------------------------------------------------------------
//  Documents
// ---------------------------------------------------------------------------

export type DocumentPublie = {
  readonly id: string;
  readonly titre: string;
  readonly description: string | null;
  readonly categorie: CategorieDocument;
  readonly storage_path: string;
  readonly taille_octets: number | null;
  readonly publie_le: string;
};

export type DocumentInsert = {
  readonly id?: string;
  readonly titre: string;
  readonly description?: string | null;
  readonly categorie: CategorieDocument;
  readonly storage_path: string;
  readonly taille_octets?: number | null;
  readonly publie_le?: string;
};

export type DocumentUpdate = {
  readonly titre?: string;
  readonly description?: string | null;
  readonly categorie?: CategorieDocument;
  readonly storage_path?: string;
  readonly taille_octets?: number | null;
  readonly publie_le?: string;
};

// ---------------------------------------------------------------------------
//  Description de la base
// ---------------------------------------------------------------------------

/**
 * Seules les tables que cette page lit ou écrit y figurent. Ce n'est pas une
 * omission : une table déclarée ici mais absente de la base produirait une
 * erreur à l'exécution, et une table de la base absente d'ici ne peut pas être
 * atteinte par cette page — ce qui est exactement ce qu'on veut pour
 * `messages`, `sondage_votes` et `membres_bureau`.
 */
export type BaseDonnees = {
  public: {
    Tables: {
      annonces: {
        Row: Annonce;
        Insert: AnnonceInsert;
        Update: AnnonceUpdate;
        Relationships: [];
      };
      cantine_menus: {
        Row: MenuCantine;
        Insert: MenuCantineInsert;
        Update: MenuCantineUpdate;
        Relationships: [];
      };
      agenda_events: {
        Row: EvenementAgenda;
        Insert: EvenementAgendaInsert;
        Update: EvenementAgendaUpdate;
        Relationships: [];
      };
      documents: {
        Row: DocumentPublie;
        Insert: DocumentInsert;
        Update: DocumentUpdate;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      est_membre_bureau: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      annonce_categorie: CategorieAnnonce;
      document_categorie: CategorieDocument;
    };
    CompositeTypes: Record<string, never>;
  };
};
