/** Shared ESLint base for all TypeScript workspaces. */
module.exports = {
  root: false,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier',
  ],
  settings: { 'import/resolver': { typescript: true, node: true } },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-floating-promises': 'off',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'inline-type-imports' }],
    'import/order': ['error', { 'newlines-between': 'always', alphabetize: { order: 'asc', caseInsensitive: true }, groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'] }],
    'import/no-unresolved': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-empty': ['error', { allowEmptyCatch: false }],
    eqeqeq: ['error', 'always'],
    // Spec §200 bans work-in-progress markers. Markers are written in caps as whole
    // words; matching case-insensitive substrings flagged ordinary English instead
    // ("attempts", "Template", "temporarily"). Comments are where markers actually
    // live, and a Literal selector cannot see them — hence no-warning-comments too.
    'no-restricted-syntax': [
      'error',
      { selector: 'Literal[value=/\\b(TODO|FIXME|HACK|XXX)\\b/]', message: 'No TODO/FIXME/HACK/XXX markers in production code (spec §200).' },
    ],
    'no-warning-comments': ['error', { terms: ['todo', 'fixme', 'hack:', 'xxx'], location: 'anywhere' }],
  },
};
