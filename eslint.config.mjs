/**
 * Configuration ESLint (format « flat », obligatoire depuis ESLint 9).
 *
 * La règle des crochets de React est la plus utile de cet ensemble : elle
 * détecte un crochet appelé conditionnellement, c'est-à-dire un plantage
 * garanti sur le téléphone — jamais à la compilation, et jamais sur l'écran du
 * développeur s'il a pris un autre chemin.
 *
 * `exhaustive-deps` est volontairement en avertissement, et non en erreur :
 * `useAsyncData` conserve la fonction de chargement dans une référence
 * précisément pour qu'elle n'entre pas dans les dépendances. Un avertissement
 * documente l'écart, une erreur obligerait à désactiver la règle localement à
 * chaque appel.
 */

import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Selon la version du greffon, la configuration recommandée se trouve sous
// `recommended-latest` (qui inclut les règles du compilateur React) ou sous
// `recommended`. On prend celle qui est disponible plutôt que d'imposer une
// version précise du greffon.
const hooksRecommandee = reactHooks.configs['recommended-latest'] ?? reactHooks.configs.recommended;

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.expo/**',
      'android/**',
      'ios/**',
      'scripts/**',
      // Journal de travail et notes de projet : hors du code livré.
      '.workbuddy-ai/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...hooksRecommandee.rules,

      // Une variable non utilisée est presque toujours un reste de refonte.
      // Le souligné initial reste autorisé pour les paramètres volontairement
      // ignorés, ce qui documente l'intention au lieu de la masquer.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],

      // `any` est interdit : il annule le bénéfice du typage là où il est
      // écrit, et c'est exactement aux endroits difficiles qu'on l'écrit.
      '@typescript-eslint/no-explicit-any': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Les fichiers de test utilisent les globales de `node:test`.
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // En dernier : désactive tout ce que Prettier prend en charge, pour éviter
  // deux avis contradictoires sur la même ligne.
  prettier,
);
