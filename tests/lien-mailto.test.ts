/**
 * Le lien « répondre » d'un message de parent.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `lienMailto` est né d'un défaut qu'aucun contrôle n'aurait vu : la
 * concaténation `mailto:${adresse}` paraît juste, et l'est pour toute adresse
 * ordinaire. Elle ne l'est plus pour les adresses que la BASE accepte.
 *
 * `messages_reponse_format` exige un arobase et un point, et rien d'autre :
 *
 *     reponse_a ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
 *
 * La classe `[^@[:space:]]` accepte donc `?`, `&`, `=`, `#`, `/` et `,`. Une
 * valeur telle que `prenom@exemple.fr?subject=Facture` passe la contrainte, et
 * un lien construit naïvement ouvrirait le logiciel de messagerie du bureau
 * avec un sujet déjà rempli — écrit par le parent, pas par le bureau.
 *
 * Ce n'est pas une faille : le bureau voit ce qu'il envoie. C'est une valeur
 * qui se fait passer pour autre chose au moment précis où on la clique.
 *
 * LES TÉMOINS SONT ÉCRITS ICI, EN TOUTES LETTRES
 * ----------------------------------------------
 * Jamais recopiés depuis l'implémentation : un banc qui lirait sa valeur
 * attendue dans le fichier qu'il éprouve serait vert quoi qu'il arrive.
 *
 * Et deux contrôles sont des PROPRIÉTÉS plutôt que des égalités — aucun
 * délimiteur ne subsiste, et le nombre d'arobases est conservé. Une propriété
 * survit à un changement d'encodage qu'une égalité figée refuserait à tort.
 *
 * LA PRÉMISSE QUI REND LE BANC HONNÊTE
 * ------------------------------------
 * Éprouver `lienMailto` sur des adresses que la base REFUSERAIT ne dirait rien
 * du cas réel. Chaque valeur de `ACCEPTEES` est donc confrontée à
 * `adresseReponseAcceptable`, la règle de l'écran de contact — elle-même tenue
 * contre le motif de la migration par `tests/adresse-reponse.test.ts`. Un
 * témoin ajouté ici sans être acceptable fait donc échouer ce banc, et non
 * passer une vérification sans objet.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { lienMailto } from '../admin/src/lib/adresse.ts';
import { adresseReponseAcceptable } from '../src/lib/adresse-reponse.ts';

/**
 * Ce qu'un parent peut réellement laisser, au vu de la contrainte.
 *
 * Chaque entrée est un cas que `messages_reponse_format` ACCEPTE — vérifié par
 * la prémisse plus bas, pas supposé.
 */
const ACCEPTEES = [
  'prenom@exemple.fr',
  'prenom.nom@exemple.fr',
  'prenom+tag@exemple.fr',
  'prenom@exemple.fr?subject=Facture%20impayee',
  'prenom@exemple.fr&body=Bonjour',
  'prenom@exemple.fr#fragment',
  'prenom@exemple.fr/path',
  'prenom@exemple.fr=1',
  'a!b$c*d~e@exemple.fr',
  'pre’nom@exemple.fr',
] as const;

/**
 * Ce qui, après `mailto:`, changerait la lecture de la valeur.
 *
 * `?` ouvre les paramètres, `#` ouvre le fragment, `&` et `=` séparent les
 * paramètres entre eux, `,` sépare deux destinataires, `;` en fait autant dans
 * certaines grammaires, `/` et l'espace ne sont pas des caractères d'adresse.
 * Tout ce qui sort de l'ASCII imprimable en fait partie : une adresse accentuée
 * doit être encodée, sans quoi le lien n'est pas une URI valide.
 */
const DELIMITEURS = /[?#&=/,;\s]|[^\x20-\x7e]/;

describe('lienMailto — prémisse : les témoins sont des cas réels', () => {
  it('n’éprouve que des adresses que la règle de l’écran accepte', () => {
    for (const adresse of ACCEPTEES) {
      assert.ok(
        adresseReponseAcceptable(adresse),
        `« ${adresse} » serait refusée par l’écran de contact : l’éprouver ici ne dit ` +
          'rien du cas réel. La retirer, ou corriger la règle.',
      );
    }
  });
});

describe('lienMailto — les adresses ordinaires passent telles quelles', () => {
  it('laisse une adresse simple intacte', () => {
    // Le témoin qui interdit de tout encoder : `%40` à la place de l'arobase
    // ferait un lien que tous les clients ne savent pas ouvrir, et le remède
    // serait pire que le mal.
    assert.equal(lienMailto('prenom@exemple.fr'), 'mailto:prenom@exemple.fr');
  });

  it('conserve le plus et les signes qu’un client de messagerie attend', () => {
    // Le `+` est fréquent dans les adresses — étiquettes de tri. L'encoder en
    // `%2B` serait correct au sens de la norme, et risqué pour un client peu
    // rigoureux : c'est la raison pour laquelle il est restauré.
    assert.equal(lienMailto('prenom+tag@exemple.fr'), 'mailto:prenom+tag@exemple.fr');
    assert.equal(lienMailto('prenom.nom@exemple.fr'), 'mailto:prenom.nom@exemple.fr');
    assert.equal(lienMailto('a-b_c@exemple.fr'), 'mailto:a-b_c@exemple.fr');
  });

  it('ne restaure qu’une arobase, même sur une valeur qui en porterait deux', () => {
    //  La base interdit ce cas — `[^@]` n'accepte l'arobase nulle part — mais
    //  l'implémentation ne doit pas en dépendre : restaurer TOUTES les `%40`
    //  rendrait le découpage de l'adresse ambigu.
    assert.equal(lienMailto('a@b@c.fr'), 'mailto:a@b%40c.fr');
  });
});

describe('lienMailto — ce qui pourrait déborder est encodé', () => {
  it('neutralise le point d’interrogation qui ouvrirait un sujet', () => {
    assert.equal(
      lienMailto('prenom@exemple.fr?subject=Facture'),
      'mailto:prenom@exemple.fr%3Fsubject%3DFacture',
    );
  });

  it('neutralise l’esperluette et le dièse', () => {
    assert.equal(lienMailto('a@b.fr&body=x'), 'mailto:a@b.fr%26body%3Dx');
    assert.equal(lienMailto('a@b.fr#c'), 'mailto:a@b.fr%23c');
  });

  it('neutralise la barre oblique, le signe égal et la virgule', () => {
    assert.equal(lienMailto('a@b.fr/c'), 'mailto:a@b.fr%2Fc');
    assert.equal(lienMailto('a@b.fr=1'), 'mailto:a@b.fr%3D1');
    //  La virgule est celle qui ajouterait un second destinataire.
    //
    //  La valeur attendue porte une SECONDE arobase encodée, et c'est le
    //  comportement voulu : seule la première est restaurée, la suivante reste
    //  `%40` pour que le découpage de l'adresse ne soit pas ambigu. Ce témoin a
    //  d'ailleurs attrapé une erreur — l'attendu l'avait oubliée, pas le code.
    assert.equal(lienMailto('a@b.fr,c@d.fr'), 'mailto:a@b.fr%2Cc%40d.fr');
  });

  it('encode les accents, qu’une adresse acceptée peut porter', () => {
    assert.equal(lienMailto('pre’nom@exemple.fr'), 'mailto:pre%E2%80%99nom@exemple.fr');
  });
});

describe('lienMailto — propriétés vraies de toute adresse acceptée', () => {
  it('produit toujours un lien exploitable', () => {
    for (const adresse of ACCEPTEES) {
      const lien = lienMailto(adresse);

      assert.ok(lien.startsWith('mailto:'), `« ${adresse} » ne donne pas un lien mailto.`);
      assert.ok(lien.length > 'mailto:'.length, `« ${adresse} » donne un lien vide.`);
    }
  });

  it('ne laisse aucun délimiteur après « mailto: »', () => {
    //  La propriété qui remplace une comparaison figée : elle tient pour toute
    //  entrée, y compris celles qu'on ajouterait demain à `ACCEPTEES`.
    for (const adresse of ACCEPTEES) {
      const corps = lienMailto(adresse).slice('mailto:'.length);

      assert.ok(
        !DELIMITEURS.test(corps),
        `« ${adresse} » laisse un délimiteur dans le lien : ${JSON.stringify(corps)}.`,
      );
    }
  });

  it('n’a jamais plus d’arobases que l’adresse n’en porte', () => {
    for (const adresse of ACCEPTEES) {
      const arobasesEntree = [...adresse].filter((caractere) => caractere === '@').length;
      const arobasesSortie = [...lienMailto(adresse)].filter(
        (caractere) => caractere === '@',
      ).length;

      assert.equal(
        arobasesSortie,
        arobasesEntree,
        `« ${adresse} » donne ${arobasesSortie} arobase(s) au lieu de ${arobasesEntree}.`,
      );
    }
  });

  it('n’est jamais la concaténation naïve quand un délimiteur est présent', () => {
    //  Le contrôle qui nomme le défaut d'origine, sur les seules formes qui le
    //  déclenchent. Sur une adresse ordinaire les deux formes coïncident, et
    //  c'est normal : l'égalité y serait un faux témoin.
    const naif = (adresse: string) => `mailto:${adresse}`;

    for (const adresse of [
      'a@b.fr?x=1',
      'a@b.fr&x=1',
      'a@b.fr#x',
      'a@b.fr/x',
      'a@b.fr=x',
      'a@b.fr,c@d.fr',
    ]) {
      assert.notEqual(
        lienMailto(adresse),
        naif(adresse),
        `« ${adresse} » sort inchangée : le sujet, le corps ou le destinataire du ` +
          'message serait décidé par le parent.',
      );
    }
  });
});
