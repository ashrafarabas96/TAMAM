module.exports = {
  root: true,
  extends: ['../../packages/config/eslint.base.cjs'],
  parserOptions: { project: './tsconfig.json', tsconfigRootDir: __dirname },
  env: { node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
