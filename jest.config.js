module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react-native|@react-native|react-native|@nozbe|expo|@expo)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: ['utils/**/*.ts', '!utils/**/*.d.ts', '!utils/__tests__/**'],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 100,
      lines: 90,
    },
  },
};
