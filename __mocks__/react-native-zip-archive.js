// Manual mock for `react-native-zip-archive` — a native module with no JS fallback.
// `utils/bleWorkoutDataStorage.ts` only uses `zip`.

module.exports = {
  unzip: jest.fn().mockResolvedValue('file:///cache/unzipped'),
  zip: jest.fn().mockResolvedValue('file:///cache/archive.zip'),
};
