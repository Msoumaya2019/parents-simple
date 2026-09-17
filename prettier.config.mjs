/**
 * Configuration Prettier.
 *
 * `printWidth` à 100 plutôt que 80 : les noms de domaine de ce projet sont en
 * français et souvent longs — `libelleCategorieDocument`,
 * `jourCivilCourt` — et une largeur de 80 coupe des appels parfaitement
 * lisibles en trois lignes. Le formatage doit s'adapter au vocabulaire, pas
 * l'inverse.
 */

export default {
  semi: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  endOfLine: 'lf',
};
