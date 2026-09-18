/**
 * L'accord entre les deux listes de clés refusées.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Le refus des clés à privilèges est écrit DEUX FOIS dans ce dépôt : dans
 * `src/config/env.ts` pour l'application mobile, et dans `admin/src/lib/cle.ts`
 * pour la page d'administration. La duplication est délibérée — les deux
 * applications sont compilées séparément, et faire dépendre l'application, déjà
 * livrée et éprouvée, d'un fichier partagé pour économiser quinze lignes serait
 * un mauvais échange.
 *
 * Mais une duplication que rien ne tient dérive, et la dérive n'est pas
 * symétrique : c'est la copie qu'on ne relit pas qui laisserait passer la clé.
 * Or la page d'administration est celle des deux qui est déployée sur un
 * hébergeur, avec ses variables saisies à la main dans un formulaire — le geste
 * exact où l'on colle la clé que le tableau de bord met en avant, c'est-à-dire
 * la clé secrète. Une telle clé dans cette page donnerait à quiconque l'ouvre le
 * droit de lire les messages adressés au bureau.
 *
 * CE QUE CE BANC MESURE, ET COMMENT
 * ---------------------------------
 * Les deux côtés sont lus DEPUIS LEUR PROPRE SOURCE, jamais recopiés. Le côté
 * page appelle `cleInterdite`, exportée pour cela. Le côté application appelle
 * `construire()` avec les variables d'environnement posées : c'est la seule
 * voie possible — sa fonction de refus n'est pas exportée — et c'est aussi la
 * bonne, puisqu'elle mesure ce que l'utilisateur verrait.
 *
 * Les témoins sont éprouvés DANS LES DEUX SENS, et c'est ce qui rend le banc
 * concluant : une liste de témoins tous refusés serait franchie par deux
 * fonctions qui refusent tout, et elles seraient pourtant parfaitement
 * d'accord. Il faut des témoins acceptés pour que l'accord signifie quelque
 * chose. Un garde-fou plus bas mesure cette prémisse plutôt que de la supposer.
 *
 * LA TROISIÈME COPIE, ET POURQUOI ELLE N'EST PAS ICI
 * --------------------------------------------------
 * `scripts/verifier-securite-api.mjs` porte lui aussi une règle sur les formes
 * de clé. Ce n'est pas la même, et elle n'est donc pas tenue par ce banc : elle
 * s'applique à la clé réellement utilisée pour interroger la base, et c'est une
 * LISTE BLANCHE — seule `sb_publishable_…` est reconnue, tout le reste est
 * refusé, parce qu'une forme inconnue ne permet d'affirmer aucun droit et que
 * les vingt-huit vérifications qui suivent seraient vertes pour de mauvaises
 * raisons. La documentation, elle, énonce les trois formes refusées en prose :
 * `README.md`, `docs/01-installer-sur-iphone.md`, `docs/03-securite-et-donnees.md`
 * et `docs/05-administration.md`. Aucune de ces phrases n'est relue
 * automatiquement — une forme ajoutée ici doit y être ajoutée à la main.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * `atob` existe sous Node pour ses propres raisons ; ce banc ne peut donc pas
 * établir qu'il existe sur Hermes, le moteur du téléphone. Ce point repose sur
 * la note de version de Hermes, et `config-env.test.ts` le dit déjà dans son
 * en-tête.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cleInterdite } from '../admin/src/lib/cle.ts';
import { base64url, jeton, refuseeParLApplication } from './aide/environnement.ts';

type Temoin = {
  readonly nom: string;
  readonly cle: string;
  /** Verdict attendu des DEUX côtés. */
  readonly refusee: boolean;
};

/**
 * Les valeurs éprouvées, des deux côtés à la fois.
 *
 * Chaque témoin porte le verdict attendu, et non seulement la valeur : sans
 * lui, deux listes qui refuseraient tout seraient déclarées d'accord. C'est la
 * seule chose de ce fichier qui ne soit pas lue depuis une source — le verdict
 * attendu est la spécification, pas une copie de l'implémentation.
 */
const TEMOINS: readonly Temoin[] = [
  {
    nom: 'la clé secrète au format actuel, `sb_secret_…`',
    cle: 'sb_secret_AbCdEf0123456789',
    refusee: true,
  },
  {
    nom: 'un jeton d’accès personnel, `sbp_…`',
    cle: 'sbp_AbCdEf0123456789',
    refusee: true,
  },
  {
    nom: 'un JWT dont le rôle est `service_role`',
    cle: jeton({ iss: 'supabase', ref: 'exemple', role: 'service_role' }),
    refusee: true,
  },
  {
    nom: 'un JWT `service_role` court, que l’ancien seuil de longueur laissait passer',
    cle: jeton({ role: 'service_role' }),
    refusee: true,
  },
  {
    nom: 'la clé publique au format actuel, `sb_publishable_…`',
    // Le témoin le plus important de la liste. `sb_publishable_…` et
    // `sb_secret_…` partagent le préfixe `sb_` : un « refusons tout ce qui
    // commence par sb_ » — la simplification qu'on écrirait sans réfléchir —
    // franchirait tous les témoins de refus et rendrait les deux applications
    // inutilisables, avec pour seul symptôme une erreur de configuration à
    // l'ouverture.
    cle: 'sb_publishable_AbCdEf0123456789',
    refusee: false,
  },
  {
    nom: 'un JWT dont le rôle est `anon`',
    cle: jeton({ iss: 'supabase', ref: 'exemple', role: 'anon', iat: 1_760_000_000 }),
    refusee: false,
  },
  {
    nom: 'un JWT dont la charge utile ne porte aucun rôle',
    cle: jeton({ iss: 'supabase', ref: 'exemple' }),
    refusee: false,
  },
  {
    nom: 'un JWT dont le rôle est écrit en majuscules',
    // Le rôle est comparé exactement, et c'est correct : `service_role` est un
    // nom de rôle PostgreSQL, donc en minuscules par construction. Ce témoin
    // n'excuse pas une faiblesse, il fixe la frontière — si l'un des deux côtés
    // se mettait un jour à comparer sans tenir compte de la casse, l'écart se
    // verrait ici plutôt que d'être découvert.
    cle: jeton({ role: 'SERVICE_ROLE' }),
    refusee: false,
  },
  {
    nom: 'une clé illisible, qui n’est pas un JWT',
    cle: 'ceci.n-est-pas-un-jwt',
    refusee: false,
  },
  {
    nom: 'un JWT dont la charge utile n’est pas du JSON',
    cle: `entete.${base64url('pas du json')}.signature`,
    refusee: false,
  },
];

describe('refus des clés — accord entre l’application et la page', () => {
  for (const temoin of TEMOINS) {
    it(`${temoin.refusee ? 'refuse' : 'accepte'} ${temoin.nom}`, () => {
      const cotePage = cleInterdite(temoin.cle);
      const coteApplication = refuseeParLApplication(temoin.cle);

      // L'accord d'abord : c'est la propriété que ce fichier existe pour tenir,
      // et le message nomme le sens de la divergence — laquelle des deux listes
      // est la plus permissive.
      assert.equal(
        cotePage,
        coteApplication,
        `Divergence sur ${temoin.nom} : la page ${cotePage ? 'refuse' : 'accepte'}, ` +
          `l'application ${coteApplication ? 'refuse' : 'accepte'}.`,
      );

      // Le verdict attendu ensuite : sans lui, deux listes d'accord pour tout
      // refuser — ou pour tout accepter — passeraient.
      assert.equal(
        cotePage,
        temoin.refusee,
        `${temoin.nom} : verdict attendu ${temoin.refusee ? 'refusée' : 'acceptée'}.`,
      );
    });
  }
});

describe('garde-fous de ce banc', () => {
  it('éprouve les deux verdicts, sans quoi un « tout refusé » serait déclaré d’accord', () => {
    const refuses = TEMOINS.filter((temoin) => temoin.refusee).length;
    const acceptes = TEMOINS.filter((temoin) => !temoin.refusee).length;

    assert.ok(refuses >= 3, `prémisse : au moins trois témoins refusés (mesuré : ${refuses})`);
    assert.ok(acceptes >= 3, `prémisse : au moins trois témoins acceptés (mesuré : ${acceptes})`);
  });

  it('n’éprouve aucune valeur vide, qui serait refusée pour une autre raison', () => {
    // Une clé absente n'est pas une clé refusée : `construire()` la refuse au
    // titre de variable manquante, sans que le contrôle de forme ait son mot à
    // dire. Les confondre ferait dire au banc une chose qu'il ne mesure pas.
    for (const temoin of TEMOINS) {
      assert.notEqual(temoin.cle.trim(), '', `témoin vide : ${temoin.nom}`);
    }
  });

  it('nomme chaque témoin, pour qu’un échec se lise sans ouvrir le fichier', () => {
    for (const temoin of TEMOINS) {
      assert.notEqual(temoin.nom.trim(), '', 'un témoin ne porte pas de nom');
    }
  });
});
