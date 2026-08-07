// Manual mock for `expo-updates` — a native module, so its real implementation cannot
// load in Jest. `utils/app.ts` reads `isEnabled` and may call `reloadAsync`.

module.exports = {
  isEnabled: false,
  channel: null,
  reloadAsync: jest.fn().mockResolvedValue(undefined),
  runtimeVersion: null,
  updateId: null,
};
