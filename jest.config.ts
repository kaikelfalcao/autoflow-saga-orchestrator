import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^newrelic$': '<rootDir>/__mocks__/newrelic.js',
  },
  collectCoverageFrom: [
    'src/saga/saga.service.ts',
    'src/saga/clients/order-service.client.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: { lines: 80, functions: 80, branches: 75, statements: 80 },
  },
};

export default config;
