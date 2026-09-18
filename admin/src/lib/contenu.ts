import type { Client } from './client';
import type {
  Annonce,
  AnnonceInsert,
  AnnonceUpdate,
  CategorieDocument,
  DocumentPublie,
  EvenementAgenda,
  EvenementAgendaInsert,
  EvenementAgendaUpdate,
  MenuCantine,
  MenuCantineUpdate,
} from './types';

/**
 * Tout ce que la page demande à la base.
 *
 * POURQUOI TOUT EST ICI
 * ---------------------
 * L'application mobile range ses requêtes dans un fichier par domaine, parce
 * que chacune porte une logique propre — résolution d'adresse d'image, décompte
 * de votes, cadence d'envoi. Ici, les quatre domaines font exactement la même
 * chose : lister, écrire, supprimer. Les séparer en quatre fichiers identiques
 * coûterait de la navigation sans rien clarifier.
 *
 * La règle du projet est tenue : chaque `select` NOMME ses colonnes. Un `*`
 * ramènerait un jour une colonne que la page ne connaît pas, et le problème
 * apparaîtrait au moment du déploiement, pas à la lecture.
 *
 * Ces listes sont EXPORTÉES, et ce n'est pas un hasard. Rien, dans la langue,
 * ne les relie aux colonnes réelles : le client Supabase déduit le type de la
 * ligne de la TABLE, jamais de la chaîne passée à `select`. Une colonne mal
 * orthographiée ici est donc invisible à `tsc`, et ne se manifeste qu'à
 * l'exécution — devant le bureau, au moment où il croit avoir publié.
 * `scripts/check-admin.mjs` les relit donc comme des valeurs et les confronte
 * aux migrations, ce qu'aucun contrôle de type ne fera.
 *
 * LES ERREURS SONT LEVÉES, PAS RENDUES
 * ------------------------------------
 * Chaque fonction rend la donnée ou lève une erreur portant un message en
 * français. Les écrans les attrapent et les affichent. L'alternative — rendre
 * un couple `{ donnee, erreur }` — obligerait chaque appelant à tester, et
 * c'est précisément le test qu'on oublie d'écrire.
 */

function echec(contexte: string, message: string): never {
  throw new Error(`${contexte} : ${message}`);
}

// ---------------------------------------------------------------------------
//  Annonces
// ---------------------------------------------------------------------------

export const COLONNES_ANNONCE = 'id, titre, corps, epinglee, publiee_le, categorie, image_url';

export async function listerAnnonces(client: Client): Promise<Annonce[]> {
  const { data, error } = await client
    .from('annonces')
    .select(COLONNES_ANNONCE)
    .order('epinglee', { ascending: false })
    .order('publiee_le', { ascending: false });

  if (error !== null) {
    echec('Les annonces n’ont pas pu être lues', error.message);
  }

  return data;
}

export async function creerAnnonce(client: Client, valeurs: AnnonceInsert): Promise<string> {
  const { data, error } = await client.from('annonces').insert(valeurs).select('id').single();

  if (error !== null) {
    echec('L’annonce n’a pas pu être publiée', error.message);
  }

  return data.id;
}

export async function modifierAnnonce(
  client: Client,
  id: string,
  valeurs: AnnonceUpdate,
): Promise<void> {
  const { error } = await client.from('annonces').update(valeurs).eq('id', id);

  if (error !== null) {
    echec('L’annonce n’a pas pu être modifiée', error.message);
  }
}

export async function supprimerAnnonce(client: Client, id: string): Promise<void> {
  const { error } = await client.from('annonces').delete().eq('id', id);

  if (error !== null) {
    echec('L’annonce n’a pas pu être supprimée', error.message);
  }
}

// ---------------------------------------------------------------------------
//  Cantine
// ---------------------------------------------------------------------------

export const COLONNES_MENU = 'id, service_date, entree, plat, dessert, allergenes, notes';

export async function listerMenus(client: Client): Promise<MenuCantine[]> {
  const { data, error } = await client
    .from('cantine_menus')
    .select(COLONNES_MENU)
    .order('service_date', { ascending: false });

  if (error !== null) {
    echec('Les menus n’ont pas pu être lus', error.message);
  }

  return data;
}

/**
 * Enregistre le menu d'un jour, qu'il existe déjà ou non.
 *
 * `service_date` porte une contrainte d'unicité. Une insertion naïve échouerait
 * donc sur un jour déjà saisi, avec un message de Postgres parlant de contrainte
 * violée — alors que l'intention du bureau était évidemment de corriger le menu
 * de ce jour. `upsert` sur `service_date` fait ce qu'il faut : corriger plutôt
 * que refuser.
 */
export async function enregistrerMenu(
  client: Client,
  valeurs: MenuCantineUpdate & { readonly service_date: string },
): Promise<void> {
  const { error } = await client
    .from('cantine_menus')
    .upsert(valeurs, { onConflict: 'service_date' });

  if (error !== null) {
    echec('Le menu n’a pas pu être enregistré', error.message);
  }
}

export async function supprimerMenu(client: Client, id: string): Promise<void> {
  const { error } = await client.from('cantine_menus').delete().eq('id', id);

  if (error !== null) {
    echec('Le menu n’a pas pu être supprimé', error.message);
  }
}

// ---------------------------------------------------------------------------
//  Agenda
// ---------------------------------------------------------------------------

export const COLONNES_EVENEMENT = 'id, titre, description, debut_le, fin_le, lieu, journee_entiere';

export async function listerEvenements(client: Client): Promise<EvenementAgenda[]> {
  const { data, error } = await client
    .from('agenda_events')
    .select(COLONNES_EVENEMENT)
    .order('debut_le', { ascending: true });

  if (error !== null) {
    echec('L’agenda n’a pas pu être lu', error.message);
  }

  return data;
}

export async function creerEvenement(
  client: Client,
  valeurs: EvenementAgendaInsert,
): Promise<string> {
  const { data, error } = await client.from('agenda_events').insert(valeurs).select('id').single();

  if (error !== null) {
    echec('L’événement n’a pas pu être ajouté', error.message);
  }

  return data.id;
}

export async function modifierEvenement(
  client: Client,
  id: string,
  valeurs: EvenementAgendaUpdate,
): Promise<void> {
  const { error } = await client.from('agenda_events').update(valeurs).eq('id', id);

  if (error !== null) {
    echec('L’événement n’a pas pu être modifié', error.message);
  }
}

export async function supprimerEvenement(client: Client, id: string): Promise<void> {
  const { error } = await client.from('agenda_events').delete().eq('id', id);

  if (error !== null) {
    echec('L’événement n’a pas pu être supprimé', error.message);
  }
}

// ---------------------------------------------------------------------------
//  Documents
// ---------------------------------------------------------------------------

export const COLONNES_DOCUMENT =
  'id, titre, description, categorie, storage_path, taille_octets, publie_le';

export async function listerDocuments(client: Client): Promise<DocumentPublie[]> {
  const { data, error } = await client
    .from('documents')
    .select(COLONNES_DOCUMENT)
    .order('publie_le', { ascending: false });

  if (error !== null) {
    echec('Les documents n’ont pas pu être lus', error.message);
  }

  return data;
}

export async function creerDocument(
  client: Client,
  valeurs: {
    readonly titre: string;
    readonly description: string | null;
    readonly categorie: CategorieDocument;
    readonly storage_path: string;
    readonly taille_octets: number | null;
  },
): Promise<string> {
  const { data, error } = await client.from('documents').insert(valeurs).select('id').single();

  if (error !== null) {
    echec('Le document n’a pas pu être publié', error.message);
  }

  return data.id;
}

export async function supprimerDocument(client: Client, id: string): Promise<void> {
  const { error } = await client.from('documents').delete().eq('id', id);

  if (error !== null) {
    echec('Le document n’a pas pu être supprimé', error.message);
  }
}

// ---------------------------------------------------------------------------
//  Fichiers
// ---------------------------------------------------------------------------

/**
 * Réduit un nom de fichier à ce qui passe partout.
 *
 * Les accents sont décomposés puis retirés plutôt que remplacés au hasard :
 * « Règlement intérieur.pdf » devient `reglement-interieur.pdf`, ce qui reste
 * lisible dans le tableau de bord et dans une adresse. Un nom laissé tel quel
 * produirait une adresse encodée en pourcentages, illisible au possible.
 */
export function nomSur(nomOriginal: string): string {
  const point = nomOriginal.lastIndexOf('.');
  const base = point > 0 ? nomOriginal.slice(0, point) : nomOriginal;
  const extension = point > 0 ? nomOriginal.slice(point + 1) : '';

  const nettoyer = (texte: string) =>
    texte
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const basePropre = nettoyer(base).slice(0, 80) || 'fichier';
  const extensionPropre = nettoyer(extension).slice(0, 12);

  return extensionPropre === '' ? basePropre : `${basePropre}.${extensionPropre}`;
}

/**
 * Préfixe un nom de fichier de quoi le rendre unique.
 *
 * Deux fichiers portant le même nom écraseraient le premier, et l'annonce
 * publiée la semaine dernière se retrouverait avec l'image d'aujourd'hui. Le
 * préfixe évite cela sans rien demander à personne. Il n'utilise pas
 * `crypto.randomUUID`, qui n'existe pas hors d'un contexte sécurisé : la page
 * doit rester utilisable en développement sur une adresse locale en `http`.
 */
function nomUnique(nomOriginal: string): string {
  const aleatoire = Math.random().toString(36).slice(2, 8);
  return `${Date.now()}-${aleatoire}-${nomSur(nomOriginal)}`;
}

/** L'extension du fichier, en minuscules, sans le point. */
function extensionDe(nom: string): string {
  const point = nom.lastIndexOf('.');
  return point > 0 ? nom.slice(point + 1).toLowerCase() : '';
}

/**
 * Types acceptés par le compartiment `documents`.
 *
 * La liste est celle de la migration. Elle est répétée ici pour donner une
 * phrase compréhensible avant l'envoi : la base refuserait de toute façon, mais
 * son message parle de type MIME, ce qui n'aide personne à choisir un fichier.
 */
const EXTENSIONS_DOCUMENT = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

/** Types acceptés par le compartiment `annonces`. Pas de PDF : c'est une image d'illustration. */
const EXTENSIONS_IMAGE = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

export async function televerserImage(client: Client, fichier: File): Promise<string> {
  if (!EXTENSIONS_IMAGE.has(extensionDe(fichier.name))) {
    throw new Error(
      `« ${fichier.name} » n’est pas une image acceptée. Formats possibles : ` +
        `${[...EXTENSIONS_IMAGE].join(', ')}.`,
    );
  }

  const chemin = nomUnique(fichier.name);
  const { error } = await client.storage.from('annonces').upload(chemin, fichier, {
    cacheControl: '31536000',
    upsert: false,
  });

  if (error !== null) {
    echec('L’image n’a pas pu être envoyée', error.message);
  }

  return chemin;
}

export async function televerserDocument(
  client: Client,
  fichier: File,
  dossier: string,
): Promise<string> {
  if (!EXTENSIONS_DOCUMENT.has(extensionDe(fichier.name))) {
    throw new Error(
      `« ${fichier.name} » n’est pas un format accepté. Formats possibles : ` +
        `${[...EXTENSIONS_DOCUMENT].join(', ')}.`,
    );
  }

  const dossierPropre = nomSur(dossier);
  const chemin =
    dossierPropre === '' ? nomUnique(fichier.name) : `${dossierPropre}/${nomUnique(fichier.name)}`;

  const { error } = await client.storage.from('documents').upload(chemin, fichier, {
    cacheControl: '31536000',
    upsert: false,
  });

  if (error !== null) {
    echec('Le document n’a pas pu être envoyé', error.message);
  }

  return chemin;
}

/**
 * L'année scolaire en cours, pour ranger les documents.
 *
 * Une rentrée a lieu en septembre : avant, on est encore dans l'année qui a
 * commencé l'an dernier. C'est une convention de rangement, pas une règle de
 * gestion — le champ reste modifiable dans le formulaire.
 */
export function anneeScolaire(maintenant = new Date()): string {
  const annee = maintenant.getFullYear();
  return maintenant.getMonth() >= 8 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}
