/**
 * Menus de la cantine.
 *
 * `service_date` est un jour civil, au format `AAAA-MM-JJ`, sans heure ni
 * fuseau. La comparaison avec la date du jour se fait donc sur une chaîne, ce
 * qui est exactement le comportement voulu : le menu du 22 septembre est celui
 * du 22 septembre, quelle que soit l'heure à laquelle on ouvre l'application.
 */

import type { MenuCantine } from '@/types/models';
import { client, executer } from '@/services/client';

interface LigneMenu {
  readonly id: string;
  readonly service_date: string;
  readonly entree: string | null;
  readonly plat: string | null;
  readonly dessert: string | null;
  readonly allergenes: readonly string[] | null;
  readonly notes: string | null;
}

const COLONNES = 'id, service_date, entree, plat, dessert, allergenes, notes';

function versMenu(ligne: LigneMenu): MenuCantine {
  return {
    id: ligne.id,
    serviceDate: ligne.service_date,
    entree: ligne.entree,
    plat: ligne.plat,
    dessert: ligne.dessert,
    // `allergenes` est un tableau PostgreSQL nullable. La base peut renvoyer
    // `null` plutôt qu'un tableau vide : sans ce repli, un écran qui parcourt
    // la valeur planterait sur les menus sans allergène déclaré.
    allergenes: ligne.allergenes ?? [],
    notes: ligne.notes,
  };
}

/**
 * Les menus à partir d'un jour donné.
 *
 * Le paramètre est un jour civil `AAAA-MM-JJ`, pas un instant : passer une date
 * ISO complète décalerait la sélection d'un jour selon le fuseau du téléphone.
 */
export async function listerMenus(
  depuisJour: string,
  limite = 60,
): Promise<readonly MenuCantine[]> {
  const lignes = await executer<readonly LigneMenu[]>(
    client()
      .from('cantine_menus')
      .select(COLONNES)
      .gte('service_date', depuisJour)
      .order('service_date', { ascending: true })
      .limit(limite),
  );

  return lignes.map(versMenu);
}

//  Les utilitaires de jour civil — `jourCourant`, `lundiDeLaSemaine`,
//  `decalerJours`, `versJourCivil` — vivent dans `@/utils/date`. Ils ne
//  dépendent d'aucune requête, et les garder ici obligeait à importer tout le
//  service, donc le client Supabase, pour calculer une date.
