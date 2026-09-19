/**
 * Formatage des dates, en français.
 *
 * POURQUOI PAS `toLocaleDateString('fr-FR')`
 * ------------------------------------------
 * Le résultat dépend du jeu de données de localisation embarqué par le moteur
 * JavaScript de l'appareil. Selon la version d'Android et le constructeur, la
 * locale française est complète, partielle, ou absente — auquel cas la date
 * s'affiche en anglais sans que rien ne le signale. Sur une application dont
 * tous les utilisateurs sont francophones, ce risque n'a aucune contrepartie :
 * les noms de jours et de mois tiennent en trois tableaux écrits à la main.
 *
 * POURQUOI DEUX FONCTIONS DE LECTURE DE DATE
 * ------------------------------------------
 * La base stocke deux natures de dates, et les confondre produit un décalage
 * d'un jour :
 *
 *   - `timestamptz` — un instant. « La réunion commence à 18 h 30. » Il faut le
 *     convertir dans le fuseau du téléphone, donc `new Date(iso)` et ses
 *     accesseurs locaux ;
 *   - `date` — un jour civil, sans heure. « Le menu du 22 septembre. » Le
 *     convertir en instant est une erreur : `new Date('2026-09-22')` est lu
 *     comme minuit UTC, soit 2 h du matin à Paris mais 19 h la veille à
 *     Pointe-à-Pitre. Un parent verrait alors le menu de la veille. On lit donc
 *     les trois nombres et on construit une date locale.
 */

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'] as const;

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'] as const;

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/**
 * Accès aux tableaux ci-dessus, avec un repli sur une chaîne vide.
 *
 * `noUncheckedIndexedAccess` est activé : TypeScript considère qu'un accès par
 * index peut rendre `undefined`, ce qui est exact — `getDay()` rend 0 à 6, mais
 * le compilateur ne peut pas le prouver. Sans ce repli, un `undefined` se
 * glisserait dans une phrase affichée à l'écran, sous la forme du mot
 * « undefined » au milieu d'une date.
 */
function nomJour(index: number): string {
  return JOURS[index] ?? '';
}

function nomJourCourt(index: number): string {
  return JOURS_COURTS[index] ?? '';
}

function nomMois(index: number): string {
  return MOIS[index] ?? '';
}

function deuxChiffres(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Un instant ISO 8601, converti dans le fuseau du téléphone. */
function instant(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Un jour civil `AAAA-MM-JJ`, sans conversion de fuseau. */
function jourCivil(valeur: string): Date | null {
  const morceaux = valeur.split('-');
  if (morceaux.length !== 3) {
    return null;
  }

  const [annee, mois, jour] = morceaux.map(Number);
  if (annee === undefined || mois === undefined || jour === undefined) {
    return null;
  }
  if (Number.isNaN(annee) || Number.isNaN(mois) || Number.isNaN(jour)) {
    return null;
  }

  const date = new Date(annee, mois - 1, jour);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** « lundi 22 septembre 2026 », à partir d'un instant. */
export function dateLongue(iso: string): string {
  const date = instant(iso);
  if (date === null) {
    return '';
  }
  return `${nomJour(date.getDay())} ${date.getDate()} ${nomMois(date.getMonth())} ${date.getFullYear()}`;
}

/** « lundi 22 septembre », à partir d'un jour civil. */
export function jourCivilLong(valeur: string): string {
  const date = jourCivil(valeur);
  if (date === null) {
    return '';
  }
  return `${nomJour(date.getDay())} ${date.getDate()} ${nomMois(date.getMonth())}`;
}

/** « lun. 22 sept. » — pour une liste dense. */
export function jourCivilCourt(valeur: string): string {
  const date = jourCivil(valeur);
  if (date === null) {
    return '';
  }
  const mois = nomMois(date.getMonth());
  return `${nomJourCourt(date.getDay())} ${date.getDate()} ${mois.slice(0, 4)}.`;
}

/** « 22/09/2026 ». */
export function dateNumerique(valeur: string): string {
  const date = instant(valeur) ?? jourCivil(valeur);
  if (date === null) {
    return '';
  }
  return `${deuxChiffres(date.getDate())}/${deuxChiffres(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** « 18 h 30 », ou « 18 h » si les minutes sont nulles. */
export function heure(iso: string): string {
  const date = instant(iso);
  if (date === null) {
    return '';
  }

  const minutes = date.getMinutes();
  return minutes === 0 ? `${date.getHours()} h` : `${date.getHours()} h ${deuxChiffres(minutes)}`;
}

/** « 22 septembre 2026 ». */
export function dateSansJour(iso: string): string {
  const date = instant(iso);
  if (date === null) {
    return '';
  }
  return `${date.getDate()} ${nomMois(date.getMonth())} ${date.getFullYear()}`;
}

/**
 * « il y a 3 jours », « hier », « aujourd'hui ».
 *
 * `maintenant` est injectable pour la même raison que dans `estPasse` : sans
 * cela, le test ne pourrait vérifier que le cas d'aujourd'hui, et les seuils —
 * la bascule vers « hier », puis vers les semaines — resteraient non couverts.
 */
export function depuis(iso: string, maintenant = new Date()): string {
  const date = instant(iso);
  if (date === null) {
    return '';
  }

  const debutAujourdhui = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate(),
  );
  const debutJour = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const jours = Math.round(
    (debutAujourdhui.getTime() - debutJour.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (jours <= 0) {
    return "aujourd'hui";
  }
  if (jours === 1) {
    return 'hier';
  }
  if (jours < 7) {
    return `il y a ${jours} jours`;
  }
  if (jours < 31) {
    const semaines = Math.floor(jours / 7);
    return semaines === 1 ? 'il y a une semaine' : `il y a ${semaines} semaines`;
  }

  return dateSansJour(iso);
}

/**
 * L'instant à partir duquel un événement est terminé.
 *
 * La fin connue quand elle existe. Sinon, pour un événement qui dure toute la
 * journée, la fin de son jour : « toute la journée » veut dire jusqu'à 23 h 59,
 * et prendre le début comme repère ferait passer une sortie scolaire pour
 * terminée dès minuit — donc atténuée, et sans marque, le jour même.
 *
 * Sinon le début : on ne sait rien de plus, et un événement sans fin connue qui
 * a commencé est tenu pour terminé.
 */
function referenceDeFin(
  debutLe: string,
  finLe: string | null,
  journeeEntiere: boolean,
): Date | null {
  const fin = finLe === null ? null : instant(finLe);
  if (fin !== null) {
    return fin;
  }

  const debut = instant(debutLe);
  if (debut === null) {
    return null;
  }
  if (!journeeEntiere) {
    return debut;
  }

  return new Date(debut.getFullYear(), debut.getMonth(), debut.getDate(), 23, 59, 59, 999);
}

/**
 * Vrai si l'événement est terminé.
 *
 * La comparaison porte sur la fin quand elle est connue, et sur le début
 * sinon. Un événement sans heure de fin reste donc « à venir » tant que son
 * début n'est pas passé, ce qui est le comportement attendu.
 *
 * `journeeEntiere` compte : un événement d'une journée entière sans heure de fin
 * dure jusqu'à la fin de son jour, et non jusqu'à son début.
 */
export function estPasse(
  debutLe: string,
  finLe: string | null,
  journeeEntiere: boolean,
  maintenant = new Date(),
): boolean {
  const reference = referenceDeFin(debutLe, finLe, journeeEntiere);
  if (reference === null) {
    return false;
  }
  return reference.getTime() < maintenant.getTime();
}

/**
 * Vrai si l'événement est en cours.
 *
 * Un événement d'une journée entière est « en cours » toute sa journée, même
 * sans heure de fin : c'est ce que la case « toute la journée » affirme.
 */
export function estEnCours(
  debutLe: string,
  finLe: string | null,
  journeeEntiere: boolean,
  maintenant = new Date(),
): boolean {
  const debut = instant(debutLe);
  if (debut === null || debut.getTime() > maintenant.getTime()) {
    return false;
  }

  const fin = referenceDeFin(debutLe, finLe, journeeEntiere);
  return fin !== null && fin.getTime() >= maintenant.getTime();
}

/**
 * Vrai si un sondage est fermé.
 *
 * Un sondage peut être fermé de deux façons : le bureau l'a fermé, ou sa date
 * de clôture est passée. Les deux doivent être testées — l'application ne peut
 * pas se contenter du booléen, sinon un sondage dont la date est dépassée
 * resterait votable à l'écran alors que la base refuserait le vote.
 */
export function sondageFerme(
  ouvert: boolean,
  clotureLe: string | null,
  maintenant = new Date(),
): boolean {
  if (!ouvert) {
    return true;
  }
  if (clotureLe === null) {
    return false;
  }
  const cloture = instant(clotureLe);
  return cloture !== null && cloture.getTime() <= maintenant.getTime();
}

/** « 12,4 Mo », « 340 ko ». */
export function tailleLisible(octets: number | null): string {
  if (octets === null || octets < 0) {
    return '';
  }
  if (octets < 1024) {
    return `${octets} o`;
  }
  if (octets < 1024 * 1024) {
    return `${Math.round(octets / 1024)} ko`;
  }
  return `${(octets / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}

// ---------------------------------------------------------------------------
//  Jours civils
// ---------------------------------------------------------------------------
//  Ces fonctions manipulent des dates locales, sans jamais passer par un
//  instant UTC. Elles vivent ici, et non dans le service de la cantine, parce
//  qu'elles ne dépendent d'aucune requête : elles se testent donc seules,
//  sans base de données ni réseau.

/**
 * Formate une date locale en jour civil `AAAA-MM-JJ`.
 *
 * `toISOString()` est délibérément évité : il convertit en UTC, ce qui décale
 * la date d'un jour pour tout fuseau en avance sur Greenwich — dont la France
 * en heure d'été, où une date locale de minuit devient 22 h la veille.
 */
export function versJourCivil(valeur: Date): string {
  const annee = valeur.getFullYear();
  const mois = String(valeur.getMonth() + 1).padStart(2, '0');
  const jour = String(valeur.getDate()).padStart(2, '0');
  return `${annee}-${mois}-${jour}`;
}

/** Le jour civil d'aujourd'hui, dans le fuseau du téléphone. */
export function jourCourant(maintenant = new Date()): string {
  return versJourCivil(maintenant);
}

/**
 * Le premier instant du jour d'une date, dans le fuseau du téléphone.
 *
 * Sert de BORNE de séparation entre « aujourd'hui et après » et « avant
 * aujourd'hui ». Comparer à l'instant courant, comme le faisait l'agenda,
 * classait dans le passé tout ce qui avait commencé — une sortie scolaire de la
 * journée, dès minuit, et une réunion en cours. La journée est la maille à
 * laquelle un parent pense ; c'est donc elle qui sépare.
 */
export function debutDuJour(valeur: Date = new Date()): Date {
  return new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate());
}

/** Décale une date d'un nombre de jours, sans passer par les millisecondes. */
export function decalerJours(valeur: Date, jours: number): Date {
  const resultat = new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate());
  resultat.setDate(resultat.getDate() + jours);
  return resultat;
}

/**
 * Le lundi de la semaine contenant une date.
 *
 * La semaine scolaire commence le lundi. `getDay()` rend 0 pour dimanche :
 * sans la correction `(jour + 6) % 7`, un dimanche serait rattaché à la semaine
 * suivante, et l'écran afficherait « cette semaine » avec les menus de la
 * semaine qui commence. Le décalage serait visible le week-end, au moment
 * précis où les parents préparent la semaine.
 */
export function lundiDeLaSemaine(valeur: Date): Date {
  const jour = valeur.getDay();
  const recul = (jour + 6) % 7;
  const lundi = new Date(valeur.getFullYear(), valeur.getMonth(), valeur.getDate());
  lundi.setDate(lundi.getDate() - recul);
  return lundi;
}

/**
 * Le lundi de la semaine que l'écran de la cantine doit ouvrir.
 *
 * C'est la semaine du LENDEMAIN, et non celle d'aujourd'hui. La différence ne se
 * voit qu'un jour sur sept — mais c'est le jour qui compte. Le dimanche, la
 * semaine qui se termine n'a plus un seul jour d'école devant elle : elle
 * s'affiche donc entièrement atténuée, et « demain », le lundi qui suit,
 * appartient à la semaine suivante. Le parent qui prépare les affaires du
 * lendemain ouvrait l'application sur une semaine révolue, et devait deviner
 * qu'il fallait appuyer sur la flèche.
 *
 * Prendre la semaine du lendemain rend la promesse vraie PAR CONSTRUCTION : la
 * semaine qui contient demain contient demain, quel que soit le jour. Les six
 * autres jours, le lendemain est déjà dans la semaine, donc rien ne bouge — et
 * c'est pourquoi le décalage ne se voit pas.
 *
 * Écrire la condition « si dimanche » serait une branche morte : le seul jour
 * dont le lendemain change de semaine est le dimanche, si bien que les deux
 * écritures sont équivalentes. Celle-ci dit la règle au lieu de nommer son cas
 * particulier.
 *
 * Cette règle vit ici, et non dans l'écran, pour la même raison que les autres
 * fonctions de ce fichier : `app/(tabs)/cantine.tsx` importe React Native, donc
 * aucun banc d'essai ne peut le charger.
 */
export function semaineDeCantine(valeur: Date = new Date()): Date {
  return lundiDeLaSemaine(decalerJours(valeur, 1));
}
