/**
 * Les deux identifiants ne voyagent jamais ensemble — et la page le dit.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `src/lib/identifiants.ts` porte la promesse de minimisation du projet :
 *
 *   « Les deux valeurs sont donc indépendantes, et ne sont jamais envoyées
 *     ensemble. C'est le principe de minimisation appliqué au seul endroit où
 *     cette application stocke quoi que ce soit. »
 *
 * Elle était VRAIE, et tenue par rien. Mesuré avant d'écrire ce fichier :
 * `identifiantVotant` n'est appelé que dans `sondages.ts`, `identifiantAppareil`
 * que dans `messages.ts`, et aucun fichier n'appelle les deux. Mais c'est un
 * état, pas une règle : le jour où un champ est ajouté au formulaire de contact
 * — ou une colonne au vote — les deux valeurs peuvent se retrouver dans la même
 * charge utile sans qu'aucun outil ne bronche. Le croisement de deux
 * informations anodines reconstitue une opinion attribuable à une famille, et
 * c'est exactement ce que cet en-tête promet d'éviter.
 *
 * Ce banc transforme la promesse en décision : il ferme l'inventaire des
 * appelants, et il exige qu'aucune charge utile ne porte les deux.
 *
 * LA PAGE DE CONFIDENTIALITÉ, ELLE AUSSI
 * --------------------------------------
 * Le même contrôle tient la liste que la page donne au parent — « Lorsque vous
 * écrivez au bureau » — contre les paramètres réellement envoyés. Elle
 * annonçait « Le texte de votre message » et omettait le SUJET, qui est un champ
 * obligatoire du formulaire et part avec le reste sous `p_sujet`. Un parent qui
 * lit cette phrase ne peut pas savoir qu'un objet distinct quitte son
 * téléphone : l'énumération se présente comme la liste, et il lui manquait un
 * membre. La phrase a été corrigée, et la couverture est désormais fermée des
 * deux côtés.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la page est complète au regard du RGPD — un banc de forme ne juge pas un
 * document. Il prouve que chaque paramètre transmis est nommé quelque part dans
 * la page, et que rien n'est transmis que la page ne nomme.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const IDENTIFIANTS = join(RACINE, 'src', 'lib', 'identifiants.ts');
const PAGE = join(RACINE, 'app', 'confidentialite.tsx');

/**
 * Retire commentaires de bloc et de ligne.
 *
 * Le `[^:]` devant `//` est nécessaire : sans lui, `'https://…'` serait coupé en
 * fin de ligne. Et sans ce retrait, la phrase qui CITE un paramètre suffirait au
 * contrôle qui le cherche — le défaut que ce projet a déjà payé trois fois.
 */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Le texte sur une seule ligne, commentaires CONSERVÉS.
 *
 * C'est la forme qu'il faut pour lire une promesse : elle vit dans un
 * commentaire, par définition. La retirer ferait échouer le contrôle sur le seul
 * état correct — mesuré au premier essai de ce banc, où l'en-tête était intact.
 *
 * L'étoile de continuation est retirée, mais SEULEMENT suivie d'une espace ou en
 * fin de ligne : c'est ce qui laisse intact le `/` de fermeture d'un bloc. Sans
 * ce retrait, une phrase coupée par la largeur du commentaire — la promesse
 * l'est — ne se retrouverait jamais, ` * ` s'intercalant entre ses deux moitiés.
 */
function aPlat(source: string): string {
  return source.replace(/^\s*\*(?=\s|$)/gm, '').replace(/\s+/g, ' ');
}

/**
 * Le texte sur une seule ligne, commentaires RETIRÉS.
 *
 * C'est la forme qu'il faut pour la page : ce que le parent lit est le texte
 * affiché, jamais un commentaire. Une phrase qui ne vivrait que dans un
 * commentaire ne dit rien à personne, et ne doit donc pas satisfaire le contrôle
 * qui la cherche.
 */
function texteAffiche(source: string): string {
  return aPlat(sansCommentaires(source));
}

/** Tous les fichiers source sous un dossier, en chemins relatifs à la racine. */
function fichiersSource(dossier: string): readonly string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(join(RACINE, dossier), { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      trouves.push(...fichiersSource(chemin));
    } else if (entree.name.endsWith('.ts') || entree.name.endsWith('.tsx')) {
      // Séparateurs normalisés : les inventaires de ce banc sont écrits avec des
      // barres obliques, et `join` en produit des antislashs sous Windows. Sans
      // cela, les comparaisons d'inventaire échouent sur le seul état correct.
      trouves.push(chemin.replaceAll('\\', '/'));
    }
  }
  return trouves.sort();
}

interface AppelRpc {
  readonly fichier: string;
  readonly nom: string;
  readonly parametres: readonly string[];
}

/**
 * Les appels `rpc('nom', { … })` d'un fichier, avec les clefs de leur charge.
 *
 * Le corps de l'objet est extrait par comptage d'accolades, jamais par une
 * expression paresseuse : celle-ci s'arrêterait au premier `}` imbriqué — un
 * objet de paramètres n'en contient pas aujourd'hui, et en contiendra peut-être
 * demain. Le test « le corps d'un appel imbriqué est compté » éprouve ce
 * comptage sur une charge utile qui en porte un.
 */
function appelsRpc(fichier: string, source: string): readonly AppelRpc[] {
  const appels: AppelRpc[] = [];
  const propre = sansCommentaires(source);

  for (const trouve of propre.matchAll(/\.rpc\(\s*'([^']+)'\s*,/g)) {
    const ouvrante = propre.indexOf('{', trouve.index + trouve[0].length);
    if (ouvrante === -1) {
      continue;
    }

    let profondeur = 0;
    let fermante = -1;
    for (let index = ouvrante; index < propre.length; index += 1) {
      if (propre[index] === '{') {
        profondeur += 1;
      } else if (propre[index] === '}') {
        profondeur -= 1;
        if (profondeur === 0) {
          fermante = index;
          break;
        }
      }
    }
    if (fermante === -1) {
      continue;
    }

    const corps = propre.slice(ouvrante + 1, fermante);
    const parametres: string[] = [];
    // Une clef suit un début de ligne ou une virgule. La forme `? null : x` d'un
    // ternaire porte aussi un `:` — mais jamais précédé d'une virgule, donc
    // elle n'est pas prise pour une clef.
    for (const clef of corps.matchAll(/(?:^|,)\s*([a-z][a-z0-9_]*)\s*:/gm)) {
      const nom = clef[1];
      if (nom !== undefined) {
        parametres.push(nom);
      }
    }

    appels.push({ fichier, nom: trouve[1] ?? '', parametres });
  }

  return appels;
}

const SERVICES = fichiersSource('src/services');
const TOUS_APPELS = SERVICES.flatMap((fichier) =>
  appelsRpc(fichier, readFileSync(join(RACINE, fichier), 'utf8')),
);

/** Les fichiers qui APPELENT une fonction, hors celui qui la déclare. */
function fichiersQuiAppellent(nom: string): readonly string[] {
  const appelants: string[] = [];
  for (const fichier of [...fichiersSource('src'), ...fichiersSource('app')]) {
    if (join(RACINE, fichier) === IDENTIFIANTS) {
      continue;
    }
    const source = sansCommentaires(readFileSync(join(RACINE, fichier), 'utf8'));
    if (source.includes(`${nom}(`)) {
      appelants.push(fichier);
    }
  }
  return appelants.sort();
}

function appel(nom: string): AppelRpc {
  const trouve = TOUS_APPELS.find((candidat) => candidat.nom === nom);
  assert.ok(trouve !== undefined, `l'appel rpc « ${nom} » est introuvable dans src/services`);
  return trouve;
}

const PAGE_PLATE = texteAffiche(readFileSync(PAGE, 'utf8'));

describe('Les deux identifiants ne voyagent jamais ensemble', () => {
  it('l’en-tête porte bien la promesse, et ce banc la tient', () => {
    const enTete = aPlat(readFileSync(IDENTIFIANTS, 'utf8'));
    assert.match(
      enTete,
      /ne sont jamais envoyées ensemble/,
      'la promesse a disparu de l’en-tête : la retirer de ce banc, ou la remettre',
    );
  });

  it('l’identifiant de vote n’a qu’un seul appelant, et c’est le vote', () => {
    assert.deepEqual(
      fichiersQuiAppellent('identifiantVotant'),
      ['src/services/sondages.ts'],
      'un appelant nouveau doit être justifié : les deux identifiants ne doivent pas se croiser',
    );
  });

  it('l’identifiant d’appareil n’a qu’un seul appelant, et c’est le message', () => {
    assert.deepEqual(
      fichiersQuiAppellent('identifiantAppareil'),
      ['src/services/messages.ts'],
      'un appelant nouveau doit être justifié : les deux identifiants ne doivent pas se croiser',
    );
  });

  it('aucun fichier n’appelle les deux', () => {
    const votant = new Set(fichiersQuiAppellent('identifiantVotant'));
    const croises = fichiersQuiAppellent('identifiantAppareil').filter((f) => votant.has(f));
    assert.deepEqual(
      croises,
      [],
      'ces fichiers emploient les deux identifiants : le croisement redevient possible',
    );
  });

  it('aucune charge utile ne porte les deux', () => {
    const fautifs = TOUS_APPELS.filter(
      (candidat) =>
        candidat.parametres.some((nom) => nom.includes('votant')) &&
        candidat.parametres.some((nom) => nom.includes('appareil')),
    ).map((candidat) => `${candidat.fichier} → ${candidat.nom}`);
    assert.deepEqual(
      fautifs,
      [],
      'ces appels transmettent les deux identifiants ensemble : c’est ce que la promesse interdit',
    );
  });

  it('chaque appel d’écriture porte ses paramètres, et rien d’autre', () => {
    assert.deepEqual(appel('voter').parametres.slice().sort(), [
      'p_choix_id',
      'p_sondage_id',
      'p_votant_id',
    ]);
    assert.deepEqual(appel('envoyer_message').parametres.slice().sort(), [
      'p_appareil_id',
      'p_categorie',
      'p_corps',
      'p_reponse_a',
      'p_sujet',
    ]);
  });

  it('le corps d’un appel imbriqué est compté, et non coupé court', () => {
    // Le `}` de l'objet interne ne doit pas clore la lecture : la clef qui le
    // suit, `apres`, est la sonde. Une extraction paresseuse s'arrêterait avant.
    const source = [
      "client().rpc('exemple', {",
      '  avant: 1,',
      '  imbrique: { dedans: 2 },',
      '  apres: 3,',
      '}),',
    ].join('\n');
    const trouves = appelsRpc('fictif.ts', source);
    assert.equal(trouves.length, 1);
    assert.deepEqual(trouves[0]?.parametres, ['avant', 'imbrique', 'apres']);
  });
});

describe('La page nomme tout ce qui part du téléphone', () => {
  /**
   * Chaque paramètre des deux écritures, et la phrase de la page qui le nomme.
   *
   * La liste est FERMÉE, et dans les deux sens : un paramètre transmis qui n'y
   * figure pas fait échouer la complétude, et une entrée qui ne correspondrait
   * plus à aucun paramètre aussi. C'est ce qui empêche un champ ajouté demain de
   * partir sans que la page le dise.
   */
  const COUVERTURE: readonly { readonly parametre: string; readonly dit: RegExp }[] = [
    { parametre: 'p_sujet', dit: /Le sujet et le texte de votre message/ },
    { parametre: 'p_corps', dit: /Le sujet et le texte de votre message/ },
    { parametre: 'p_categorie', dit: /la catégorie choisie/ },
    { parametre: 'p_reponse_a', dit: /l’adresse e-mail à laquelle répondre/ },
    { parametre: 'p_appareil_id', dit: /l’identifiant d’appareil/ },
    { parametre: 'p_sondage_id', dit: /Lorsque vous répondez à un sondage/ },
    { parametre: 'p_choix_id', dit: /Votre réponse/ },
    { parametre: 'p_votant_id', dit: /l’identifiant de vote/ },
  ];

  it('la page est bien celle qui est lue, et non un autre fichier', () => {
    assert.match(PAGE_PLATE, /Ce qui est transmis, et quand/);
    assert.match(PAGE_PLATE, /Lorsque vous écrivez au bureau/);
  });

  for (const { parametre, dit } of COUVERTURE) {
    it(`la page nomme ${parametre}`, () => {
      assert.match(
        PAGE_PLATE,
        dit,
        `la page ne dit rien qui couvre « ${parametre} », qui part pourtant du téléphone`,
      );
    });
  }

  it('l’inventaire est fermé des deux côtés', () => {
    const transmis = ['voter', 'envoyer_message']
      .flatMap((nom) => appel(nom).parametres)
      .slice()
      .sort();
    const nommes = COUVERTURE.map((entree) => entree.parametre)
      .slice()
      .sort();
    assert.deepEqual(
      nommes,
      transmis,
      'un paramètre transmis n’est pas décrit ici, ou une entrée décrit un paramètre qui n’existe plus',
    );
  });
});

describe('Ce que ce banc lit vraiment', () => {
  it('les appels d’écriture ont bien été extraits', () => {
    // Sans ce garde-fou, une extraction cassée rendrait les deux contrôles
    // précédents verts en ne lisant rien — le pire des états.
    assert.ok(TOUS_APPELS.length >= 3, `appels extraits : ${TOUS_APPELS.length}`);
    assert.deepEqual(
      TOUS_APPELS.map((candidat) => candidat.nom)
        .slice()
        .sort(),
      ['envoyer_message', 'sondage_resultats', 'voter'],
    );
  });

  it('les fichiers examinés sont ceux du projet', () => {
    assert.ok(SERVICES.includes('src/services/messages.ts'));
    assert.ok(SERVICES.includes('src/services/sondages.ts'));
    assert.ok(
      fichiersQuiAppellent('identifiantVotant').every((f) => f.startsWith('src/')),
      'les appelants sont lus sous src/ et app/',
    );
    assert.equal(relative(RACINE, IDENTIFIANTS), join('src', 'lib', 'identifiants.ts'));
  });
});
