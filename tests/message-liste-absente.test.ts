/**
 * Ce que la carte de liste annonce quand elle n'a rien à montrer.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * Les écrans d'administration — quatre à l'époque — affichaient tous
 * `<p>Chargement…</p>` dès que la liste était absente, c'est-à-dire dans DEUX
 * cas : la demande est en vol, ou elle a échoué. Dans le second, l'écran
 * annonçait un chargement qui n'arriverait jamais, pendant que le message
 * d'erreur s'affichait dans l'encadré du formulaire, juste au-dessus : deux
 * phrases contradictoires sur le même écran, et celle de la carte était fausse.
 *
 * Le défaut n'a été trouvé par aucun contrôle existant, et pour une raison qui
 * se dit en une phrase : **aucun ne regardait le texte.** `admin:check` relit
 * les écrans, mais il les confronte au SCHÉMA — colonnes, bornes, énumérations.
 * Le typecheck, lui, ne voit rien : les deux branches compilent. C'est un banc
 * qu'il fallait, pas une règle de plus.
 *
 * CE QU'IL MESURE, ET EN DEUX PARTIES
 * -----------------------------------
 * 1. **La règle elle-même.** `messageListeAbsente` est une fonction pure, sans
 *    React, et le banc l'interroge dans ses états. C'est la raison pour laquelle
 *    elle vit dans `admin/src/lib/message-liste.ts` et non dans
 *    `chargement.ts` : ce dernier importe `./erreurs` sans extension — ce que
 *    l'empaqueteur exige et ce que Node refuse pour un import relatif —, donc
 *    un banc ne peut pas le charger. Mesuré, pas supposé.
 *
 * 2. **L'accord avec les écrans.** Une fonction juste que plus personne
 *    n'appelle ne vaut rien, et le défaut était recopié quatre fois : c'est
 *    précisément ce qui l'avait rendu invisible. Le banc relit donc les écrans
 *    et exige que chacun appelle la règle.
 *
 * LA PARTIE 2 EST UN CONTRÔLE DE FORME, ET C'EST ASSUMÉ
 * -----------------------------------------------------
 * Elle lit des sources, pas un rendu : elle ne peut pas prouver que l'écran
 * affiche le bon texte, seulement qu'il n'en écrit pas un autre. Deux
 * assertions la rendent utile malgré cela :
 *
 *   - « aucun écran ne contient le littéral » porte sur TOUT le dossier, pas
 *     sur une liste de noms. Un cinquième écran ajouté demain est donc couvert
 *     sans qu'on touche à ce fichier. Une liste de noms, elle, ne verrait que
 *     ce qu'elle nomme.
 *   - la liste des écrans à liste est CLOSE, et une prémisse vérifie qu'elle
 *     n'est pas périmée : chacun montre bien une carte de liste. Sans cette
 *     prémisse, un écran renommé laisserait le banc passer en ne surveillant
 *     plus rien.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que `succes` n'atteint pas la fonction, ce qui est la seule raison pour
 * laquelle le troisième état peut renvoyer le texte de chargement. Cela repose
 * sur les quatre dérivations `etat.statut === 'succes' ? etat.donnees : null`,
 * que la partie 2 relève — mais relève, pas prouve : c'est la forme écrite qui
 * est lue, pas le comportement à l'exécution.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { messageListeAbsente } from '../admin/src/lib/message-liste.ts';

const RACINE = process.cwd();
const DOSSIER_ECRANS = join(RACINE, 'admin', 'src', 'ecrans');

/**
 * Le texte que l'utilisateur lit pendant que la demande est en vol.
 *
 * Il est écrit ici en toutes lettres, et non importé : c'est la spécification,
 * pas une copie de l'implémentation. Un banc qui lirait sa valeur attendue
 * depuis le fichier qu'il éprouve serait vert quoi qu'il arrive.
 */
const TEXTE_EN_VOL = 'Chargement…';

/**
 * Les écrans qui portent une carte de liste. Liste CLOSE, et vérifiée : la
 * prémisse plus bas exige que chacun montre bien une carte, faute de quoi cette
 * liste pourrait se périmer en silence.
 */
const ECRANS_A_LISTE = ['Agenda', 'Annonces', 'Cantine', 'Documents', 'Messages'] as const;

/** Les écrans qui n'ont pas de liste — cités pour que leur absence soit un fait. */
const SANS_LISTE = ['Connexion'] as const;

function sourceDe(nom: string): string {
  return readFileSync(join(DOSSIER_ECRANS, `${nom}.tsx`), 'utf8');
}

function ecransSurDisque(): readonly string[] {
  return readdirSync(DOSSIER_ECRANS)
    .filter((fichier) => fichier.endsWith('.tsx'))
    .sort();
}

describe('message de la carte de liste — les états qui l’atteignent', () => {
  it('annonce un chargement tant que la demande est en vol', () => {
    assert.equal(messageListeAbsente({ statut: 'chargement' }), TEXTE_EN_VOL);
  });

  it('annonce l’échec, et non un chargement, quand la demande a échoué', () => {
    // Le cœur du défaut corrigé : ces deux états disaient la même chose.
    const texte = messageListeAbsente({ statut: 'erreur', message: 'boum' });

    assert.notEqual(
      texte,
      TEXTE_EN_VOL,
      'Un échec ne peut pas annoncer un chargement : il n’arrivera jamais.',
    );
    assert.notEqual(texte.trim(), '', 'Un échec sans texte laisserait la carte muette.');
  });

  it('ne dit pas la même chose dans les deux états, quel que soit le message', () => {
    // Éprouvé sur un message d'erreur vide AUSSI : une implémentation qui
    // renverrait `etat.message` tel quel passerait le témoin précédent — « boum »
    // n'est pas « Chargement… » — tout en laissant la carte muette sur un échec
    // sans message. C'est le seul endroit du banc où la valeur du message
    // importe.
    for (const message of ['boum', '', '   ']) {
      assert.notEqual(
        messageListeAbsente({ statut: 'erreur', message }),
        TEXTE_EN_VOL,
        `Échec avec le message ${JSON.stringify(message)}.`,
      );
    }
  });
});

describe('accord avec les écrans — aucun n’écrit ce texte en clair', () => {
  it('n’annonce « Chargement… » nulle part dans le dossier des écrans', () => {
    // Sur tout le dossier, et non sur les quatre noms : c'est ce qui rend un
    // cinquième écran couvert sans modification de ce fichier.
    const ecrans = ecransSurDisque();
    assert.ok(ecrans.length >= 4, `prémisse : ${ecrans.length} écran(s) relu(s)`);

    const fautifs = ecrans.filter((fichier) =>
      readFileSync(join(DOSSIER_ECRANS, fichier), 'utf8').includes(TEXTE_EN_VOL),
    );

    assert.deepEqual(
      fautifs,
      [],
      `Ces écrans écrivent « ${TEXTE_EN_VOL} » en clair au lieu d’appeler ` +
        `messageListeAbsente : ${fautifs.join(', ')}.`,
    );
  });

  it('fait appeler la règle par chaque écran à liste', () => {
    for (const nom of ECRANS_A_LISTE) {
      const source = sourceDe(nom);

      assert.ok(
        source.includes("from '../lib/message-liste'"),
        `${nom} n’importe pas la règle depuis ../lib/message-liste.`,
      );
      assert.ok(
        source.includes('messageListeAbsente(etat)'),
        `${nom} n’appelle pas messageListeAbsente(etat) : sa carte de liste ne ` +
          'distingue plus un échec d’un chargement en vol.',
      );
    }
  });
});

describe('garde-fous de ce banc', () => {
  it('nomme des écrans qui existent, et qui montrent bien une carte de liste', () => {
    // Sans cette prémisse, un écran renommé ferait échouer la lecture — ou, si
    // l'on s'en remettait au disque, ferait passer le banc en ne surveillant
    // plus rien. La liste close n'est légitime que si elle est vérifiée.
    for (const nom of ECRANS_A_LISTE) {
      const source = sourceDe(nom);
      assert.ok(
        source.includes('className="vide"'),
        `${nom} est nommé comme écran à liste, mais n’en montre plus.`,
      );
    }
  });

  it('nomme les écrans sans liste, qui n’ont donc pas à appeler la règle', () => {
    for (const nom of SANS_LISTE) {
      const source = sourceDe(nom);
      assert.ok(
        !source.includes('className="vide"'),
        `${nom} est cité comme sans liste, mais en montre une : il doit rejoindre ` +
          'ECRANS_A_LISTE et appeler la règle.',
      );
    }
  });

  it('couvre tous les écrans du dossier, pour qu’aucun ne passe entre les mailles', () => {
    const noms = ecransSurDisque().map((fichier) => fichier.replace(/\.tsx$/, ''));
    const connus = [...ECRANS_A_LISTE, ...SANS_LISTE].sort();

    assert.deepEqual(
      noms,
      connus,
      'Un écran n’est ni dans ECRANS_A_LISTE ni dans SANS_LISTE : décider dans ' +
        'lequel il va, plutôt que de le laisser hors du banc.',
    );
  });
});
