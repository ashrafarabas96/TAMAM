module.exports = {
  root: true,
  extends: ['../../packages/config/eslint.base.cjs'],
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'node_modules', 'prisma/migrations'],
  rules: {
    '@typescript-eslint/no-floating-promises': 'error',
  },
};
