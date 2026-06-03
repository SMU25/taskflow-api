import js from '@eslint/js';
import tsEslint from 'typescript-eslint';
import unusedImports from 'eslint-plugin-unused-imports';
import prettierPlugin from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default tsEslint.config(js.configs.recommended, ...tsEslint.configs.recommended, {
  languageOptions: {
    parser: tsEslint.parser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    globals: {
      ...globals.node,
    },
  },
  plugins: {
    'unused-imports': unusedImports,
    prettier: prettierPlugin,
  },
  rules: {
    // Вимикаємо стандартні правила ESLint та TS для змінних
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'off',

    // Автовидалення незаюзаних імпортів
    'unused-imports/no-unused-imports': 'error',

    // Варнінги для незаюзаних змінних (з урахуванням типів TS та аргументів Fastify)
    'unused-imports/no-unused-vars': [
      'warn',
      {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_',
      },
    ],

    // Конфіг Prettier
    'prettier/prettier': 'error',
    ...prettierConfig.rules,
  },
});
