/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.module.ts', '!src/scripts/**'],
  coverageThreshold: { global: { statements: 60, branches: 50, functions: 60, lines: 60 } },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
