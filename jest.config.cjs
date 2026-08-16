module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/test/**/*.test.ts',
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/index.ts'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 100,
      lines: 90,
      statements: 90,
    },
  },
};
