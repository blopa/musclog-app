// Manual mock for `expo-secure-store` — a native module, so its real implementation
// cannot load in Jest. Backed by a plain in-memory map so tests that go through
// `utils/encryptionKeyStorage.ts` behave like a real (empty) keystore.

const store = new Map();

module.exports = {
  __store: store,
  deleteItemAsync: jest.fn(async (key) => {
    store.delete(key);
  }),
  getItemAsync: jest.fn(async (key) => (store.has(key) ? store.get(key) : null)),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  setItemAsync: jest.fn(async (key, value) => {
    store.set(key, value);
  }),
};
