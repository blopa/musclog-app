const baseConfig = {
  transformIgnorePatterns: [
    // `expo-*` packages publish untranspiled ESM, so they have to go through
    // babel-jest too — `expo|@expo` alone only covers `expo/` and `@expo/`.
    // (`@sentry/react-native` is ESM as well, but it is stubbed by the manual
    // mock in `__mocks__/@sentry/` rather than transformed.)
    'node_modules/(?!(lucide-react-native|@react-native|react-native|react-native-css-interop|react-native-web|nativewind|@nozbe|expo|expo-.*|@expo|ml-array-max|ml-array-min|is-any-array)/)',
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
      moduleNameMapper: {
        // Static assets, which the node project's RN preset handles via its own asset
        // transformer. Must come first so it wins over the `^@/(.*)$` alias.
        '\\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?|mp3|mp4|wav)$':
          '<rootDir>/__mocks__/assetFileMock.js',
        ...baseConfig.moduleNameMapper,
        // This project deliberately skips the React Native jest preset, so the real
        // `react-native` package has no native bridge to talk to and throws on import.
        // `react-native-web` is the same API backed by the DOM — which is what jsdom is —
        // and it is already a dependency because the app ships a web build.
        '^react-native$': 'react-native-web',
      },
      // Don't use react-native preset to avoid setup conflicts
      // Use babel-jest with babel config
      transform: {
        // `.mjs` matters: `lucide-react-native` ships its ESM build with that extension.
        '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': ['babel-jest', { rootMode: 'upward' }],
      },
    },
  ],
};
