/**
 * Ce que l'écran des messages laisse à faire, et qui doit y être écrit.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * La page de confidentialité promet aux parents que les messages adressés au
 * bureau sont « conservés le temps nécessaire à leur traitement, puis
 * supprimés ». L'onglet Messages de la page d'administration permet de marquer
 * un message « traité » — c'est-à-dire de déclarer le traitement terminé, à
 * l'instant précis auquel la promesse attache la suppression.
 *
 * Or cet onglet n'efface rien, et c'est délibéré : supprimer est irréversible,
 * et un bouton « supprimer » voisin d'une case à cocher se déclenche par erreur.
 * La suppression reste un geste du tableau de bord.
 *
 * D'où le défaut que ce banc ferme : un écran qui offre « Marquer comme traité »
 * et se taît laisse croire le travail fini. Avant cet onglet, on marquait
 * « traité » DANS le tableau de bord — la suppression était à portée de clic.
 * Maintenant, on la marque sur un écran d'où l'effacement est impossible, et
 * rien n'y rappelle qu'il reste à faire ailleurs.
 *
 * CE QU'IL VÉRIFIE, ET POURQUOI AINSI
 * -----------------------------------
 * Le fichier est lu **commentaires retirés**. C'est le point du banc : le
 * commentaire d'en-tête de l'écran nomme le tableau de bord et explique que la
 * promesse reste tenue par une personne. Un contrôle qui chercherait ces mots
 * dans le fichier entier resterait donc vert sur un écran redevenu muet pour
 * l'utilisateur — c'est la leçon déjà payée ailleurs, « une valeur citée n'est
 * pas une valeur employée ».
 *
 * Les mots cherchés sont de la prose : « supprimer », « tableau de bord ».
 * Aucun identifiant du fichier ne les contient, donc les trouver dans le texte
 * sans commentaires revient à les trouver à l'écran.
 *
 * LES PRÉMISSES SONT DES ASSERTIONS, PAS DES COMMENTAIRES
 * ------------------------------------------------------
 * Si la promesse disparaissait de la page de confidentialité, ce banc n'aurait
 * plus rien à tenir : il échoue en le disant, plutôt que de rester vert pour
 * rien. Un contrôle qui ne peut rien affirmer doit échouer, pas passer.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const PAGE_CONFIDENTIALITE = join(RACINE, 'app', 'confidentialite.tsx');
const ECRAN_MESSAGES = join(RACINE, 'admin', 'src', 'ecrans', 'Messages.tsx');
const REQUETES = join(RACINE, 'admin', 'src', 'lib', 'contenu.ts');

/**
 * La phrase par laquelle la page s'engage. Comparée sur le texte aplati, parce
 * que le JSX la coupe par un passage à la ligne.
 */
const PROMESSE =
  'Les messages adressés au bureau sont conservés le temps nécessaire à leur traitement, puis supprimés.';

const SOURCE_ECRAN = readFileSync(ECRAN_MESSAGES, 'utf8');

/**
 * Le fichier, commentaires retirés.
 *
 * La seconde expression épargne les `//` précédés de `:`, pour ne pas manger
 * une adresse (`https://`). L'écran n'en porte aucune aujourd'hui, mais le
 * motif ne doit pas dépendre de cette absence.
 */
const SANS_COMMENTAIRES = SOURCE_ECRAN.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(
  /(^|[^:])\/\/[^\n]*/g,
  '$1',
);

describe('messages traités — ce qui reste à faire est écrit sur l’écran', () => {
  it('prémisse : la page de confidentialité porte encore la promesse', () => {
    const page = readFileSync(PAGE_CONFIDENTIALITE, 'utf8').replace(/\s+/g, ' ').trim();

    assert.ok(
      page.includes(PROMESSE),
      'La page de confidentialité ne promet plus la suppression des messages après ' +
        'traitement. Si c’est volontaire, ce banc n’a plus rien à tenir : le supprimer, ' +
        'plutôt que de le laisser vert pour rien.',
    );
  });

  it('prémisse : on lit le texte porté par l’écran, pas ses commentaires', () => {
    assert.ok(
      SANS_COMMENTAIRES.length > 500,
      `Lecture suspecte : ${SANS_COMMENTAIRES.length} caractère(s) après retrait des ` +
        'commentaires.',
    );

    //  Le commentaire d'en-tête nomme le Table Editor ; le texte porté par
    //  l'écran, non. Sans cette prémisse, un extracteur cassé rendrait les
    //  assertions suivantes vertes en ne comparant rien.
    assert.ok(
      !SANS_COMMENTAIRES.includes('Table Editor'),
      'Les commentaires n’ont pas été retirés : le contrôle porterait alors sur des ' +
        'phrases que personne ne lit.',
    );

    assert.ok(
      SANS_COMMENTAIRES.includes('Marquer comme traité'),
      'L’écran n’offre plus « Marquer comme traité » : ce banc ne mesure plus l’écran ' +
        'qu’il croit mesurer.',
    );
  });

  it('l’écran dit qu’un message traité reste à supprimer', () => {
    assert.ok(
      SANS_COMMENTAIRES.includes('supprim'),
      'L’écran ne dit nulle part qu’un message traité reste à supprimer. Cocher ' +
        '« traité » déclare le traitement terminé, et la page de confidentialité attache ' +
        'la suppression à ce moment : le bureau croirait le travail fini.',
    );
  });

  it('l’écran dit où cette suppression se fait', () => {
    assert.ok(
      SANS_COMMENTAIRES.includes('tableau de bord'),
      'L’écran dit qu’une suppression reste à faire, mais pas où : elle n’est possible ' +
        'que depuis le tableau de bord Supabase, et la page ne l’offre pas.',
    );
  });

  it('l’écran n’efface rien lui-même', () => {
    //  Cette assertion tient la décision, elle ne la décrit pas. Le jour où
    //  l'effacement depuis la page deviendrait souhaitable, l'échec forcera à
    //  rouvrir la question — l'irréversibilité, et la case à cocher voisine.
    assert.ok(
      !SANS_COMMENTAIRES.includes('.delete('),
      'L’écran appelle une suppression. Elle est irréversible et voisine d’une case à ' +
        'cocher : c’est un geste du tableau de bord, fait en connaissance de cause.',
    );
  });
});

/**
 * Le tri de la requête, et pourquoi il se vérifie.
 *
 * `listerMessages` met les non traités en tête. Ce n'est pas une préférence :
 * trier par date seule enterrerait un message ancien jamais traité sous dix
 * messages récents déjà lus — et c'est exactement celui qu'il ne faut pas
 * perdre. La page l'annonce au bureau, donc retourner ce tri rendrait la phrase
 * fausse.
 *
 * Rien ne le signalerait : ni le type, ni le compteur, ni l'affichage ne
 * dépendent de l'ordre. C'est la question à laquelle le code répond deux fois —
 * une fois dans la requête, une fois dans la phrase — et le banc porte donc sur
 * leur accord, pas sur l'un des deux.
 *
 * TROIS CHOSES, ET PAS UNE
 * ------------------------
 * Le motif exige la colonne, le sens, **et la position relative** des deux
 * clauses. C'est la position qui décide : PostgREST applique les `order` dans
 * l'ordre où ils sont écrits, donc intervertir les deux ferait trier par date
 * d'abord — et « les messages non traités sont en tête » deviendrait faux. Un
 * contrôle qui chercherait seulement la présence du tri sur `traite` resterait
 * vert sur cette inversion : c'est le trou qu'un premier jet de ce banc avait,
 * et il a été trouvé en écrivant la mutation, pas en relisant le motif.
 */
const ORDRE_TRAITE = /\.order\(\s*'traite'\s*,\s*\{\s*ascending:\s*true\s*\}\s*\)/;
const ORDRE_DATE = /\.order\(\s*'created_at'\s*,\s*\{\s*ascending:\s*false\s*\}\s*\)/;

describe('messages — l’ordre annoncé est bien celui de la requête', () => {
  it('la requête trie sur `traite` avant la date, dans le sens croissant', () => {
    const source = readFileSync(REQUETES, 'utf8');
    const debut = source.indexOf('export async function listerMessages');

    assert.notEqual(debut, -1, 'listerMessages a disparu de admin/src/lib/contenu.ts.');

    const fin = source.indexOf('\n}', debut);
    const corps = source.slice(debut, fin === -1 ? undefined : fin);

    assert.match(
      corps,
      ORDRE_TRAITE,
      'listerMessages ne trie plus les messages non traités en tête, ou les trie dans ' +
        'l’autre sens. La page l’annonce pourtant au bureau, et trier par date seule ' +
        'enterrerait un message ancien jamais traité sous des messages récents déjà lus.',
    );
    assert.match(
      corps,
      ORDRE_DATE,
      'listerMessages ne trie plus les messages du plus récent au plus ancien : le bureau ' +
        'lirait les nouveaux messages en bas de la liste.',
    );

    const positionTraite = corps.search(ORDRE_TRAITE);
    const positionDate = corps.search(ORDRE_DATE);

    assert.ok(
      positionTraite < positionDate,
      'Les deux `order` de listerMessages sont intervertis. PostgREST les applique dans ' +
        'l’ordre écrit : trier par date d’abord ferait passer un message ancien non traité ' +
        'sous les messages récents, et l’annonce de l’écran deviendrait fausse.',
    );
  });

  it('l’écran annonce ce tri, et pas un autre', () => {
    assert.ok(
      SANS_COMMENTAIRES.includes('non traités sont en tête'),
      'L’écran n’annonce plus que les messages non traités sont en tête. Si c’est ' +
        'volontaire, retirer cette assertion — mais alors la requête trie encore dans un ' +
        'ordre que personne ne lit, et c’est cet ordre qu’il faut revoir.',
    );
  });
});
