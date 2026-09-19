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

export type CategorieMessage = 'cantine' | 'transport' | 'vie_scolaire' | 'activites' | 'autre';

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

/**
 * Les catégories de message, telles que le parent les voit dans l'application.
 *
 * CES LIBELLÉS SONT ÉCRITS DEUX FOIS, ET IL FAUT LE DIRE
 * -----------------------------------------------------
 * `src/services/messages.ts` porte les mêmes, pour le formulaire de contact du
 * téléphone. `admin/` est une application séparée : elle ne peut pas importer
 * depuis `src/`, et cette séparation est voulue — c'est elle qui permet de
 * déployer la page seule, sans le dépôt à côté.
 *
 * Rien, dans la langue, ne relie les deux listes. Un libellé corrigé d'un côté
 * et pas de l'autre ne casse rien : le parent choisit « Vie scolaire », le
 * bureau lit « Vie scolaire » — écrit autrement. C'est le défaut le plus
 * discret de la famille, parce que les deux écrans restent cohérents avec
 * eux-mêmes. `tests/accord-categories-message.test.ts` les confronte.
 *
 * L'ORDRE, LUI, PEUT DIFFÉRER SANS QUE RIEN NE SOIT FAUX : celui-ci range les
 * catégories par ordre alphabétique de libellé, ce qui convient à une liste
 * qu'on parcourt des yeux pour trier. Le formulaire du parent suit un autre
 * ordre, choisi pour la saisie. Le banc ne compare donc que les COUPLES
 * (valeur, libellé) — jamais les positions, qui relèvent de l'usage et non de
 * l'accord.
 */
export const CATEGORIES_MESSAGE: readonly {
  readonly valeur: CategorieMessage;
  readonly libelle: string;
}[] = [
  { valeur: 'activites', libelle: 'Activités et sorties' },
  { valeur: 'autre', libelle: 'Autre' },
  { valeur: 'cantine', libelle: 'Cantine' },
  { valeur: 'transport', libelle: 'Transport' },
  { valeur: 'vie_scolaire', libelle: 'Vie scolaire' },
];

/**
 * Le libellé affiché d'une catégorie de message.
 *
 * La fonction est DÉRIVÉE de `CATEGORIES_MESSAGE`, jamais écrite une seconde
 * fois : un `Record<CategorieMessage, string>` tenu à part serait exactement le
 * doublon que la règle 5 de `scripts/check-admin.mjs` attrape entre le type et
 * la liste, mais que rien n'attraperait ici.
 *
 * Le repli rend la valeur brute si la liste ne la connaît pas. TypeScript
 * interdit ce cas, donc il est inatteignable aujourd'hui — mais un jour où la
 * base porterait une valeur d'énumération que cette liste ignore, afficher
 * `vie_scolaire` vaut mieux que n'afficher rien : le bureau voit au moins de
 * quoi il s'agit, et le contrôle signale l'écart de son côté.
 */
export function libelleCategorieMessage(categorie: CategorieMessage): string {
  return CATEGORIES_MESSAGE.find((entree) => entree.valeur === categorie)?.libelle ?? categorie;
}

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
//  Messages des parents
// ---------------------------------------------------------------------------
//
//  CE QUE CETTE PAGE NE LIT PAS, ET POURQUOI
//  -----------------------------------------
//  La table porte aussi `appareil_id`, l'identifiant d'appareil du parent. Il
//  n'est PAS retenu ici, et ce n'est pas un oubli : ce serait exposer aux
//  membres du bureau un identifiant stable d'un parent, alors que rien dans
//  leur travail ne le demande. La cadence d'envoi — trois messages par quart
//  d'heure — est tenue par `envoyer_message()`, dans la base, précisément pour
//  qu'aucun écran n'ait à compter les messages d'un appareil.
//
//  Une colonne absente de `COLONNES_MESSAGE` n'est pas seulement non affichée :
//  elle n'est pas DEMANDÉE, donc elle ne quitte pas la base. La restriction est
//  aussi réelle que la politique de lecture qui l'autorise.

export type MessageParent = {
  readonly id: string;
  readonly sujet: string;
  readonly corps: string;
  readonly categorie: CategorieMessage;
  readonly reponse_a: string | null;
  readonly traite: boolean;
  readonly created_at: string;
};

/**
 * Ce que le bureau peut modifier : la seule case « traité ».
 *
 * Le type est réduit à un champ, et non repris de la ligne entière. C'est ce
 * qui empêche d'écrire par accident le sujet ou le corps d'un message de
 * parent — un geste qui réécrirait les mots de quelqu'un d'autre, sans trace
 * et sans qu'il le sache. La politique de la base l'autorise pourtant : elle
 * accorde `update` sur la table, sans distinguer les colonnes. La restriction
 * qui compte est donc ici, et elle est de nature différente — c'est le
 * compilateur qui la tient.
 */
export type MessageParentUpdate = {
  readonly traite: boolean;
};

// ---------------------------------------------------------------------------
//  Description de la base
// ---------------------------------------------------------------------------

/**
 * Seules les tables que cette page lit ou écrit y figurent. Ce n'est pas une
 * omission : une table déclarée ici mais absente de la base produirait une
 * erreur à l'exécution, et une table de la base absente d'ici ne peut pas être
 * atteinte par cette page — ce qui est exactement ce qu'on veut pour
 * `sondage_votes` et `membres_bureau`.
 *
 * `messages` Y FIGURE DEPUIS LE 2026-09-19, ET C'EST UN CHOIX
 * ----------------------------------------------------------
 * La table en était absente, et le rester était cohérent : sa lecture était
 * réservée au tableau de bord Supabase, donc à un compte ayant accès au
 * PROJET — lequel peut aussi modifier le schéma, lire toutes les autres tables
 * et changer les politiques. Lire un message de parent coûtait donc bien plus
 * que le strict nécessaire.
 *
 * `supabase/migrations/20260919140000_messages_bureau.sql` a ouvert une voie
 * étroite : le bureau lit avec son compte du bureau, et la clé publique ne lit
 * toujours rien. Ce type, et `COLONNES_MESSAGE`, sont la moitié visible de ce
 * changement ; l'autre moitié est la migration, qui doit être appliquée à la
 * main. Tant qu'elle ne l'est pas, cet écran échoue — et l'échec est visible,
 * ce qui est la seule façon acceptable d'échouer.
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
      messages: {
        Row: MessageParent;
        Insert: never;
        Update: MessageParentUpdate;
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
      message_categorie: CategorieMessage;
    };
    CompositeTypes: Record<string, never>;
  };
};
