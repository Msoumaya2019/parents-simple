/**
 * Le champ de saisie fait ce que son commentaire annonce.
 *
 * POURQUOI CE BANC EXISTE
 * -----------------------
 * `src/components/ui/TextField.tsx` portait, juste au-dessus de
 * `textAlignVertical`, un commentaire qui décrivait une décision :
 *
 *   « La correction automatique est laissée active sur les champs de texte
 *     libre : c'est une aide réelle pour un message écrit rapidement. Elle est
 *     désactivée sur les champs courts, où elle propose surtout des
 *     remplacements indésirables. »
 *
 * Aucune prop ne portait cette décision. `autoCorrect` n'était écrit nulle
 * part, et React Native le laisse à `true` par défaut : la seconde phrase était
 * donc fausse, et un sujet comme une adresse recevait les remplacements qu'elle
 * disait éviter. Le commentaire était en français, sans nom de prop — c'est
 * pourquoi aucun contrôle de forme ne pouvait le voir.
 *
 * CE QUE LE BANC TIENT
 * --------------------
 * Deux règles, et la seconde est la générale :
 *
 *   - `autoCorrect` est posé sur la balise `<TextInput>`, et il suit
 *     `multiline` — actif sur le message, inactif sur un champ d'une ligne ;
 *   - un commentaire placé DANS la balise ne nomme aucune prop que la balise ne
 *     pose pas. Les noms sont reconnus entre accents graves, la convention de
 *     ce dépôt pour citer un identifiant ; un littéral (`true`, `null`) est
 *     écarté, ce n'est pas une prop.
 *
 * La seconde règle est celle qui aurait attrapé le défaut si le commentaire
 * avait nommé la prop au lieu de la décrire. Elle ne remplace pas la
 * relecture : elle empêche seulement qu'un commentaire promette une prop
 * absente.
 *
 * CE QU'IL NE PROUVE PAS
 * ----------------------
 * Que la correction automatique se comporte ainsi sur le téléphone. Aucun
 * moteur de rendu n'est installé — le banc lit la balise, jamais son effet.
 *
 * Exécution : `npm test`
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const RACINE = process.cwd();
const CHAMP = join(RACINE, 'src', 'components', 'ui', 'TextField.tsx');

/**
 * Les valeurs qui ne sont pas des props.
 *
 * Le commentaire cite `true` pour dire ce que vaut le défaut de React Native.
 * Un contrôle qui l'exigerait comme prop échouerait sur un fichier correct.
 */
const LITTERAUX: readonly string[] = ['true', 'false', 'null', 'undefined'];

/** La balise `<TextInput>` du fichier, commentaires compris. */
function baliseTextInput(source: string): string | null {
  const debut = source.indexOf('<TextInput');
  if (debut === -1) {
    return null;
  }

  const fin = source.indexOf('/>', debut);
  if (fin === -1) {
    return null;
  }

  return source.slice(debut, fin + 2);
}

/** La balise privée de ses commentaires. */
function sansCommentaires(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** Les props réellement posées, lues hors des commentaires. */
function propsPosees(balise: string): readonly string[] {
  const posees: string[] = [];
  for (const trouve of sansCommentaires(balise).matchAll(/(?:^|\s)([a-zA-Z][a-zA-Z0-9]*)=/g)) {
    const nom = trouve[1];
    if (nom !== undefined) {
      posees.push(nom);
    }
  }
  return posees;
}

/** Les identifiants cités entre accents graves dans les commentaires. */
function propsNommees(balise: string): readonly string[] {
  const nommees: string[] = [];
  for (const commentaire of balise.match(/\/\/[^\n]*/g) ?? []) {
    for (const cite of commentaire.match(/`[a-zA-Z][a-zA-Z0-9]*`/g) ?? []) {
      nommees.push(cite.slice(1, -1));
    }
  }
  return nommees;
}

/**
 * Les props qu'un commentaire nomme, que la balise ne pose pas, et qui ne sont
 * pas des littéraux.
 */
function propsAnnonceesSansEtrePosees(balise: string): readonly string[] {
  const posees = propsPosees(balise);
  return propsNommees(balise).filter((nom) => !posees.includes(nom) && !LITTERAUX.includes(nom));
}

const SOURCE = readFileSync(CHAMP, 'utf8');
const BALISE = baliseTextInput(SOURCE);

describe('Le champ de saisie porte la décision de son commentaire', () => {
  it('la balise `<TextInput>` est trouvée', () => {
    assert.notEqual(BALISE, null, '`<TextInput>` n’a pas été trouvée dans `TextField.tsx`');
  });

  it('`autoCorrect` est posé, et il suit `multiline`', () => {
    assert.match(
      sansCommentaires(BALISE ?? ''),
      /autoCorrect=\{multiline\}/,
      'la correction automatique n’est plus décidée : React Native la laisse active partout',
    );
  });

  it('`multiline` est bien une prop de la balise, et non une variable libre', () => {
    assert.ok(
      propsPosees(BALISE ?? '').includes('multiline'),
      '`autoCorrect={multiline}` ne suit plus la prop `multiline`',
    );
  });
});

describe('Un commentaire de la balise ne promet aucune prop absente', () => {
  it('aucune prop nommée dans un commentaire ne manque à la balise', () => {
    assert.deepEqual(
      propsAnnonceesSansEtrePosees(BALISE ?? ''),
      [],
      'un commentaire de `<TextInput>` cite une prop que la balise ne pose pas',
    );
  });

  it('un commentaire qui cite une prop absente est bien signalé', () => {
    // Le piège déjà payé dans ce dépôt, dans l'autre sens : un commentaire
    // décrit une décision, et la prop n'est nulle part.
    const piege =
      '<TextInput\n' +
      '  // `autoCorrect` est posé plus bas, avec `multiline`\n' +
      '  multiline={multiline}\n' +
      '  value={value}\n' +
      '/>';

    assert.deepEqual(propsAnnonceesSansEtrePosees(piege), ['autoCorrect']);
  });

  it('un littéral cité n’est pas une prop manquante', () => {
    const correcte =
      '<TextInput\n  // `autoCorrect` vaut `true` par défaut\n  autoCorrect={false}\n/>';

    assert.deepEqual(propsAnnonceesSansEtrePosees(correcte), []);
  });
});
