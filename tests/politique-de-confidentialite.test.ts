/**
 * L'accord entre ce que `identifiants.ts` affirme et ce que la politique dit.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * L'en-tête de `src/lib/identifiants.ts` affirmait deux choses sur la politique
 * de confidentialité :
 *
 *   - « Ce sont des données pseudonymes au sens du RGPD, ce que la politique de
 *     confidentialité indique explicitement » ;
 *   - « Un parent qui réinstalle peut donc voter une seconde fois : c'est une
 *     limite connue, décrite dans la politique de confidentialité ».
 *
 * Ni l'une ni l'autre n'était vraie. La page ne contenait pas le mot
 * « pseudonyme », ni « RGPD », ni la moindre mention de la réinstallation — le
 * seul endroit où la désinstallation apparaissait ne disait rien de sa
 * conséquence sur le vote. Deux affirmations de conformité qui reposaient sur
 * un document qui ne les portait pas.
 *
 * Les deux mentions ont été ajoutées à la page, et ce banc tient l'accord dans
 * les deux sens : si l'une disparaît de l'en-tête, ou de la page, il échoue.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que les mentions sont exactes, complètes, ou suffisantes au regard du RGPD.
 * Il vérifie qu'une phrase existe, jamais qu'elle dit vrai — c'est une limite de
 * tout contrôle de forme, et elle est ici assumée : le jugement sur le fond
 * reste une relecture humaine.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const MODULE = join(RACINE, 'src', 'lib', 'identifiants.ts');
const PAGE = join(RACINE, 'app', 'confidentialite.tsx');

/**
 * Le source sur une seule ligne, étoiles de commentaire retirées.
 *
 * Les affirmations sont coupées par le retour à la ligne du commentaire — la
 * largeur vaut 100 — et chaque ligne de continuation commence par ` * `. Sans
 * les retirer, « confidentialité indique » deviendrait « confidentialité *
 * indique », et aucun motif ne correspondrait jamais.
 *
 * L'étoile n'est retirée que suivie d'une espace ou en fin de ligne : c'est ce
 * qui laisse intact le `/` de fermeture d'un bloc, et une multiplication
 * éventuelle.
 */
function aPlat(source: string): string {
  return source.replace(/^\s*\*(?=\s|$)/gm, '').replace(/\s+/g, ' ');
}

const EN_TETE = aPlat(readFileSync(MODULE, 'utf8'));
const POLITIQUE = aPlat(readFileSync(PAGE, 'utf8'));

/**
 * Ce que l'en-tête promet que la politique dit, et ce qui doit s'y trouver.
 *
 * La liste est fermée : une affirmation nouvelle dans l'en-tête doit être
 * inscrite ici, avec la mention qui la tient dans la page.
 */
const ACCORDS: readonly {
  readonly affirmation: string;
  readonly dansLEnTete: RegExp;
  readonly dansLaPage: readonly RegExp[];
}[] = [
  {
    affirmation: 'les identifiants sont des données pseudonymes au sens du RGPD',
    dansLEnTete: /ce que la politique de confidentialité indique explicitement/,
    dansLaPage: [/pseudonymes au sens du règlement européen/, /RGPD/],
  },
  {
    affirmation: 'une réinstallation permet de voter une seconde fois',
    dansLEnTete: /décrite dans la politique de confidentialité/,
    dansLaPage: [/réinstallation/, /voter une seconde fois/],
  },
];

describe('La politique de confidentialité dit ce que l’en-tête affirme', () => {
  for (const accord of ACCORDS) {
    it(`l’en-tête affirme : ${accord.affirmation}`, () => {
      assert.match(
        EN_TETE,
        accord.dansLEnTete,
        'l’affirmation a disparu de l’en-tête : la retirer de ACCORDS, ou la remettre',
      );
    });

    it(`la page le dit : ${accord.affirmation}`, () => {
      for (const motif of accord.dansLaPage) {
        assert.match(
          POLITIQUE,
          motif,
          `la politique ne porte pas « ${motif.source} », que l’en-tête lui attribue`,
        );
      }
    });
  }

  it('la page est bien celle qui est lue, et non un autre fichier', () => {
    assert.match(POLITIQUE, /Politique de confidentialité/);
    assert.match(POLITIQUE, /Responsable de traitement/);
  });
});

describe('Ce que la page affirme du code reste vrai', () => {
  it('aucun nom n’est demandé par le formulaire de contact', () => {
    const contact = readFileSync(join(RACINE, 'app', '(tabs)', 'contact.tsx'), 'utf8');
    // La page promet « ni votre nom ». Le formulaire ne doit pas en demander :
    // un champ nom rendrait cette phrase fausse, et personne ne le verrait.
    assert.doesNotMatch(contact, /label="[^"]*[Nn]om[^"]*"/);
  });

  it('les identifiants locaux sont bien au nombre que la page annonce', () => {
    // « Trois informations » : un identifiant de vote, un identifiant
    // d'appareil, et les préférences — cette dernière regroupant le thème et
    // les réponses retenues. Quatre clés, trois catégories.
    const cles = ['freres-lumieres.votant', 'freres-lumieres.appareil', 'freres-lumieres.theme'];
    const sources = [
      readFileSync(MODULE, 'utf8'),
      readFileSync(join(RACINE, 'src', 'lib', 'votes-locaux.ts'), 'utf8'),
      readFileSync(join(RACINE, 'src', 'providers', 'theme-provider.tsx'), 'utf8'),
    ].join('\n');

    for (const cle of cles) {
      assert.ok(sources.includes(cle), `la clé ${cle} a disparu du code`);
    }

    // Aucune autre clé de stockage ne doit exister sans être décrite.
    const trouvees = [...sources.matchAll(/'freres-lumieres\.([a-z]+)'/g)].map((m) => m[1]);
    assert.deepEqual(
      [...new Set(trouvees)].sort(),
      ['appareil', 'theme', 'votant', 'votes'],
      'une clé de stockage nouvelle doit être décrite dans la politique',
    );
  });
});
