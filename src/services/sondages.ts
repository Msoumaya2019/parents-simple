/**
 * Sondages.
 *
 * Les résultats passent par la fonction `sondage_resultats()` et non par une
 * lecture de la table des votes. Ce n'est pas un détail d'implémentation : la
 * table des votes est fermée à la clé publique, précisément pour que
 * l'identifiant d'installation de chaque votant ne sorte jamais de la base. La
 * fonction ne renvoie que des compteurs.
 *
 * Un seul appel pour tous les sondages affichés, et non un appel par sondage :
 * la fonction accepte un tableau d'identifiants. Sans cela, ouvrir l'onglet
 * Plus déclencherait autant de requêtes que de sondages, ce qui se voit
 * immédiatement sur une connexion mobile médiocre.
 */

import type { ChoixSondage, Sondage } from '@/types/models';
import { identifiantVotant } from '@/lib/identifiants';
import { client, executer } from '@/services/client';

interface LigneSondage {
  readonly id: string;
  readonly question: string;
  readonly precisions: string | null;
  readonly ouvert: boolean;
  readonly cloture_le: string | null;
}

interface LigneResultat {
  readonly sondage_id: string;
  readonly choix_id: string;
  readonly libelle: string;
  readonly position: number;
  readonly votes: number | string;
}

const COLONNES_SONDAGE = 'id, question, precisions, ouvert, cloture_le';

/**
 * Les sondages, avec leurs réponses et leur décompte.
 *
 * @param limite Nombre de sondages remontés. Les plus récents d'abord.
 */
export async function listerSondages(limite = 10): Promise<readonly Sondage[]> {
  const sondages = await executer<readonly LigneSondage[]>(
    client()
      .from('sondages')
      .select(COLONNES_SONDAGE)
      .order('created_at', { ascending: false })
      .limit(limite),
  );

  if (sondages.length === 0) {
    return [];
  }

  const resultats = await executer<readonly LigneResultat[]>(
    client().rpc('sondage_resultats', {
      p_sondage_ids: sondages.map((sondage) => sondage.id),
    }),
  );

  const parSondage = new Map<string, ChoixSondage[]>();
  for (const ligne of resultats) {
    const liste = parSondage.get(ligne.sondage_id) ?? [];
    liste.push({
      id: ligne.choix_id,
      libelle: ligne.libelle,
      // `count()` renvoie un `bigint`, que la bibliothèque cliente transporte
      // tantôt en nombre, tantôt en chaîne selon la version. On convertit
      // explicitement : sans cela, un compteur affiché comme `"3"` au lieu de
      // `3` casserait tout calcul de pourcentage.
      votes: typeof ligne.votes === 'string' ? Number.parseInt(ligne.votes, 10) : ligne.votes,
    });
    parSondage.set(ligne.sondage_id, liste);
  }

  return sondages.map((sondage) => ({
    id: sondage.id,
    question: sondage.question,
    precisions: sondage.precisions,
    ouvert: sondage.ouvert,
    clotureLe: sondage.cloture_le,
    choix: parSondage.get(sondage.id) ?? [],
  }));
}

/**
 * Dépose un vote.
 *
 * Rend `true` si le vote a été enregistré, `false` s'il existait déjà pour cet
 * appareil. Les deux cas sont des succès du point de vue de l'utilisateur :
 * appuyer deux fois ne doit pas produire de message d'erreur.
 *
 * Ce booléen doit être lu, et non seulement reçu. `false` n'est pas un détail
 * d'implémentation : il dit que la base détient déjà un autre choix pour cet
 * appareil, et que celui qui vient d'être proposé n'a pas été retenu. L'appelant
 * qui l'ignore affiche une réponse que la base n'a pas.
 */
export async function voter(sondageId: string, choixId: string): Promise<boolean> {
  const votant = await identifiantVotant();

  return executer<boolean>(
    client().rpc('voter', {
      p_sondage_id: sondageId,
      p_choix_id: choixId,
      p_votant_id: votant,
    }),
  );
}

/** Total des voix exprimées sur un sondage. */
export function totalVotes(sondage: Sondage): number {
  return sondage.choix.reduce((somme, choix) => somme + choix.votes, 0);
}

/**
 * Part d'une réponse, entre 0 et 1.
 *
 * Renvoie 0 quand personne n'a encore voté, plutôt que `NaN` : une barre de
 * progression dont la largeur vaut `NaN` est ignorée par le moteur de rendu, et
 * l'écran affiche une barre vide sans que rien ne signale l'anomalie.
 */
export function partVotes(sondage: Sondage, choix: ChoixSondage): number {
  const total = totalVotes(sondage);
  if (total === 0) {
    return 0;
  }
  return choix.votes / total;
}
