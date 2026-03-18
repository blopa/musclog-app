global.__DEV__ = true;
jest.mock('react-native', () => {
  return {
    Platform: {
      OS: 'ios',
      select: jest.fn((objs) => objs.ios),
    },
    NativeModules: {},
    StyleSheet: {
      create: (s) => s,
    },
    // Add other necessary components as needed
  };
});
