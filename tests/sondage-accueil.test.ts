/**
 * Ce que l'accueil propose, et ce qu'il en dit.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * La carte de sondage de l'accueil filtrait sur « sondage ouvert » et rien
 * d'autre. Elle ne lisait pas la mémoire locale des votes — seul `plus.tsx` la
 * lisait — si bien qu'un parent qui venait de répondre retrouvait, sur l'écran
 * qu'il ouvre le plus, la même invitation qu'avant : « Votre avis nous
 * intéresse », « Participer », et une indication promettant d'ouvrir le sondage
 * « pour répondre ». La carte de l'onglet Plus disait, du même sondage, « Votre
 * réponse est enregistrée. »
 *
 * Aucun contrôle ne pouvait le voir : la règle vivait dans `app/(tabs)/index.tsx`,
 * que rien ne peut charger — il importe React Native.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La partie 1 exerce la règle sur des cas : aucun sondage, sondage fermé par le
 * bureau, fermé par sa date, ouvert et jamais voté, ouvert et déjà voté, voté
 * sur un autre sondage, et la marque `CHOIX_INCONNU` — un vote dont la base n'a
 * pas dit le choix, qui doit compter comme une réponse.
 *
 * La partie 2 relit les sources privées de leurs commentaires, et c'est
 * nécessaire : l'en-tête de `index.tsx` parle des votes et de l'invitation, et
 * un contrôle qui chercherait un nom sans retirer les commentaires serait
 * satisfait par une phrase — c'est-à-dire par rien. Un banc ne peut pas rendre
 * `index.tsx` ni `SondageAccueil.tsx` : il lit donc la forme des appels, comme
 * `tests/vote-retenu.test.ts` et `tests/agenda-separation.test.ts`.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que l'écran se redessine. Le banc tient que l'accueil relit la mémoire locale
 * à chaque retour sur l'écran, et qu'il emploie la règle ; il ne peut pas
 * déclencher un changement d'onglet. C'est la forme de l'appel qui est tenue,
 * pas le rendu.
 *
 * Il lie aussi quelques NOMS — `invitation`, `lireVotesLocaux`,
 * `useFocusEffect`. Renommer l'un d'eux le fait rougir sans qu'aucun
 * comportement ait changé, et il faut alors le mettre à jour. C'est le prix
 * d'un contrôle de forme ; il est moindre que celui d'un contrôle qui
 * n'asserterait rien. Ce qui a été délibérément évité, c'est de lier le nom du
 * COMPOSANT : la carte peut être renommée, et le banc ne le voit pas.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  ACCROCHE_A_REPONDRE,
  ACCROCHE_DEJA_REPONDU,
  ACTION_CONSULTER,
  ACTION_REPONDRE,
  INDICATION_CONSULTER,
  INDICATION_REPONDRE,
  invitationAccueil,
} from '@/lib/sondage-accueil';
import { CHOIX_INCONNU } from '@/lib/votes-locaux';
import type { Sondage } from '@/types/models';

const RACINE = process.cwd();
const ECRAN = join(RACINE, 'app', '(tabs)', 'index.tsx');
const CARTE = join(RACINE, 'src', 'components', 'SondageAccueil.tsx');
const CARTE_PLUS = join(RACINE, 'src', 'components', 'SondageCard.tsx');

/** Un instant fixe : sans lui, un cas « clos » deviendrait « ouvert » un jour. */
const MAINTENANT = new Date('2026-09-19T12:00:00+02:00');
const DEMAIN = '2026-09-20T23:59:00+02:00';
const HIER = '2026-09-18T23:59:00+02:00';

const OUVERT = 'b1000000-0000-4000-8000-000000000001';
const AUTRE = 'b1000000-0000-4000-8000-000000000002';
const TROISIEME = 'b1000000-0000-4000-8000-000000000003';

const CHOIX_A = 'f1000000-0000-4000-8000-000000000001';

interface SondagePartiel {
  readonly id: string;
  readonly question?: string;
  readonly ouvert?: boolean;
  readonly clotureLe?: string | null;
}

/** Un sondage réduit à ce que la règle regarde. */
function sondage(partiel: SondagePartiel): Sondage {
  return {
    id: partiel.id,
    question: partiel.question ?? 'Souhaitez-vous une sortie scolaire en novembre ?',
    precisions: null,
    ouvert: partiel.ouvert ?? true,
    clotureLe: partiel.clotureLe ?? null,
    choix: [],
  };
}

/** Le source privé de ses commentaires, avant toute recherche de motif. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function lire(chemin: string): string {
  return sansCommentaires(readFileSync(chemin, 'utf8'));
}

const SOURCE_ECRAN = lire(ECRAN);
const SOURCE_CARTE = lire(CARTE);
const SOURCE_CARTE_PLUS = sansCommentaires(readFileSync(CARTE_PLUS, 'utf8'));

describe('L’accueil ne propose rien quand il n’y a rien à proposer', () => {
  it('rend null sans aucun sondage', () => {
    assert.equal(invitationAccueil([], {}, MAINTENANT), null);
  });

  it('rend null quand le bureau a fermé le sondage', () => {
    const ferme = sondage({ id: OUVERT, ouvert: false });
    assert.equal(invitationAccueil([ferme], {}, MAINTENANT), null);
  });

  it('rend null quand la date de clôture est passée', () => {
    const perime = sondage({ id: OUVERT, clotureLe: HIER });
    assert.equal(invitationAccueil([perime], {}, MAINTENANT), null);
  });

  it('rend null quand aucun sondage n’est ouvert, même s’il y en a plusieurs', () => {
    const liste = [sondage({ id: OUVERT, ouvert: false }), sondage({ id: AUTRE, clotureLe: HIER })];
    assert.equal(invitationAccueil(liste, {}, MAINTENANT), null);
  });
});

describe('Un sondage auquel on peut encore répondre', () => {
  const liste = [sondage({ id: OUVERT })];

  it('invite à répondre', () => {
    const invitation = invitationAccueil(liste, {}, MAINTENANT);

    assert.ok(invitation !== null, 'un sondage ouvert doit être proposé');
    assert.equal(invitation.accroche, ACCROCHE_A_REPONDRE);
    assert.equal(invitation.action, ACTION_REPONDRE);
    assert.equal(invitation.indication, INDICATION_REPONDRE);
  });

  it('propose bien le sondage de la liste, et pas un autre', () => {
    const invitation = invitationAccueil(liste, {}, MAINTENANT);

    assert.equal(invitation?.sondage.id, OUVERT);
  });

  it('accepte un sondage sans date de clôture', () => {
    const sansDate = [sondage({ id: OUVERT, clotureLe: null })];
    assert.notEqual(invitationAccueil(sansDate, {}, MAINTENANT), null);
  });

  it('accepte un sondage dont la clôture est encore à venir', () => {
    const aVenir = [sondage({ id: OUVERT, clotureLe: DEMAIN })];
    assert.notEqual(invitationAccueil(aVenir, {}, MAINTENANT), null);
  });

  it('juge la clôture à l’instant qu’on lui donne, et non à celui de la machine', () => {
    // Cette clôture est une heure APRÈS `MAINTENANT`, mais dans le passé pour
    // qui lit l'horloge. Sans ce cas, une règle qui ignorerait l'instant injecté
    // resterait verte : les autres dates sont trop loin de l'instant réel.
    const dansUneHeure = [sondage({ id: OUVERT, clotureLe: '2026-09-19T13:00:00+02:00' })];

    assert.notEqual(
      invitationAccueil(dansUneHeure, {}, MAINTENANT),
      null,
      'la règle doit lire l’instant qu’on lui passe, sinon ses cas dépendent du jour où on les lance',
    );
  });
});

describe('Un sondage auquel on a déjà répondu', () => {
  const liste = [sondage({ id: OUVERT })];

  it('ne propose plus de répondre, et le dit', () => {
    const invitation = invitationAccueil(liste, { [OUVERT]: CHOIX_A }, MAINTENANT);

    assert.ok(invitation !== null, 'le sondage reste proposé : on peut vouloir le relire');
    assert.equal(invitation.accroche, ACCROCHE_DEJA_REPONDU);
    assert.equal(invitation.action, ACTION_CONSULTER);
    assert.equal(invitation.indication, INDICATION_CONSULTER);
  });

  it('ne dit plus « Participer » d’aucune façon', () => {
    const invitation = invitationAccueil(liste, { [OUVERT]: CHOIX_A }, MAINTENANT);

    assert.notEqual(invitation?.action, ACTION_REPONDRE);
    assert.notEqual(invitation?.accroche, ACCROCHE_A_REPONDRE);
  });

  it('compte la marque d’un vote sans choix comme une réponse', () => {
    const invitation = invitationAccueil(liste, { [OUVERT]: CHOIX_INCONNU }, MAINTENANT);

    assert.equal(
      invitation?.accroche,
      ACCROCHE_DEJA_REPONDU,
      'la marque est la chaîne vide : un test de vérité la prendrait pour « rien de connu » ' +
        'et ferait réapparaître l’invitation à répondre',
    );
    assert.equal(invitation?.action, ACTION_CONSULTER);
  });

  it('ignore un vote déposé sur un autre sondage', () => {
    const invitation = invitationAccueil(liste, { [AUTRE]: CHOIX_A }, MAINTENANT);

    assert.equal(invitation?.accroche, ACCROCHE_A_REPONDRE);
    assert.equal(invitation?.action, ACTION_REPONDRE);
  });
});

describe('Le sondage retenu est le premier ouvert', () => {
  it('saute les sondages fermés qui le précèdent', () => {
    const liste = [
      sondage({ id: AUTRE, ouvert: false }),
      sondage({ id: OUVERT }),
      sondage({ id: TROISIEME }),
    ];

    assert.equal(invitationAccueil(liste, {}, MAINTENANT)?.sondage.id, OUVERT);
  });

  it('retient le plus récent quand plusieurs sont ouverts', () => {
    const liste = [sondage({ id: OUVERT }), sondage({ id: AUTRE })];

    assert.equal(invitationAccueil(liste, {}, MAINTENANT)?.sondage.id, OUVERT);
  });

  it('suit les votes du sondage qu’il a retenu, et non ceux d’un autre', () => {
    const liste = [sondage({ id: OUVERT }), sondage({ id: AUTRE })];

    assert.equal(
      invitationAccueil(liste, { [OUVERT]: CHOIX_A }, MAINTENANT)?.action,
      ACTION_CONSULTER,
    );
    assert.equal(
      invitationAccueil(liste, { [AUTRE]: CHOIX_A }, MAINTENANT)?.action,
      ACTION_REPONDRE,
    );
  });
});

describe('Les deux formulations ne peuvent pas se confondre', () => {
  it('les accroches diffèrent', () => {
    assert.notEqual(ACCROCHE_A_REPONDRE, ACCROCHE_DEJA_REPONDU);
  });

  it('les actions diffèrent', () => {
    assert.notEqual(ACTION_REPONDRE, ACTION_CONSULTER);
  });

  it('les indications diffèrent', () => {
    assert.notEqual(INDICATION_REPONDRE, INDICATION_CONSULTER);
  });
});

describe('L’écran d’accueil emploie la règle', () => {
  it('le source privé de ses commentaires est bien celui qu’on croit lire', () => {
    assert.ok(SOURCE_ECRAN.length > 500, 'le fichier lu est suspicieusement court');
    assert.ok(
      !SOURCE_ECRAN.includes('POURQUOI LES VOTES'),
      'le retrait des commentaires n’a pas eu lieu : toute recherche ci-dessous serait vaine',
    );
    assert.ok(
      SOURCE_ECRAN.includes("'annonces'"),
      'ce n’est pas l’écran d’accueil : la clé de chargement des actualités doit s’y trouver',
    );
  });

  it('lui passe la mémoire locale des votes', () => {
    assert.match(
      SOURCE_ECRAN,
      /import\s*\{[^}]*invitationAccueil[^}]*\}\s*from\s*'@\/lib\/sondage-accueil'/,
    );
    assert.match(
      SOURCE_ECRAN,
      /import\s*\{[^}]*lireVotesLocaux[^}]*\}\s*from\s*'@\/lib\/votes-locaux'/,
    );
    assert.match(
      SOURCE_ECRAN,
      // La virgule finale est facultative : Prettier en pose une dès que
      // l'appel s'étale sur plusieurs lignes, et un motif qui l'ignore
      // rougirait sur du code correct — donc serait affaibli au premier échec.
      /invitationAccueil\s*\(\s*sondages\.etat\.donnees\s*,\s*votes\s*,?\s*\)/,
      'la règle a besoin des deux : les sondages, et ce que l’appareil a voté',
    );
  });

  it('relit la mémoire locale à chaque retour sur l’écran', () => {
    assert.match(
      SOURCE_ECRAN,
      /useFocusEffect\s*\(/,
      'une lecture au seul montage ne suffit pas : l’écran reste monté pendant qu’on vote ' +
        'dans l’onglet Plus, et l’invitation redeviendrait fausse au retour',
    );
    assert.match(
      SOURCE_ECRAN,
      /await\s+lireVotesLocaux\s*\(\s*\)/,
      'la relecture doit lire la mémoire locale, sinon elle ne relit rien',
    );
  });

  it('n’a plus sa propre définition de « fermé »', () => {
    assert.doesNotMatch(
      SOURCE_ECRAN,
      /sondageFerme\s*\(/,
      'deux définitions de « clos » finiraient par diverger : celle de @/lib/sondage-accueil fait foi',
    );
  });

  it('affiche l’invitation de la règle, et non un sondage nu', () => {
    assert.match(
      SOURCE_ECRAN,
      /invitation\s*===\s*null\s*\?\s*null/,
      'rien à proposer, rien à montrer',
    );
    assert.match(
      SOURCE_ECRAN,
      /invitation=\{invitation\}/,
      'la carte doit recevoir l’invitation : c’est elle qui porte les mots',
    );
    assert.doesNotMatch(
      SOURCE_ECRAN,
      /sondageOuvert/,
      'la carte ne reçoit plus un sondage nu — c’est le défaut que ce banc corrige',
    );
  });
});

describe('La carte d’accueil ne réécrit pas les mots', () => {
  it('le source privé de ses commentaires est bien celui qu’on croit lire', () => {
    assert.ok(SOURCE_CARTE.length > 500, 'le fichier lu est suspicieusement court');
    assert.ok(
      !SOURCE_CARTE.includes('CE COMPOSANT NE CHOISIT'),
      'le retrait des commentaires n’a pas eu lieu : toute recherche ci-dessous serait vaine',
    );
    assert.ok(
      SOURCE_CARTE.includes('Sondage : '),
      'ce n’est pas la carte de sondage : son libellé accessible doit s’y trouver',
    );
  });

  it('n’écrit aucune des deux formulations en dur', () => {
    for (const mot of [ACCROCHE_A_REPONDRE, ACCROCHE_DEJA_REPONDU, ACTION_REPONDRE]) {
      assert.ok(
        !SOURCE_CARTE.includes(`'${mot}'`) && !SOURCE_CARTE.includes(`>${mot}<`),
        `« ${mot} » est écrit dans la carte : la règle ne pourrait plus en décider seule`,
      );
    }
  });

  it('emploie les mots que la règle lui donne', () => {
    assert.match(SOURCE_CARTE, /accroche\.toLocaleUpperCase\('fr-FR'\)/);
    assert.match(SOURCE_CARTE, /\{action\}/);
    assert.match(SOURCE_CARTE, /accessibilityHint=\{indication\}/);
  });
});

describe('Les deux écrans disent la même phrase', () => {
  it('l’accroche de l’accueil est la mention de la carte de l’onglet Plus', () => {
    assert.ok(
      SOURCE_CARTE_PLUS.includes(`${ACCROCHE_DEJA_REPONDU}.`),
      `la carte de l’onglet Plus doit écrire « ${ACCROCHE_DEJA_REPONDU}. » — ` +
        'deux écrans qui parlent du même vote ne peuvent pas le dire de deux façons',
    );
    assert.match(
      SOURCE_CARTE_PLUS,
      /Un vote a déjà été enregistré depuis cet appareil\./,
      'le cas du vote sans choix connu doit rester dit, lui aussi',
    );
  });
});
