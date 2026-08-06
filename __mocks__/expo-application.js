// Manual mock for `expo-application` — a native module, so its real implementation
// cannot load in Jest (`expo-modules-core` needs the native `globalThis.expo` host).
// Reached from `sentry-init.ts`, which only reads `nativeApplicationVersion`.

module.exports = {
  applicationId: 'com.musclog.test',
  applicationName: 'Musclog',
  nativeApplicationVersion: '0.0.0-test',
  nativeBuildVersion: '0',
  getInstallationTimeAsync: jest.fn().mockResolvedValue(new Date(0)),
};
