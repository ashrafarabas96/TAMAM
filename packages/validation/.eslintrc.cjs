module.exports = {
  root: true,
  extends: ['../../packages/config/eslint.base.cjs'],
  // The build tsconfig excludes the vitest specs so they stay out of dist; lint
  // still has to see them, so it type-checks against a config that includes them.
  parserOptions: { project: './tsconfig.eslint.json', tsconfigRootDir: __dirname },
  env: { node: true },
  ignorePatterns: ['dist', 'node_modules'],
};
