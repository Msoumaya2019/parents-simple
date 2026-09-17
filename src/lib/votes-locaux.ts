/**
 * Mémoire locale des votes.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * La table des votes est fermée à la clé publique : l'application ne peut pas
 * demander « qu'ai-je voté ? ». C'est le prix de la confidentialité — les
 * identifiants d'installation ne sortent jamais de la base.
 *
 * Sans mémoire locale, un parent qui revient sur un sondage verrait tous les
 * choix au même niveau, sans savoir lequel il a retenu, et pourrait voter de
 * nouveau en croyant que son vote n'a pas été pris en compte. La base
 * refuserait ce second vote, mais l'écran ne le signalerait pas.
 *
 * Le choix est donc conservé sur l'appareil, sous forme de correspondance
 * « identifiant de sondage → identifiant de choix ». Ce n'est pas une donnée
 * personnelle : c'est le reflet d'un vote déjà pseudonyme, stocké au même
 * endroit et effacé en même temps que l'application.
 *
 * CE FICHIER NE FAIT PAS AUTORITÉ
 * -------------------------------
 * La valeur enregistrée ici est un confort d'affichage, pas une preuve. La
 * vérité reste dans la base, protégée par la contrainte d'unicité. Si les deux
 * divergent — après une réinstallation, par exemple — c'est la base qui a
 * raison, et le vote sera simplement refusé sans erreur.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE_VOTES = 'freres-lumieres.votes';

type TableVotes = Record<string, string>;

async function lireTable(): Promise<TableVotes> {
  try {
    const brut = await AsyncStorage.getItem(CLE_VOTES);
    if (brut === null) {
      return {};
    }

    const analyse: unknown = JSON.parse(brut);
    if (analyse === null || typeof analyse !== 'object' || Array.isArray(analyse)) {
      return {};
    }

    // On ne fait pas confiance à la forme du contenu stocké : il a pu être
    // écrit par une version antérieure de l'application, ou abîmé. On ne garde
    // que les paires dont les deux membres sont des chaînes.
    const propre: TableVotes = {};
    for (const [cle, valeur] of Object.entries(analyse)) {
      if (typeof valeur === 'string') {
        propre[cle] = valeur;
      }
    }
    return propre;
  } catch {
    return {};
  }
}

/** Le choix retenu pour chaque sondage, sur cet appareil. */
export async function lireVotesLocaux(): Promise<TableVotes> {
  return lireTable();
}

/** Enregistre le choix retenu pour un sondage. */
export async function enregistrerVote(sondageId: string, choixId: string): Promise<void> {
  try {
    const table = await lireTable();
    table[sondageId] = choixId;
    await AsyncStorage.setItem(CLE_VOTES, JSON.stringify(table));
  } catch {
    // Échec sans conséquence : le vote est bien enregistré en base. Seule la
    // mise en évidence du choix disparaît au prochain lancement.
  }
}
