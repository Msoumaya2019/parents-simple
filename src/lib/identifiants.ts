/**
 * Identifiants d'installation.
 *
 * L'application n'a pas de compte : rien ne distingue un parent d'un autre.
 * Deux fonctionnalités ont pourtant besoin d'une mémoire minimale :
 *
 *   - les sondages, pour qu'un même appareil ne vote pas indéfiniment ;
 *   - le formulaire de contact, pour qu'il ne puisse pas être inondé.
 *
 * DEUX IDENTIFIANTS, ET NON UN SEUL
 * ---------------------------------
 * Il serait tentant d'en générer un et de s'en servir partout. Ce serait une
 * erreur : le même identifiant sur les votes et sur les messages permettrait de
 * relier un message signé « je suis la maman de Léa en CP » au vote déposé sur
 * le sondage du même appareil. Deux informations anodines séparément, mais dont
 * le croisement reconstitue une opinion attribuable à une famille.
 *
 * Les deux valeurs sont donc indépendantes, et ne sont jamais envoyées
 * ensemble. C'est le principe de minimisation appliqué au seul endroit où cette
 * application stocke quoi que ce soit.
 *
 * CE QUE CES VALEURS NE SONT PAS
 * ------------------------------
 * Elles ne sont dérivées d'aucun élément du matériel ni du système. Ce sont des
 * UUID tirés au hasard, à la première ouverture, et conservés sur l'appareil.
 * Deux installations produisent deux valeurs sans aucun lien. Ce sont des
 * données pseudonymes au sens du RGPD, ce que la politique de confidentialité
 * indique explicitement.
 *
 * Désinstaller l'application efface les deux valeurs. Un parent qui réinstalle
 * peut donc voter une seconde fois : c'est une limite connue, décrite dans la
 * politique de confidentialité, et le prix d'une application sans compte.
 *
 * Ces deux phrases ont d'abord été fausses. La politique ne nommait ni la
 * pseudonymie ni la réinstallation : cet en-tête attribuait à un document deux
 * garanties qu'il ne portait pas. Les mentions ont été ajoutées à la page, et
 * `tests/politique-de-confidentialite.test.ts` tient l'accord dans les deux
 * sens — si l'une disparaît de la page ou d'ici, le banc échoue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

const CLE_VOTANT = 'freres-lumieres.votant';
const CLE_APPAREIL = 'freres-lumieres.appareil';

const FORME_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Vérifie qu'une valeur lue sur l'appareil est bien un UUID.
 *
 * Une valeur corrompue — stockage partiellement effacé, restauration depuis une
 * sauvegarde d'un autre téléphone — serait sinon envoyée telle quelle, et
 * PostgreSQL refuserait l'écriture avec un message incompréhensible. On préfère
 * en générer une nouvelle.
 */
function estUuid(valeur: string): boolean {
  return FORME_UUID.test(valeur);
}

async function lireOuCreer(cle: string): Promise<string> {
  try {
    const existant = await AsyncStorage.getItem(cle);
    if (existant !== null && estUuid(existant)) {
      return existant;
    }

    const nouveau = Crypto.randomUUID();
    await AsyncStorage.setItem(cle, nouveau);
    return nouveau;
  } catch {
    // Le stockage local peut échouer — espace plein, appareil verrouillé. On
    // rend alors un identifiant éphémère : la fonctionnalité reste utilisable
    // pour cette session, simplement sans mémoire d'une fois sur l'autre. Faire
    // échouer l'envoi d'un message pour cette raison serait disproportionné.
    return Crypto.randomUUID();
  }
}

let votantEnCache: string | null = null;
let appareilEnCache: string | null = null;

/** Identifiant utilisé pour les votes aux sondages. */
export async function identifiantVotant(): Promise<string> {
  if (votantEnCache !== null) {
    return votantEnCache;
  }
  votantEnCache = await lireOuCreer(CLE_VOTANT);
  return votantEnCache;
}

/** Identifiant utilisé pour la cadence des messages. Distinct du précédent. */
export async function identifiantAppareil(): Promise<string> {
  if (appareilEnCache !== null) {
    return appareilEnCache;
  }
  appareilEnCache = await lireOuCreer(CLE_APPAREIL);
  return appareilEnCache;
}
