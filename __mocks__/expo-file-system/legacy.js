// Manual mock for the `expo-file-system/legacy` entry point — see the sibling
// `expo-file-system.js` mock for why the real module cannot load under Jest.

module.exports = {
  cacheDirectory: 'file:///cache/',
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  documentDirectory: 'file:///document/',
  downloadAsync: jest.fn().mockResolvedValue({ status: 200, uri: 'file:///document/download' }),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
};
