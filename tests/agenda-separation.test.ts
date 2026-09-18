/**
 * La séparation entre « à venir » et « passés », dans l'agenda.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * L'en-tête de `app/(tabs)/agenda.tsx` promet qu'un événement en cours reste
 * visible : « une réunion de 18 h à 20 h n'est pas terminée à 19 h », et une
 * sortie scolaire de la journée non plus. Les deux listes, elles, étaient
 * bornées par `new Date()`, c'est-à-dire par l'instant courant.
 *
 * Le résultat a été mesuré, écran ouvert à 10 h puis à 19 h :
 *
 *   - à 10 h, une sortie scolaire du jour saisie « journée entière » rendait
 *     `enCours = true`, `passe = false` — et se trouvait sous **PASSÉS** ;
 *   - à 19 h, la réunion de 18 h – 20 h rendait `enCours = true`,
 *     `passe = false` — et se trouvait aussi sous **PASSÉS**.
 *
 * La pastille « En ce moment » se lit pourtant dans la carte, donc dans la
 * liste : ces deux événements s'affichaient atténués, sans marque, dans la
 * liste où personne ne les cherche. C'est exactement ce que l'en-tête
 * interdisait.
 *
 * Deux causes, et deux réparations :
 *
 *   1. la **borne** était l'instant courant. Elle est maintenant le premier
 *      instant du jour (`debutDuJour`), et les deux listes la partagent ;
 *   2. le **repère de fin** d'une journée entière sans heure de fin était son
 *      début. C'est maintenant la fin de son jour (`referenceDeFin`), sans quoi
 *      « toute la journée » ne voulait rien dire.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * La partie 1 relit le filtre TEL QU'IL EST ÉCRIT dans le service, et vérifie
 * qu'il partitionne les instants : chaque début tombe dans une liste, et dans
 * une seule. Un `.gt` au lieu de `.gte` laisserait l'instant de la borne dans
 * aucune des deux listes ; un `.lte` le mettrait dans les deux. Le banc refuse
 * les deux, et refuse aussi une borne prise sur `fin_le` — `fin_le` est
 * facultatif, un tel filtre écarterait la plupart des événements.
 *
 * La partie 2 emploie les vraies fonctions de `@/utils/date` sur un corpus
 * d'instants, et exige l'accord entre les deux moitiés : ce qui est marqué
 * « en ce moment » doit se trouver dans la liste où la marque s'affiche.
 *
 * La partie 3 lit les sources. Un banc ne peut pas rendre `app/(tabs)/agenda.tsx`,
 * qui importe React Native : il lit donc la forme des appels, comme
 * `tests/diagnostic.test.ts` et `tests/adresse-reponse.test.ts`.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la base réponde. Le banc modélise la comparaison de PostgREST ; il
 * établit que ce que le code demande partitionne les instants, pas que la base
 * rend ce qu'il demande. C'est le rôle de `verifier:requetes`, qui exige que le
 * filtre reste dans les opérateurs qu'il sait relire (`.eq`, `.gte`, `.gt`,
 * `.lte`, `.lt`, `.neq`) — un filtre composé sortirait de sa portée.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import { debutDuJour, estEnCours, estPasse } from '@/utils/date';

const RACINE = process.cwd();
const SERVICE = join(RACINE, 'src', 'services', 'agenda.ts');
const ECRAN = join(RACINE, 'app', '(tabs)', 'agenda.tsx');

/**
 * Les opérateurs de comparaison que PostgREST accepte, et que
 * `scripts/verifier-requetes-app.mjs` sait relire. La liste est fermée : un
 * opérateur hors de ces six ferait échouer le contrôle d'intégration, qui ne
 * saurait plus ce que la requête sélectionne.
 */
const OPERATEURS: Readonly<Record<string, (a: number, b: number) => boolean>> = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => a > b,
  gte: (a, b) => a >= b,
  lt: (a, b) => a < b,
  lte: (a, b) => a <= b,
};

interface Filtre {
  readonly colonne: string;
  readonly operateur: string;
}

/** Le source privé de ses commentaires, avant toute recherche de motif. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/**
 * Le filtre tel qu'il est écrit dans le service.
 *
 * Le banc ne le suppose pas, il le relit : c'est ce qui lui permet de porter
 * sur ce que le code demande vraiment. Coder les opérateurs en dur ici ferait
 * passer le banc alors même que le service aurait changé.
 */
function filtreDe(fonction: string): Filtre {
  const source = readFileSync(SERVICE, 'utf8');
  const debut = source.indexOf(`export async function ${fonction}`);
  assert.ok(debut >= 0, `« ${fonction} » a disparu de src/services/agenda.ts`);

  const fin = source.indexOf('\n}', debut);
  assert.ok(fin > debut, `le corps de « ${fonction} » est introuvable — analyse impossible`);

  // Tous les filtres, et non le premier : un second filtre changerait ce que la
  // liste contient sans que le banc s'en aperçoive, et `verifier:requetes` le
  // relirait sans broncher. Le banc refuse donc d'en voir plus d'un.
  const filtres = [
    ...source.slice(debut, fin).matchAll(/\.(eq|neq|gt|gte|lt|lte)\(\s*'([a-z_]+)'\s*,/g),
  ];

  assert.equal(
    filtres.length,
    1,
    `« ${fonction} » porte ${filtres.length} filtres : le banc n'en relit qu'un, et ` +
      'le classement ne serait plus celui qu’il éprouve.',
  );
  assert.ok(
    filtres[0] !== undefined,
    `« ${fonction} » ne filtre plus sur une colonne : la liste n'est plus bornée, ` +
      'et le contrôle d’intégration ne peut plus éprouver la requête.',
  );

  const operateur = filtres[0][1] ?? '';
  const colonne = filtres[0][2] ?? '';
  assert.ok(
    OPERATEURS[operateur] !== undefined,
    `opérateur « ${operateur} » hors de ceux que PostgREST et verifier:requetes ` +
      'comprennent : le banc ne peut pas dire ce que la requête sélectionne.',
  );
  return { colonne, operateur };
}

const AVENIR = filtreDe('listerProchainsEvenements');
const PASSES = filtreDe('listerEvenementsPasses');

/** Ce que la base rendrait, pour un début et une borne donnés. */
function dansLaListe(filtre: Filtre, debutLe: string, borne: Date): boolean {
  const comparaison = OPERATEURS[filtre.operateur];
  assert.ok(comparaison !== undefined, `opérateur « ${filtre.operateur} » sans comparaison`);
  return comparaison(new Date(debutLe).getTime(), borne.getTime());
}

/** Une date LOCALE, comme l'écran la construit — jamais lue en UTC. */
function local(mois: number, jour: number, heures = 0, minutes = 0, secondes = 0): Date {
  return new Date(2026, mois - 1, jour, heures, minutes, secondes);
}

/** Des débuts d'événements, de part et d'autre du jour courant. */
const DEBUTS: readonly Date[] = [
  local(9, 1, 8, 0),
  local(9, 21, 23, 59),
  local(9, 22, 0, 0),
  local(9, 22, 8, 0),
  local(9, 22, 18, 0),
  local(9, 22, 20, 0),
  local(9, 22, 23, 59),
  local(9, 23, 0, 0),
  local(9, 30, 9, 0),
];

/**
 * Des instants où le parent ouvre l'application.
 *
 * Les bords du jour y sont, et pas seulement le milieu : c'est à minuit et à
 * 23 h 59 que la borne se trompe si elle est prise sur l'instant courant.
 */
const MAINTENANTS: readonly Date[] = [
  local(9, 22, 0, 0, 1),
  local(9, 22, 10, 0),
  local(9, 22, 19, 0),
  local(9, 22, 23, 59),
  local(9, 23, 0, 0, 0),
];

describe('la séparation — deux listes, et un seul classement possible', () => {
  it('les deux listes filtrent la même colonne, et c’est le début', () => {
    // `fin_le` est facultatif : filtrer dessus écarterait tous les événements
    // sans heure de fin, c'est-à-dire une bonne part d'entre eux — dont les
    // sorties scolaires, qui sont justement celles qu'on veut voir.
    assert.equal(AVENIR.colonne, 'debut_le', '« à venir » ne filtre plus sur le début');
    assert.equal(PASSES.colonne, 'debut_le', '« passés » ne filtre plus sur le début');
  });

  it('la borne est incluse en bas et exclue en haut', () => {
    // C'est le couple qui partitionne. `.gt` laisserait l'instant de la borne
    // dans aucune des deux listes ; `.lte` le mettrait dans les deux. Dans les
    // deux cas, un événement démarrant exactement à la borne s'afficherait deux
    // fois ou pas du tout.
    assert.equal(AVENIR.operateur, 'gte', 'la borne basse n’est plus inclusive');
    assert.equal(PASSES.operateur, 'lt', 'la borne haute n’est plus exclusive');
  });

  it('classe chaque début dans exactement une liste', () => {
    for (const maintenant of MAINTENANTS) {
      const borne = debutDuJour(maintenant);
      for (const debut of DEBUTS) {
        const aVenir = dansLaListe(AVENIR, debut.toISOString(), borne);
        const passe = dansLaListe(PASSES, debut.toISOString(), borne);
        assert.notEqual(
          aVenir,
          passe,
          `le début du ${debut.toISOString()} tombe dans ` +
            `${aVenir ? 'les deux listes' : 'aucune liste'} quand l'application ` +
            `s'ouvre le ${maintenant.toISOString()}`,
        );
      }
    }
  });

  it('n’envoie jamais dans « passés » un événement qui commence aujourd’hui', () => {
    // Le défaut, à sa place exacte. À 10 h, la sortie scolaire du jour était
    // classée dans « passés » ; à 19 h, la réunion de 18 h aussi. Le parent les
    // cherchait dans « à venir », où l'écran promet de les montrer.
    for (const maintenant of MAINTENANTS) {
      const borne = debutDuJour(maintenant);
      const premierInstantDuJour = local(maintenant.getMonth() + 1, maintenant.getDate());
      assert.equal(
        dansLaListe(AVENIR, premierInstantDuJour.toISOString(), borne),
        true,
        `un événement du jour même est absent de « à venir » quand l'application ` +
          `s'ouvre le ${maintenant.toISOString()}`,
      );
    }
  });

  it('envoie dans « passés » tout ce qui commence la veille', () => {
    for (const maintenant of MAINTENANTS) {
      const borne = debutDuJour(maintenant);
      const veille = new Date(maintenant.getTime());
      veille.setDate(veille.getDate() - 1);
      const debut = local(veille.getMonth() + 1, veille.getDate(), 23, 59);
      assert.equal(
        dansLaListe(PASSES, debut.toISOString(), borne),
        true,
        `un événement de la veille n'est pas dans « passés » quand l'application ` +
          `s'ouvre le ${maintenant.toISOString()}`,
      );
    }
  });

  it('la borne est le début du jour, et non l’instant courant', () => {
    // Le geste qui répare. Comparer à `new Date()` est ce qui rendait les deux
    // cas ci-dessus faux ; ce test échoue si on y revient.
    const maintenant = local(9, 22, 19, 0);
    const borne = debutDuJour(maintenant);

    assert.equal(borne.getTime(), local(9, 22).getTime(), 'la borne n’est plus le début du jour');
    assert.ok(
      borne.getTime() < maintenant.getTime(),
      'la borne est confondue avec l’instant courant : tout ce qui a commencé ' +
        'repasse dans « passés ».',
    );
  });
});

describe('les deux moitiés s’accordent — marquée, donc visible', () => {
  const maintenant = local(9, 22, 19, 0);
  const borne = debutDuJour(maintenant);

  it('marque « en ce moment » une réunion commencée, et la laisse dans « à venir »', () => {
    const debut = local(9, 22, 18, 0).toISOString();
    const fin = local(9, 22, 20, 0).toISOString();

    assert.equal(estEnCours(debut, fin, false, maintenant), true);
    assert.equal(estPasse(debut, fin, false, maintenant), false);
    assert.equal(
      dansLaListe(AVENIR, debut, borne),
      true,
      'la réunion est marquée « en ce moment » mais rangée dans « passés » : la ' +
        'marque ne s’affiche pas là où le parent la cherche.',
    );
  });

  it('marque une journée entière du jour même, et la laisse dans « à venir »', () => {
    // La sortie scolaire, mesurée à 10 h puis à 19 h. Sans la fin de journée
    // comme repère, elle était atténuée et sans marque le jour même.
    const debut = local(9, 22).toISOString();

    assert.equal(estEnCours(debut, null, true, maintenant), true);
    assert.equal(estPasse(debut, null, true, maintenant), false);
    assert.equal(dansLaListe(AVENIR, debut, borne), true);
  });

  it('atténue une journée entière d’hier, et la range dans « passés »', () => {
    const debut = local(9, 21).toISOString();

    assert.equal(estPasse(debut, null, true, maintenant), true);
    assert.equal(estEnCours(debut, null, true, maintenant), false);
    assert.equal(dansLaListe(PASSES, debut, borne), true);
  });

  it('tient une journée entière du jour jusqu’à la dernière minute', () => {
    // 23 h 59 : la journée n'est pas finie. C'est le bord qui prouve que
    // « toute la journée » veut dire quelque chose.
    const debut = local(9, 22, 8, 0).toISOString();
    const tard = local(9, 22, 23, 59);

    assert.equal(estEnCours(debut, null, true, tard), true);
    assert.equal(dansLaListe(AVENIR, debut, debutDuJour(tard)), true);
  });
});

describe('accord avec l’écran et le service', () => {
  const ecran = readFileSync(ECRAN, 'utf8');
  const ecranNu = sansCommentaires(ecran);
  const serviceNu = sansCommentaires(readFileSync(SERVICE, 'utf8'));

  it('l’écran borne les deux listes avec le début du jour', () => {
    assert.match(
      ecranNu,
      /const borne = debutDuJour\(\)\.toISOString\(\)/,
      'L’écran ne borne plus les listes avec le début du jour : tout ce qui a ' +
        'commencé repasse dans « passés ».',
    );
    assert.doesNotMatch(
      ecranNu,
      /new Date\(\)/,
      'L’écran est revenu à l’instant courant comme borne.',
    );
  });

  it('les deux branches reçoivent la même borne', () => {
    // Une seule variable pour les deux listes : c'est ce qui interdit le trou
    // comme le recouvrement. Deux bornes calculées séparément pourraient
    // diverger d'une milliseconde, et un événement démarrant entre les deux
    // n'apparaîtrait nulle part.
    assert.match(
      ecranNu,
      /listerProchainsEvenements\(\s*borne\s*\)/,
      '« à venir » ne reçoit plus la borne partagée.',
    );
    assert.match(
      ecranNu,
      /listerEvenementsPasses\(\s*borne\s*\)/,
      '« passés » ne reçoit plus la borne partagée.',
    );
  });

  it('la carte passe la journée entière aux deux jugements', () => {
    // Deux appels à deux arguments compilaient sans rien dire, et rendaient
    // faux le marquage d'une sortie scolaire saisie « journée entière ».
    assert.match(
      ecranNu,
      /estEnCours\(\s*evenement\.debutLe\s*,\s*evenement\.finLe\s*,\s*evenement\.journeeEntiere\s*\)/,
      '`estEnCours` ne reçoit plus `journeeEntiere` : une journée entière sans ' +
        'heure de fin est tenue pour terminée dès son premier instant.',
    );
    assert.match(
      ecranNu,
      /estPasse\(\s*evenement\.debutLe\s*,\s*evenement\.finLe\s*,\s*evenement\.journeeEntiere\s*\)/,
      '`estPasse` ne reçoit plus `journeeEntiere`.',
    );
  });

  it('le service ne lit pas l’horloge', () => {
    // Une fonction qui lit l'horloge ne se laisse pas éprouver — et c'est
    // précisément ce qui a laissé passer le défaut : la borne était calculée
    // dans l'écran, à un endroit que rien ne regardait. La borne doit rester un
    // paramètre.
    assert.doesNotMatch(
      serviceNu,
      /new Date\(/,
      'Le service lit l’horloge : sa borne n’est plus injectable, et le banc ne ' +
        'peut plus éprouver le classement.',
    );
  });
});
