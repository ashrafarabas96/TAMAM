/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testMatch: ['<rootDir>/test/**/*.e2e-spec.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Every e2e suite talks to the same database and the same Redis, so running
  // them in parallel is a correctness hazard rather than a speed win: suites
  // seed over each other and time out waiting for work another worker consumed.
  // That went unnoticed while there were few enough suites to fit the worker
  // count. It is also not slower — measured at 117s serial against 133s
  // parallel, because the contention cost more than the concurrency saved.
  maxWorkers: 1,
};
