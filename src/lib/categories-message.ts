/**
 * Les catégories d'un message adressé au bureau, et leurs libellés.
 *
 * POURQUOI CE MODULE EXISTE SÉPARÉMENT
 * ------------------------------------
 * Ces deux valeurs vivaient dans `src/services/messages.ts`, à côté de
 * `envoyerMessage`. C'était leur place naturelle, et c'est aussi ce qui les
 * rendait inéprouvables : `services/messages.ts` importe le client Supabase et
 * `expo-crypto`, si bien qu'un banc ne peut pas le charger.
 *
 * Or ces valeurs ont un accord à tenir — avec la page d'administration, qui
 * porte les mêmes libellés de son côté, et avec le type `message_categorie` de
 * la base. Un accord que rien ne peut relire est un accord qui dérive.
 *
 * Ce module n'importe RIEN à l'exécution : le seul import est un `import type`,
 * que l'effacement des types retire avant que Node ne résolve quoi que ce soit.
 * `tests/accord-categories-message.test.ts` peut donc le charger, et confronter
 * les deux listes telles qu'elles sont écrites — pas telles qu'on les recopie.
 *
 * `src/services/messages.ts` les réexporte : les appelants ne changent pas.
 *
 * CE QUI EST COMPARÉ, ET CE QUI NE L'EST PAS
 * ------------------------------------------
 * Les COUPLES (valeur, libellé), jamais les positions. L'ordre de la liste
 * ci-dessous est celui du formulaire — « Vie scolaire » en tête, parce que
 * c'est la catégorie la plus large ; celui de l'administration est
 * alphabétique, parce qu'on y parcourt la liste des yeux pour trier. Ce n'est
 * pas un désaccord, c'est un usage, et le banc n'a pas à en juger.
 */

import type { MessageCategorie } from '@/types/models';

/**
 * Le libellé affiché d'une catégorie.
 *
 * Écrit comme une table indexée par le type, et non comme une suite de
 * conditions : ajouter une valeur à `MessageCategorie` sans lui donner de
 * libellé devient alors une erreur de compilation, au lieu d'un écran qui
 * affiche `undefined`.
 */
export function libelleCategorieMessage(categorie: MessageCategorie): string {
  const libelles: Record<MessageCategorie, string> = {
    cantine: 'Cantine',
    transport: 'Transport',
    vie_scolaire: 'Vie scolaire',
    activites: 'Activités et sorties',
    autre: 'Autre',
  };
  return libelles[categorie];
}

/** Les catégories proposées dans le formulaire, dans l'ordre d'affichage. */
export const CATEGORIES_MESSAGE: readonly MessageCategorie[] = [
  'vie_scolaire',
  'cantine',
  'transport',
  'activites',
  'autre',
];
