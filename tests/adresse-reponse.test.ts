/**
 * L'adresse de réponse : la règle de l'écran, et son accord avec le schéma.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `app/(tabs)/contact.tsx` annonçait, en tête de fichier, que la validation
 * restait permissive et que « une adresse erronée se voit immédiatement à
 * l'absence de réponse ». C'était vrai du fond, faux du formulaire : la base
 * impose sur `reponse_a` une forme plausible
 *
 *   reponse_a is null or reponse_a ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
 *
 * et l'écran, lui, n'en vérifiait rien. Un parent qui écrivait son numéro de
 * téléphone à cette place remplissait tout, appuyait sur « Envoyer », et
 * recevait « Une erreur est survenue pendant le chargement » — un message qui ne
 * parle ni d'adresse ni de format, et qui l'invitait à réessayer, ce qui
 * échouait à l'identique.
 *
 * CE QUE LE BANC TIENT, ET QUI EST LE POINT DIFFICILE
 * ---------------------------------------------------
 * Recopier un motif d'un schéma dans un écran crée deux règles qui peuvent
 * diverger en silence. Le banc ne se contente donc pas de vérifier que le motif
 * « a l'air bon » : il RELIT le motif dans la migration, le traduit, et exige
 * que les deux rendent le MÊME verdict sur un corpus — dans les deux sens.
 *
 *   - Recopier plus LARGE (accepter ce que la base refuse) rend le message
 *     impossible à envoyer, et l'erreur incompréhensible : c'est le défaut
 *     d'origine.
 *   - Recopier plus ÉTROIT (refuser ce que la base accepte) est un défaut
 *     symétrique, et moins visible : le parent voit « adresse invalide » sur une
 *     adresse valide. Le corpus contient donc des valeurs que seul un motif
 *     strict rejetterait — `a@b.c`, `JEAN@EXEMPLE.FR` — pour que ce sens-là
 *     échoue aussi.
 *
 * La règle est jugée sur la valeur NORMALISÉE, celle qui part réellement. C'est
 * nécessaire : la base applique `btrim`, qui ne retire que des espaces, là où
 * `trim()` de JavaScript retire aussi tabulations et retours à la ligne. Juger
 * la saisie brute ferait diverger les deux sur une adresse précédée d'une
 * tabulation. Le banc reproduit donc `btrim` pour poser la bonne question.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la base se comporte comme le dit son schéma : le motif est lu dans la
 * migration, pas observé sur la base réelle. `npm run verifier:requetes` est le
 * contrôle qui parle du schéma déployé.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

import {
  adresseReponseAcceptable,
  MOTIF_ADRESSE_REPONSE,
  normaliserAdresseReponse,
} from '@/lib/adresse-reponse';

const RACINE = process.cwd();
const MIGRATION = join(RACINE, 'supabase', 'migrations', '20260917120000_init.sql');
const ECRAN_CONTACT = join(RACINE, 'app', '(tabs)', 'contact.tsx');

/**
 * Le corpus. Chaque valeur est là pour une raison, et les raisons sont des deux
 * côtés de la règle : un corpus qui ne contiendrait que des refus ne verrait pas
 * un motif devenu trop strict.
 */
const ACCEPTEES = [
  'jean.dupont@exemple.fr',
  'marie-claire.o@exemple.co.uk',
  'JEAN@EXEMPLE.FR', // la casse est ignorée des deux côtés (`~*`, `i`)
  'a@b.c', // un domaine d'une lettre : valide ici, refusé par un motif « réaliste »
  'jean+ecole@exemple.fr',
] as const;

const REFUSEES = [
  '0612345678', // le cas d'origine : un numéro de téléphone à cette place
  'jean@exemple', // pas de point
  'jean.dupont', // pas d'arobase
  'jean dupont@exemple.fr', // une espace au milieu
  '@exemple.fr', // rien avant l'arobase
  'jean@@exemple.fr',
  'jean@exemple.', // rien après le point
  'jean@.fr',
] as const;

/** Le motif, tel qu'il est écrit dans la migration. */
function motifEcritDansLaMigration(): string {
  const sql = readFileSync(MIGRATION, 'utf8');
  const trouve = sql.match(/reponse_a\s+~\*\s+'([^']+)'/);
  assert.ok(
    trouve !== null,
    'Le motif de `messages_reponse_format` n’a pas été trouvé dans la migration. ' +
      'Le banc ne peut plus comparer les deux règles — il échoue plutôt que de ' +
      'laisser croire à un accord.',
  );

  const motif = trouve[1];
  assert.ok(motif !== undefined && motif !== '', 'Le motif lu dans la migration est vide.');
  return motif;
}

/**
 * Le motif du schéma, transcrit pour JavaScript.
 *
 * `[:space:]` n'existe pas en JavaScript : la classe POSIX est remplacée par ses
 * six caractères. La traduction est faite ici, et non recopiée à la main, pour
 * que ce soit bien le motif de la migration qui soit éprouvé.
 */
function motifTraduit(): RegExp {
  const source = motifEcritDansLaMigration().replace(/\[:space:\]/g, ' \\t\\n\\v\\f\\r');
  return new RegExp(source, 'i');
}

/**
 * `btrim` de PostgreSQL : retire les ESPACES en tête et en queue, rien d'autre.
 *
 * La distinction avec `trim()` de JavaScript n'est pas cosmétique — c'est elle
 * qui impose de juger la valeur normalisée.
 */
function btrim(valeur: string): string {
  return valeur.replace(/^ +/, '').replace(/ +$/, '');
}

/**
 * Ce que la base accepte, pour la valeur qu'on lui donne.
 *
 * La fonction d'envoi fait `nullif(btrim(coalesce(p_reponse_a, '')), '')` : une
 * valeur vide devient `null`, et la contrainte autorise `null`.
 */
function baseAccepte(valeur: string): boolean {
  const apres = btrim(valeur);
  return apres === '' || motifTraduit().test(apres);
}

/** Le texte d'un écran, découpé entre deux ancres, pour cadrer un contrôle. */
function entre(source: string, debut: string, fin: string): string {
  const d = source.indexOf(debut);
  assert.ok(d >= 0, `« ${debut} » introuvable — analyse impossible`);
  const f = source.indexOf(fin, d + debut.length);
  assert.ok(f > d, `« ${fin} » introuvable après « ${debut} » — analyse impossible`);
  return source.slice(d, f);
}

/**
 * Le contrôle d'adresse, découpé en trois : sa condition, la branche du refus,
 * celle de l'acceptation.
 *
 * Découper plutôt que chercher dans le fichier entier, parce que « l'appel est
 * là » ne dit rien de son SIGNE. `if (adresseReponseAcceptable(adresse))` — sans
 * le `!` — contient exactement les mêmes sous-chaînes que la version correcte, et
 * refuserait toutes les adresses valides. Seule la structure le montre.
 */
function controleAdresse(source: string): {
  readonly condition: string;
  readonly refus: string;
  readonly accepte: string;
} {
  const marqueur = 'adresseReponseAcceptable(adresse)';
  const appel = source.indexOf(marqueur);
  assert.ok(appel >= 0, 'l’envoi n’appelle plus `adresseReponseAcceptable(adresse)`.');

  const debut = source.lastIndexOf('if (', appel);
  assert.ok(debut >= 0, 'l’appel n’est plus dans une condition — analyse impossible.');

  const ouvreRefus = source.indexOf('{', appel);
  assert.ok(ouvreRefus > appel, 'la branche du refus est introuvable.');
  const fermeRefus = source.indexOf('}', ouvreRefus);
  assert.ok(fermeRefus > ouvreRefus, 'la branche du refus n’est pas fermée.');

  const sinon = source.indexOf('else', fermeRefus);
  assert.ok(sinon > fermeRefus, 'il n’y a plus de branche « accepté ».');
  const ouvreAccepte = source.indexOf('{', sinon);
  const fermeAccepte = source.indexOf('}', ouvreAccepte);
  assert.ok(fermeAccepte > ouvreAccepte, 'la branche « accepté » n’est pas fermée.');

  return {
    condition: source.slice(debut, ouvreRefus),
    refus: source.slice(ouvreRefus, fermeRefus),
    accepte: source.slice(ouvreAccepte, fermeAccepte),
  };
}

describe('adresseReponseAcceptable — ce que l’écran accepte', () => {
  for (const valeur of ACCEPTEES) {
    it(`accepte ${valeur}`, () => {
      assert.equal(adresseReponseAcceptable(valeur), true);
    });
  }

  for (const valeur of REFUSEES) {
    it(`refuse ${valeur}`, () => {
      assert.equal(adresseReponseAcceptable(valeur), false);
    });
  }

  it('accepte un champ vide : l’adresse est facultative', () => {
    // Ce n'est pas une tolérance, c'est le cas normal : la contrainte autorise
    // `null`, et l'écran envoie `null` quand rien n'est saisi.
    assert.equal(adresseReponseAcceptable(''), true);
    assert.equal(normaliserAdresseReponse(''), null);
  });

  it('accepte une saisie entourée d’espaces, parce que ce n’est pas elle qui part', () => {
    assert.equal(adresseReponseAcceptable('  jean.dupont@exemple.fr  '), true);
    assert.equal(normaliserAdresseReponse('  jean.dupont@exemple.fr  '), 'jean.dupont@exemple.fr');
  });

  it('accepte une adresse précédée d’une tabulation, et la normalise', () => {
    // Le cas qui oblige à juger la valeur normalisée : `btrim` ne retirerait pas
    // cette tabulation, donc la base refuserait la saisie brute. Comme c'est la
    // valeur nettoyée qui part, les deux règles restent d'accord.
    assert.equal(adresseReponseAcceptable('\tjean.dupont@exemple.fr'), true);
    assert.equal(normaliserAdresseReponse('\tjean.dupont@exemple.fr'), 'jean.dupont@exemple.fr');
  });

  it('un champ fait uniquement d’espaces vaut un champ vide', () => {
    assert.equal(adresseReponseAcceptable('   '), true);
    assert.equal(normaliserAdresseReponse('   '), null);
  });
});

describe('accord avec le schéma — la règle est la même des deux côtés', () => {
  it('le motif du module est bien celui de la migration', () => {
    // Première barrière, et la plus simple : si quelqu'un « améliore » le motif
    // sans toucher à la migration, l'écart se voit ici avant tout le reste.
    assert.equal(
      MOTIF_ADRESSE_REPONSE.source,
      motifTraduit().source,
      'Le motif recopié dans `src/lib/adresse-reponse.ts` n’est plus celui du ' +
        'schéma. L’écran ne peut pas promettre ce que la base refuse — ni ' +
        'refuser ce qu’elle accepte.',
    );

    // Les drapeaux se comparent à part : `.source` ne les contient pas. Ici le
    // `i` est sans effet — le motif ne contient aucune lettre, seulement `@` et
    // un point — mais le schéma écrit `~*`, et une recopie qui perdrait la casse
    // ignorerait une différence entre les deux règles. Un contrôle qui ne peut
    // rien affirmer n'a pas à passer.
    assert.equal(
      MOTIF_ADRESSE_REPONSE.flags,
      motifTraduit().flags,
      'Les drapeaux du motif recopié ne sont plus ceux du schéma : `~*` en SQL, ' + '`i` ici.',
    );
  });

  it('les deux règles rendent le même verdict sur tout le corpus', () => {
    const ecarts: string[] = [];

    for (const valeur of [...ACCEPTEES, ...REFUSEES, '', '   ', '  jean.dupont@exemple.fr  ']) {
      const coteEcran = adresseReponseAcceptable(valeur);
      const envoye = normaliserAdresseReponse(valeur);
      // La question posée à la base est celle de la valeur qui part, jamais de
      // la saisie : c'est la seule formulation où les deux règles doivent
      // tomber d'accord.
      const coteBase = baseAccepte(envoye ?? '');

      if (coteEcran !== coteBase) {
        ecarts.push(`${JSON.stringify(valeur)} : écran=${coteEcran}, base=${coteBase}`);
      }
    }

    assert.deepEqual(
      ecarts,
      [],
      `L’écran et la base ne jugent pas la même chose :\n  ${ecarts.join('\n  ')}`,
    );
  });

  it('le corpus contient de quoi détecter un motif trop STRICT', () => {
    // Un motif qui exigerait un domaine de deux lettres, ou qui ignorerait la
    // casse, refuserait ces valeurs — que la base accepte. Sans elles dans le
    // corpus, ce sens-là de l'erreur passerait inaperçu.
    assert.ok(ACCEPTEES.includes('a@b.c'), 'aucune valeur à domaine court dans le corpus');
    assert.ok(ACCEPTEES.includes('JEAN@EXEMPLE.FR'), 'aucune valeur en majuscules dans le corpus');

    for (const valeur of ACCEPTEES) {
      assert.equal(
        baseAccepte(valeur),
        true,
        `${valeur} figure parmi les acceptées, mais la migration la refuse : ` +
          'le corpus décrit un accord qui n’existe pas.',
      );
    }
  });

  it('le corpus contient de quoi détecter un motif trop LARGE', () => {
    for (const valeur of REFUSEES) {
      assert.equal(
        baseAccepte(valeur),
        false,
        `${valeur} figure parmi les refusées, mais la migration l’accepte : ` +
          'le corpus décrit un accord qui n’existe pas.',
      );
    }
  });

  it('le corpus n’est pas vide — un accord sur rien ne prouve rien', () => {
    assert.ok(ACCEPTEES.length >= 5, 'corpus d’acceptées trop maigre');
    assert.ok(REFUSEES.length >= 5, 'corpus de refusées trop maigre');
  });
});

describe('accord avec l’écran — la règle est appliquée, et sur la bonne valeur', () => {
  const source = readFileSync(ECRAN_CONTACT, 'utf8');

  it('l’écran importe la règle au lieu de la réécrire', () => {
    assert.ok(
      source.includes("from '@/lib/adresse-reponse'"),
      'contact.tsx n’importe plus la règle : une règle recopiée dans l’écran ' +
        'n’est plus tenue par ce banc.',
    );
    assert.ok(
      !/\[\^@/.test(source),
      'contact.tsx contient un motif d’adresse écrit à la main. La règle doit ' +
        'rester dans `src/lib/adresse-reponse.ts`, seul endroit que le banc ' +
        'compare au schéma.',
    );
  });

  it('l’envoi juge la valeur normalisée, et envoie celle-là', () => {
    const corps = entre(source, 'const envoyer = useCallback(', 'return (');

    assert.ok(
      corps.includes('normaliserAdresseReponse(adresse)'),
      'l’envoi ne normalise plus l’adresse : la valeur jugée et la valeur ' +
        'envoyée ne sont plus la même.',
    );
    assert.ok(
      corps.includes('reponseA: adresseEnvoyee'),
      'l’envoi ne passe plus la valeur normalisée à `reponseA`.',
    );
    assert.ok(
      !corps.includes('adresse.trim()'),
      'l’envoi retire l’adresse lui-même : deux normalisations séparées ' +
        'finissent par diverger.',
    );
  });

  it('le refus est bien la branche NÉGATIVE, et il bloque l’envoi', () => {
    const { condition, refus } = controleAdresse(source);

    assert.match(
      condition,
      /!\s*adresseReponseAcceptable\(\s*adresse\s*\)/,
      'la condition n’est plus niée : `adresseReponseAcceptable` vrai voudrait ' +
        'alors dire « refuser », et toutes les adresses valides seraient ' +
        'repoussées. Le signe ne se lit pas dans la présence de l’appel.',
    );
    assert.ok(
      refus.includes('setErreurAdresse(MESSAGE_ADRESSE_INVALIDE)'),
      'le refus ne dit plus pourquoi l’adresse ne passe pas : le parent ' +
        'retomberait sur l’erreur générique de la base.',
    );
    assert.ok(refus.includes('valide = false'), 'le refus ne bloque plus l’envoi.');
    assert.ok(
      !refus.includes('setErreurAdresse(null)'),
      'la branche du refus efface l’erreur qu’elle vient de poser.',
    );
  });

  it('l’adresse acceptée ne pose aucune erreur', () => {
    const { accepte } = controleAdresse(source);

    assert.ok(accepte.includes('setErreurAdresse(null)'), 'l’erreur n’est plus effacée.');
    assert.ok(
      !accepte.includes('MESSAGE_ADRESSE_INVALIDE'),
      'la branche « accepté » pose le message d’adresse invalide.',
    );
  });

  it('le message s’affiche sous le champ de l’adresse, et pas sous un autre', () => {
    const d = source.indexOf('label="Adresse e-mail pour la réponse"');
    assert.ok(d >= 0, 'le champ d’adresse est introuvable — analyse impossible');
    const f = source.indexOf('/>', d);
    assert.ok(f > d, 'le champ d’adresse n’est pas terminé — analyse impossible');

    assert.ok(
      source.slice(d, f).includes('erreur={erreurAdresse}'),
      'le champ d’adresse ne reçoit pas `erreurAdresse` : le parent lirait le ' +
        'message ailleurs, ou pas du tout.',
    );
  });

  it('un nouveau formulaire ne conserve pas l’erreur précédente', () => {
    const corps = entre(
      source,
      'const reinitialiser = useCallback(',
      'const envoyer = useCallback(',
    );

    assert.ok(
      corps.includes('setErreurAdresse(null)'),
      '`reinitialiser` n’efface plus l’erreur d’adresse : après un envoi réussi, ' +
        'le formulaire neuf afficherait encore l’erreur du précédent.',
    );
  });
});
