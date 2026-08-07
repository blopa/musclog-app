// Manual mock for the `expo` package. Its entry point runs `Expo.fx` side effects that
// pull in `expo-asset` -> `expo-modules-core`, which needs the native host object and so
// cannot load in Jest. `utils/app.ts` is the only consumer in the test graph and it only
// needs `reloadAppAsync`.

module.exports = {
  reloadAppAsync: jest.fn().mockResolvedValue(undefined),
};
