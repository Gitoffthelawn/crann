/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
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
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/src/**/*.test.ts'],
      setupFilesAfterEnv: [
        '<rootDir>/src/store/__tests__/setup.ts',
        '<rootDir>/src/agent/__tests__/setup.ts',
      ],
    },
    {
      displayName: 'jsdom',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
    },
  ],
};

