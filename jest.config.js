module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: { '^@insforge/sdk$': '<rootDir>/src/__mocks__/insforgeSdk.ts', '^@/(.*)$': '<rootDir>/src/$1' },
  setupFiles: ['./jest.setup.js'],
};
