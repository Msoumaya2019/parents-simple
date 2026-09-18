/**
 * Refus des clés à privilèges.
 *
 * Le pendant exact du contrôle de `src/config/env.ts`, côté application mobile.
 * Il est réécrit ici plutôt qu'importé : les deux applications sont compilées
 * séparément, et faire dépendre l'application mobile — déjà livrée et éprouvée
 * — d'un fichier partagé pour économiser quinze lignes serait un mauvais
 * échange.
 *
 * Duplication ne veut pas dire oubli : `tests/cles-refusees.test.ts` vérifie
 * que les deux listes refusent les mêmes valeurs. Sans ce test, l'une pourrait
 * se relâcher sans que l'autre s'en aperçoive, et c'est celle qu'on ne relit
 * pas qui laisserait passer la clé.
 *
 * POURQUOI CE CONTRÔLE EST PLUS IMPORTANT ICI QU'AILLEURS
 * ------------------------------------------------------
 * Cette page est déployée sur un hébergeur, avec ses variables d'environnement
 * saisies à la main dans un formulaire web. C'est exactement le geste où l'on
 * colle la clé que le tableau de bord met en avant — la clé secrète — au lieu
 * de la clé publique. Une telle clé dans cette page donnerait à quiconque
 * l'ouvre le droit de lire les messages des parents et de tout réécrire.
 */

/**
 * Vrai si cette valeur ne doit jamais être placée dans une page distribuée.
 *
 * Trois formes sont refusées, et la première est la plus récente :
 *
 *   - `sb_secret_…` — la clé secrète actuelle. Ce n'est pas un JWT : un
 *     contrôle qui ne saurait décoder que des JWT ne la verrait pas passer.
 *   - un JWT dont la charge utile porte `role: service_role` — la forme
 *     historique de la même clé ;
 *   - `sbp_…` — un jeton d'accès personnel à l'API de gestion. Il ne
 *     fonctionnerait pas comme clé d'application, mais l'échec serait un refus
 *     obscur au premier chargement plutôt qu'une phrase qui nomme la cause.
 */
export function cleInterdite(valeur: string): boolean {
  if (/^sb_secret_/i.test(valeur) || /^sbp_/i.test(valeur)) {
    return true;
  }

  // Aucune condition de longueur : un seuil n'aurait pour seul effet possible
  // de désactiver le contrôle sur une clé un peu plus courte, et un garde-fou
  // qui s'éteint tout seul ne garde rien.
  return decoderChargeUtile(valeur)?.role === 'service_role';
}

/**
 * Décode la charge utile d'un JWT, sans vérifier sa signature.
 *
 * Sert uniquement à lire le champ `role` et à refuser une clé à privilèges. Le
 * résultat n'a aucune valeur d'authentification. Rend `null` pour tout ce qui
 * n'est pas un JWT — une clé `sb_secret_…`, par exemple, dont le découpage ne
 * donne qu'un seul morceau.
 *
 * `atob` est disponible ici sans réserve : cette page s'exécute dans un
 * navigateur, où il fait partie de la plateforme depuis toujours. Rien à voir
 * avec la question, délicate, de sa présence dans le moteur d'une application
 * mobile.
 */
export function decoderChargeUtile(jeton: string): { role?: string } | null {
  const parties = jeton.split('.');
  const charge = parties[1];
  if (charge === undefined) {
    return null;
  }

  try {
    // `atob` n'accepte ni `-`/`_` (base64url) ni l'absence de remplissage.
    const base64 = charge.replace(/-/g, '+').replace(/_/g, '/');
    const complete = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binaire = globalThis.atob(complete);
    const texte = decodeURIComponent(
      Array.from(binaire)
        .map((caractere) => `%${caractere.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    );
    return JSON.parse(texte) as { role?: string };
  } catch {
    return null;
  }
}
