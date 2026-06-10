const baseConfig = {
  transformIgnorePatterns: [
    'node_modules/(?!(lucide-react-native|@react-native|react-native|@nozbe|expo|@expo|ml-array-max|ml-array-min|is-any-array)/)',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  collectCoverageFrom: [
    'utils/**/*.ts',
    'hooks/**/*.ts',
    '!utils/**/*.d.ts',
    '!utils/__tests__/**',
    '!hooks/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 85,
      functions: 100,
      lines: 90,
    },
  },
};

module.exports = {
  projects: [
    {
      ...baseConfig,
      displayName: 'node',
      // RN 0.85 moved the Jest preset out of the react-native package.
      preset: '@react-native/jest-preset',
      testEnvironment: 'node',
      testMatch: ['**/__tests__/**/*.test.ts', '!**/hooks/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    },
    {
      ...baseConfig,
      displayName: 'jsdom',
      testEnvironment: 'jsdom',
      testMatch: ['**/hooks/**/*.test.ts'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.jsdom.js'],
      // Don't use react-native preset to avoid setup conflicts
      // Use babel-jest with babel config
      transform: {
        '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { rootMode: 'upward' }],
      },
    },
  ],
};
