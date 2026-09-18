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
 * vérité reste dans la base, protégée par la contrainte d'unicité : un appareil
 * ne vote qu'une fois par sondage, et la base ne remplace pas un vote déjà
 * déposé.
 *
 * Quand la base refuse un vote, elle ne dit pas lequel elle détient — la table
 * des votes est fermée en lecture. On apprend une seule chose : cet appareil a
 * voté. `CHOIX_INCONNU` est la trace de ce cas.
 *
 * Les deux mémoires ne peuvent diverger que dans un sens : la mémoire locale
 * perdue alors que la base garde le vote. Une réinstallation ne produit pas ce
 * cas — l'identifiant de votant disparaît en même temps que le reste, et la base
 * accepte le vote suivant. Il faut que le stockage local soit abîmé, ou que son
 * écriture échoue.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const CLE_VOTES = 'freres-lumieres.votes';

/**
 * Trace d'un vote dont le choix n'est pas connu.
 *
 * La chaîne vide, et non `null` : `null` veut dire « rien de connu », et la
 * carte doit pouvoir distinguer les deux — un appareil qui a voté sans que l'on
 * sache quoi ne se comporte pas comme un appareil dont on ne sait rien.
 *
 * Un identifiant de choix est toujours un UUID : cette valeur ne peut pas être
 * confondue avec l'un d'eux.
 */
export const CHOIX_INCONNU = '';

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

/**
 * Ce qu'il faut retenir après la réponse de la base.
 *
 * `enregistre` est le booléen rendu par `voter()` : `true` si la base a
 * enregistré le vote, `false` si elle en détenait déjà un pour cet appareil.
 *
 * Un refus n'est pas une erreur, c'est une information : le choix touché n'est
 * pas celui que la base détient. Le retenir ferait afficher une réponse qui
 * n'existe pas, et le décompte — qui vient de la base — ne compterait pas ce
 * vote. On retient donc `CHOIX_INCONNU`.
 *
 * Le choix touché n'est jamais perdu par accident : quand la base enregistre,
 * c'est lui qui est retenu. La fonction ne rend donc jamais `null` — après une
 * réponse de la base, on sait toujours quelque chose.
 */
export function voteARetenir(choixTouche: string, enregistre: boolean): string {
  return enregistre ? choixTouche : CHOIX_INCONNU;
}

/** Vrai si l'appareil a voté sur ce sondage sans que le choix soit connu. */
export function voteSansChoix(retenu: string | null): boolean {
  return retenu === CHOIX_INCONNU;
}

/**
 * Enregistre le choix retenu pour un sondage.
 *
 * `retenu` peut valoir `CHOIX_INCONNU` : on retient alors qu'un vote existe,
 * sans son contenu.
 */
export async function enregistrerVote(sondageId: string, retenu: string): Promise<void> {
  try {
    const table = await lireTable();
    table[sondageId] = retenu;
    await AsyncStorage.setItem(CLE_VOTES, JSON.stringify(table));
  } catch {
    // Échec sans conséquence : le vote est bien enregistré en base. Seule la
    // mise en évidence du choix disparaît au prochain lancement.
  }
}
