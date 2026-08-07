// Manual mock for `expo-device` — a native module, so its real implementation cannot
// load in Jest. Reached from `sentry-init.ts`, which only reads `modelName`.

module.exports = {
  brand: 'test-brand',
  isDevice: true,
  manufacturer: 'test-manufacturer',
  modelName: 'test-device',
  osName: 'Android',
  osVersion: '99',
};
