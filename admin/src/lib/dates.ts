/**
 * Conversions entre les dates du formulaire et celles de la base.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * Un champ `<input type="datetime-local">` travaille sur une date *locale*,
 * écrite « 2026-09-18T20:30 », sans indication de fuseau. La base stocke un
 * `timestamptz`, c'est-à-dire un instant absolu. Passer l'un à l'autre sans
 * conversion ferait enregistrer 20 h 30 **UTC** — soit 22 h 30 à Paris — et
 * l'événement apparaîtrait deux heures trop tard dans l'application des
 * parents. L'erreur est silencieuse, et elle ne se voit qu'en comparant une
 * montre à l'écran.
 *
 * `Date` fait la conversion correctement à condition qu'on lui donne les deux
 * formes qu'elle attend : `new Date('2026-09-18T20:30')` est interprété comme
 * une heure locale, et `.toISOString()` produit l'instant absolu correspondant.
 */

/** Vrai si la chaîne a la forme attendue d'une valeur de `datetime-local`. */
const FORME_LOCALE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** Vrai si la chaîne a la forme attendue d'une valeur de `date`. */
const FORME_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Convertit une valeur de `datetime-local` en instant absolu.
 *
 * Rend `null` si la valeur est vide ou n'a pas la forme attendue : l'appelant
 * décide alors si c'est une erreur de saisie ou un champ facultatif laissé
 * vide. Deviner à sa place serait le meilleur moyen d'envoyer `Invalid Date`
 * à la base, qui répondrait par un message incompréhensible.
 */
export function versInstant(valeurLocale: string): string | null {
  const propre = valeurLocale.trim();
  if (propre === '' || !FORME_LOCALE.test(propre)) {
    return null;
  }

  const date = new Date(propre);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

/**
 * Convertit un instant absolu en valeur de `datetime-local`.
 *
 * Utilisée pour préremplir un formulaire de modification. L'instant est ramené
 * dans le fuseau de la machine, ce qui est bien ce qu'on veut : la personne qui
 * corrige un événement le lit dans l'heure à laquelle elle l'a pensé.
 *
 * Les secondes et les millisecondes sont retirées : le champ ne les affiche
 * pas, et les laisser produire un décalage invisible à la réouverture.
 */
export function versLocal(instant: string | null): string {
  if (instant === null) {
    return '';
  }

  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const deux = (nombre: number) => String(nombre).padStart(2, '0');
  return (
    `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}` +
    `T${deux(date.getHours())}:${deux(date.getMinutes())}`
  );
}

/** Vrai si la chaîne est un jour civil exploitable, au format `AAAA-MM-JJ`. */
export function jourValide(valeur: string): boolean {
  const propre = valeur.trim();
  return FORME_JOUR.test(propre) && !Number.isNaN(new Date(`${propre}T12:00:00`).getTime());
}

/**
 * Écrit une date en français, pour les listes.
 *
 * `Intl` est préféré à un assemblage manuel : il place le jour et le mois dans
 * l'ordre attendu, et il suit la langue du navigateur si elle est le français.
 * Le fuseau est fixé à celui de la machine — une date affichée doit l'être dans
 * l'heure de la personne qui la lit.
 */
export function formaterDate(instant: string | null, avecHeure = false): string {
  if (instant === null) {
    return '—';
  }

  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(avecHeure ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

/**
 * Écrit un jour civil — « 2026-09-18 » — sans passage par un fuseau.
 *
 * Une date de menu de cantine n'est pas un instant : c'est un jour du
 * calendrier. La convertir en `Date` puis la réafficher la ferait reculer d'un
 * jour à l'ouest de Greenwich, ce qui est exactement le genre de décalage qu'on
 * ne remarque qu'après avoir affiché le mauvais menu.
 */
export function formaterJour(jour: string | null): string {
  if (jour === null || !jourValide(jour)) {
    return '—';
  }

  const [annee, mois, numero] = jour.split('-');
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(annee), Number(mois) - 1, Number(numero)));
}
