/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  // Mock browser APIs - order matters, agent setup extends store setup
  setupFilesAfterEnv: [
    '<rootDir>/src/store/__tests__/setup.ts',
    '<rootDir>/src/agent/__tests__/setup.ts',
  ],
};

