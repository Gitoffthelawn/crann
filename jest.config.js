/** @type {import('jest').Config} */
const commonConfig = {
  preset: 'ts-jest',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Mock uuid ESM module
  moduleNameMapper: {
    '^uuid$': '<rootDir>/src/__mocks__/uuid.ts',
  },
};

module.exports = {
  ...commonConfig,
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  collectCoverageFrom: ['src/**/*.ts', 'src/**/*.tsx', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  // Mock browser APIs - order matters, agent setup extends store setup
  setupFilesAfterEnv: [
    '<rootDir>/src/store/__tests__/setup.ts',
    '<rootDir>/src/agent/__tests__/setup.ts',
  ],
  // Use jsdom for React component tests
  projects: [
    {
      ...commonConfig,
      displayName: 'node',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      setupFilesAfterEnv: [
        '<rootDir>/src/store/__tests__/setup.ts',
        '<rootDir>/src/agent/__tests__/setup.ts',
      ],
    },
    {
      ...commonConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
    },
  ],
};

