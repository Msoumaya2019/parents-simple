/**
 * Tests de contraste des couleurs du thème.
 *
 * POURQUOI CE FICHIER EXISTE
 * --------------------------
 * `src/theme/index.ts` affirme, dans un commentaire, que « `textMuted` sur
 * `surface` garde un rapport de contraste supérieur à 4,5:1 dans les deux
 * modes ». C'était une promesse vérifiable que personne ne vérifiait : une
 * retouche de teinte « pour adoucir » pouvait la casser sans que rien ne le
 * signale, et le défaut ne se serait vu que sur le téléphone d'un parent qui
 * voit mal — c'est-à-dire chez la personne la moins en mesure de le rapporter.
 *
 * Un commentaire qui justifie un choix par une propriété mesurable mérite le
 * test qui tient cette propriété.
 *
 * CE QUE LE SEUIL DE 4,5:1 SIGNIFIE
 * ---------------------------------
 * C'est le seuil WCAG AA pour du texte courant. En dessous, le texte reste
 * lisible pour un œil reposé, mais devient pénible pour un œil fatigué — ce qui
 * est le cas d'un parent qui consulte l'application en fin de journée, ou dans
 * la cour à midi en plein soleil.
 *
 * CE QUI EST EXEMPTÉ, ET POURQUOI
 * -------------------------------
 * Le voile `overlay` n'est pas testé : c'est une couleur semi-transparente,
 * posée sur une image dont on ignore la teinte. Aucun rapport de contraste ne
 * peut être calculé sur elle sans connaître ce qu'elle recouvre.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { darkTheme, lightTheme, type Theme } from '@/theme';

/** Seuil WCAG AA pour du texte courant. */
const SEUIL = 4.5;

/** Composantes 0-255 d'une couleur `#rrggbb`. Lève sur toute autre forme. */
function composantes(couleur: string): readonly [number, number, number] {
  const trouve = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(couleur);
  if (trouve === null) {
    // On lève plutôt que de rendre une valeur de repli : une couleur au format
    // inattendu ferait passer le test sur une chaîne vide, ce qui est le pire
    // des états — un contrôle vert qui ne contrôle rien.
    throw new Error(`Couleur non analysable : « ${couleur} » (attendu #rrggbb)`);
  }

  return [
    Number.parseInt(trouve[1] ?? '0', 16),
    Number.parseInt(trouve[2] ?? '0', 16),
    Number.parseInt(trouve[3] ?? '0', 16),
  ];
}

/** Luminance relative WCAG d'une couleur opaque. */
function luminance(couleur: string): number {
  const canaux = composantes(couleur).map((valeur) => {
    const normalisee = valeur / 255;
    return normalisee <= 0.03928 ? normalisee / 12.92 : Math.pow((normalisee + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * (canaux[0] ?? 0) + 0.7152 * (canaux[1] ?? 0) + 0.0722 * (canaux[2] ?? 0);
}

/** Rapport de contraste entre deux couleurs, toujours supérieur ou égal à 1. */
function contraste(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const clair = Math.max(la, lb);
  const sombre = Math.min(la, lb);
  return (clair + 0.05) / (sombre + 0.05);
}

function arrondi(valeur: number): string {
  return valeur.toFixed(2);
}

const MODES: readonly (readonly [string, Theme])[] = [
  ['clair', lightTheme],
  ['sombre', darkTheme],
];

describe('contraste des tons pastel', () => {
  for (const [nom, theme] of MODES) {
    // On itère sur les tons réellement déclarés, et non sur une liste recopiée
    // ici : un ton ajouté au thème est ainsi vérifié sans que ce fichier ait
    // besoin d'être mis à jour. Une liste recopiée aurait exactement le défaut
    // qu'elle prétend surveiller — elle ignorerait le ton nouveau.
    const tons = Object.entries(theme.colors.pastels);

    it(`couvre les cinq tons en mode ${nom}`, () => {
      assert.equal(tons.length, 5);
    });

    for (const [ton, couleurs] of tons) {
      it(`mode ${nom} : l'encre « ${ton} » reste lisible sur son fond`, () => {
        const rapport = contraste(couleurs.encre, couleurs.fond);

        assert.ok(
          rapport >= SEUIL,
          `« ${ton} » en mode ${nom} : ${arrondi(rapport)}:1, en dessous de ${SEUIL}:1 ` +
            `(encre ${couleurs.encre} sur fond ${couleurs.fond})`,
        );
      });
    }
  }
});

describe('contraste du texte sur un aplat pastel', () => {
  for (const [nom, theme] of MODES) {
    // Un ton pastel sert aussi d'aplat plein : le bouton « Participer » de la
    // carte de sondage est posé sur l'encre violette, et son libellé doit
    // rester lisible. On itère sur les tons déclarés, donc un ton ajouté est
    // vérifié sans que ce fichier ait à être modifié.
    for (const [ton, couleurs] of Object.entries(theme.colors.pastels)) {
      it(`mode ${nom} : un libellé reste lisible sur l'aplat « ${ton} »`, () => {
        const rapport = contraste(theme.colors.textOnPrimary, couleurs.encre);

        assert.ok(
          rapport >= SEUIL,
          `aplat « ${ton} » en mode ${nom} : ${arrondi(rapport)}:1, en dessous de ${SEUIL}:1 ` +
            `(texte ${theme.colors.textOnPrimary} sur ${couleurs.encre})`,
        );
      });
    }
  }
});

describe('contraste du texte sur les fonds', () => {
  /** Paires que l'application emploie réellement. */
  const PAIRES: readonly (readonly [string, (theme: Theme) => string, (theme: Theme) => string])[] =
    [
      ['texte principal sur carte', (t) => t.colors.textPrimary, (t) => t.colors.surface],
      ['texte secondaire sur carte', (t) => t.colors.textSecondary, (t) => t.colors.surface],
      ['texte atténué sur carte', (t) => t.colors.textMuted, (t) => t.colors.surface],
      ['texte atténué sur le fond', (t) => t.colors.textMuted, (t) => t.colors.background],
      ['texte sur le fond enfoncé', (t) => t.colors.textSecondary, (t) => t.colors.surfaceSunken],
      ['texte d’action sur son fond', (t) => t.colors.textOnPrimary, (t) => t.colors.primary],
      ['texte d’alerte sur son fond', (t) => t.colors.danger, (t) => t.colors.dangerSoft],
      // Le texte de la bannière est posé sur le dégradé du ciel, pas sur une
      // carte : c'est le seul endroit de l'application où un titre se lit sur
      // autre chose qu'un fond uni, et le seul où une teinte décorative doit
      // donc être traitée comme un fond à part entière.
      ['titre de la bannière sur le ciel', (t) => t.colors.textPrimary, (t) => t.colors.decor.ciel],
      ['sur-titre de la bannière sur le ciel', (t) => t.colors.primary, (t) => t.colors.decor.ciel],
      [
        'sous-titre de la bannière sur le bas du ciel',
        (t) => t.colors.textSecondary,
        (t) => t.colors.decor.cielBas,
      ],
    ];

  for (const [nom, theme] of MODES) {
    for (const [intitule, encre, fond] of PAIRES) {
      it(`mode ${nom} : ${intitule}`, () => {
        const rapport = contraste(encre(theme), fond(theme));

        assert.ok(
          rapport >= SEUIL,
          `${intitule} en mode ${nom} : ${arrondi(rapport)}:1, en dessous de ${SEUIL}:1 ` +
            `(${encre(theme)} sur ${fond(theme)})`,
        );
      });
    }
  }
});

describe('le calcul lui-même', () => {
  // Sans ces trois cas, un calcul faux rendrait tous les tests ci-dessus verts
  // ou rouges pour de mauvaises raisons. Les valeurs de référence viennent de
  // la définition WCAG : noir sur blanc vaut exactement 21:1.
  it('donne 21:1 pour du noir sur du blanc', () => {
    assert.equal(arrondi(contraste('#000000', '#FFFFFF')), '21.00');
  });

  it('donne 1:1 pour une couleur sur elle-même', () => {
    assert.equal(arrondi(contraste('#1D4ED8', '#1D4ED8')), '1.00');
  });

  it('est symétrique', () => {
    assert.equal(contraste('#E4EDFD', '#1B4FD8'), contraste('#1B4FD8', '#E4EDFD'));
  });
});
