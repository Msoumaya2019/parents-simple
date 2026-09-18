/**
 * Ce que la page de confidentialité affiche selon ce qui est renseigné.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `app/confidentialite.tsx` choisit entre deux affichages : les coordonnées du
 * responsable de traitement, ou un avertissement. Le choix tient à une seule
 * question — les trois valeurs sont-elles renseignées ? — et cette question se
 * trompe en silence :
 *
 *   - la branche « complète » rend une carte qui a l'air terminée. Si une valeur
 *     manque, un parent lit une adresse vide là où il doit écrire pour exercer
 *     ses droits, et rien ne le signale ;
 *   - `=== ''` ne voit pas une valeur faite d'espaces. Coller « » par accident
 *     suffit à faire passer la page pour renseignée.
 *
 * Aucun contrôle existant ne regardait cela. `admin:check` lit l'administration,
 * pas l'application. `routes-declarees.test.ts` vérifie que l'écran est
 * atteignable, pas ce qu'il affiche. Le typecheck ne voit rien : les deux
 * branches compilent.
 *
 * POURQUOI LA RÈGLE A ÉTÉ SORTIE DE L'ÉCRAN
 * -----------------------------------------
 * Un banc ne peut pas charger `app/confidentialite.tsx` : il importe React
 * Native. La règle vit donc dans `src/lib/responsable.ts`, qui n'importe rien —
 * c'est la même raison, et la même mesure, que pour `message-liste.ts` côté
 * administration. La partie 1 interroge la règle ; la partie 2 exige que l'écran
 * l'appelle.
 *
 * LA PARTIE 2 EST UN CONTRÔLE DE FORME, ET C'EST ASSUMÉ
 * -----------------------------------------------------
 * Elle lit une source, pas un rendu : elle ne peut pas prouver que l'écran
 * affiche le bon texte. Elle tient en revanche la propriété qui compte, et qui
 * n'est pas dans la règle : **dans quel ordre les deux branches sont écrites**.
 * Un `RESPONSABLE_INCOMPLET ?` dont on aurait échangé les deux côtés afficherait
 * les coordonnées — vides — à un parent, tout en gardant le bon nom de
 * constante : aucune relecture rapide ne le verrait.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que les valeurs renseignées soient VRAIES. Le nom de l'association, l'adresse
 * de son siège et son adresse de contact figurent dans ses statuts : aucun
 * contrôle ne peut les connaître, et une adresse inventée serait pire que
 * l'avertissement.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  champsManquantsResponsable,
  responsableIncomplet,
  type ChampResponsable,
  type Responsable,
} from '@/lib/responsable';

const RACINE = process.cwd();
const CHEMIN_ECRAN = join(RACINE, 'app', 'confidentialite.tsx');

/**
 * Les trois vides, écrits ici en toutes lettres.
 *
 * C'est la spécification, pas une copie de l'implémentation : un banc qui
 * lirait son entrée depuis le fichier qu'il éprouve serait vert quoi qu'il
 * arrive. L'objet de l'écran, lui, change de valeur dès que l'association se
 * renseigne — ce banc ne doit pas s'en apercevoir.
 */
const VIDE: Responsable = { nom: '', siege: '', courriel: '' };

/** Un jeu complet, pour éprouver le cas opposé. */
const RENSEIGNE: Responsable = {
  nom: 'FCPE Frères Lumières',
  siege: '1 rue de l’Exemple, 78400 Montmagny',
  courriel: 'contact@exemple.fr',
};

const CHAMPS: readonly ChampResponsable[] = ['nom', 'siege', 'courriel'];

/** L'écran relu une fois, pour les contrôles de forme. */
const SOURCE_ECRAN = readFileSync(CHEMIN_ECRAN, 'utf8');

/** Le texte de la branche d'avertissement, cité tel qu'il doit rester. */
const AVERTISSEMENT = 'À compléter avant la mise à disposition';

/** Le premier signe de la branche « coordonnées », cité lui aussi. */
const PREMIERE_COORDONNEE = '{RESPONSABLE.nom}';

describe('la règle — les trois valeurs sont-elles renseignées ?', () => {
  it('les trois vides : la page est incomplète, et les trois champs sont nommés', () => {
    assert.equal(responsableIncomplet(VIDE), true);
    assert.deepEqual(champsManquantsResponsable(VIDE), ['nom', 'siege', 'courriel']);
  });

  it('un seul champ vide suffit à rendre la page incomplète', () => {
    // Éprouvé sur les trois champs, et pas seulement sur le premier : une
    // condition écrite `&&` au lieu de `||` passerait le cas des trois vides —
    // où les deux formes donnent la même réponse — et ne se verrait qu'ici.
    for (const champ of CHAMPS) {
      const entree: Responsable = { ...RENSEIGNE, [champ]: '' };

      assert.equal(
        responsableIncomplet(entree),
        true,
        `Le champ « ${champ} » est vide : la page doit afficher l’avertissement.`,
      );
      assert.deepEqual(
        champsManquantsResponsable(entree),
        [champ],
        `Seul « ${champ} » manque : la liste ne doit nommer que lui.`,
      );
    }
  });

  it('une valeur faite d’espaces est une valeur absente', () => {
    // Le cas qui distingue « renseigné » de « non vide », et le seul endroit du
    // banc où la règle d'origine — `=== ''` — se serait trompée en silence :
    // deux champs remplis, un champ blanc, et la carte avait l'air complète.
    for (const blanc of [' ', '   ', '\t', '\n', ' \t\n ']) {
      const entree: Responsable = { ...RENSEIGNE, siege: blanc };

      assert.equal(
        responsableIncomplet(entree),
        true,
        `Un siège fait de ${JSON.stringify(blanc)} n’est pas un siège renseigné.`,
      );
      assert.deepEqual(champsManquantsResponsable(entree), ['siege']);
    }
  });

  it('les trois renseignées : la page est complète, et rien ne manque', () => {
    assert.equal(responsableIncomplet(RENSEIGNE), false);
    assert.deepEqual(champsManquantsResponsable(RENSEIGNE), []);
  });

  it('la liste et le booléen ne peuvent pas se contredire', () => {
    // Deux sorties pour une même question : un remaniement pourrait les
    // désaccorder, et la page suivrait le booléen pendant qu'un avertissement
    // nommerait les champs de la liste.
    const entrees: readonly Responsable[] = [
      VIDE,
      RENSEIGNE,
      { ...RENSEIGNE, nom: '' },
      { ...RENSEIGNE, siege: ' ' },
      { ...RENSEIGNE, courriel: '' },
      { nom: '  ', siege: '', courriel: '' },
    ];

    for (const entree of entrees) {
      assert.equal(
        responsableIncomplet(entree),
        champsManquantsResponsable(entree).length > 0,
        `Désaccord sur ${JSON.stringify(entree)}.`,
      );
    }
  });
});

describe('accord avec l’écran — la règle n’est pas recopiée', () => {
  it('l’écran porte bien l’objet à renseigner, et ses trois champs', () => {
    // Prémisse : sans elle, tout ce qui suit pourrait être vrai d'un fichier
    // vidé, et ce banc ne surveillerait plus rien.
    assert.ok(
      SOURCE_ECRAN.includes('const RESPONSABLE = {'),
      'L’objet RESPONSABLE a disparu de l’écran : la page n’a plus rien à renseigner.',
    );
    for (const champ of CHAMPS) {
      assert.ok(
        new RegExp(`^\\s*${champ}:\\s*`, 'm').test(SOURCE_ECRAN),
        `Le champ « ${champ} » ne figure plus dans l’objet RESPONSABLE.`,
      );
    }
  });

  it('l’écran importe la règle et l’appelle', () => {
    assert.ok(
      SOURCE_ECRAN.includes("from '@/lib/responsable'"),
      'L’écran n’importe plus la règle depuis @/lib/responsable.',
    );
    assert.ok(
      SOURCE_ECRAN.includes('responsableIncomplet(RESPONSABLE)'),
      'L’écran n’appelle plus responsableIncomplet(RESPONSABLE) : sa règle est ' +
        'recopiée, donc hors d’atteinte de ce banc.',
    );
  });

  it('l’écran ne décide plus lui-même si une valeur est renseignée', () => {
    // La comparaison à une chaîne vide est ce que la règle remplace. Recopiée
    // dans l'écran, elle reviendrait sans la correction des espaces.
    assert.ok(
      !/[!=]==\s*(''|"")/.test(SOURCE_ECRAN),
      'L’écran compare une valeur à une chaîne vide au lieu d’appeler la règle.',
    );
  });

  it('l’avertissement est la branche des valeurs manquantes, et il vient en premier', () => {
    const positionAvertissement = SOURCE_ECRAN.indexOf(AVERTISSEMENT);
    const positionCoordonnees = SOURCE_ECRAN.indexOf(PREMIERE_COORDONNEE);

    // Les deux branches doivent exister : c'est la prémisse de la comparaison
    // qui suit, un `indexOf` valant -1 pour un texte absent.
    assert.ok(
      positionAvertissement >= 0,
      `L’écran n’affiche plus « ${AVERTISSEMENT} » : la page se tairait sur ce qui manque.`,
    );
    assert.ok(
      positionCoordonnees >= 0,
      `L’écran n’affiche plus ${PREMIERE_COORDONNEE} : les coordonnées ne sont jamais rendues.`,
    );

    // La tête du ternaire, citée sans le `!` possible : une condition NIÉE
    // garde les deux branches dans le même ordre et afficherait pourtant les
    // coordonnées à un parent. Le contrôle de position, seul, ne l'attrape pas —
    // les deux vérifications couvrent deux défauts différents.
    assert.match(
      SOURCE_ECRAN,
      /\{\s*RESPONSABLE_INCOMPLET\s*\?\s*\(/,
      'La garde n’est plus « RESPONSABLE_INCOMPLET ? … » : une condition niée ' +
        'inverserait les deux affichages sans changer leur ordre.',
    );

    // Le cœur du contrôle de forme : l'ordre. Des branches échangées — un
    // `RESPONSABLE_INCOMPLET ?` dont on aurait interverti les deux côtés —
    // afficheraient les coordonnées, vides, tout en gardant le bon nom.
    assert.ok(
      positionAvertissement < positionCoordonnees,
      'L’avertissement n’est plus la branche des valeurs manquantes : ' +
        'la page afficherait des coordonnées vides au lieu de signaler ce qui manque.',
    );
  });
});
