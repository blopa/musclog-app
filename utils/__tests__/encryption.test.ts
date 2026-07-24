import { getEncryptionKey } from '@/utils/encryption';
import { getStoredEncryptionKey, storeEncryptionKey } from '@/utils/encryptionKeyStorage';

jest.mock('@/utils/encryptionKeyStorage', () => ({
  getStoredEncryptionKey: jest.fn(),
  storeEncryptionKey: jest.fn(),
}));

const mockGetStoredEncryptionKey = getStoredEncryptionKey as jest.MockedFunction<
  typeof getStoredEncryptionKey
>;
const mockStoreEncryptionKey = storeEncryptionKey as jest.MockedFunction<typeof storeEncryptionKey>;

describe('getEncryptionKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('coalesces concurrent SecureStore reads for the same storage key', async () => {
    let resolveStoredKey: ((value: string) => void) | undefined;
    mockGetStoredEncryptionKey.mockReturnValue(
      new Promise((resolve) => {
        resolveStoredKey = resolve;
      })
    );

    const first = getEncryptionKey(32, 'test-concurrent-key');
    const second = getEncryptionKey(32, 'test-concurrent-key');
    const third = getEncryptionKey(32, 'test-concurrent-key');

    expect(mockGetStoredEncryptionKey).toHaveBeenCalledTimes(1);
    resolveStoredKey?.('stored-key');

    await expect(Promise.all([first, second, third])).resolves.toEqual([
      'stored-key',
      'stored-key',
      'stored-key',
    ]);
    expect(mockStoreEncryptionKey).not.toHaveBeenCalled();
  });

  it('generates and stores only one key when concurrent callers find no stored key', async () => {
    mockGetStoredEncryptionKey.mockResolvedValue(null);
    mockStoreEncryptionKey.mockResolvedValue();

    const keys = await Promise.all([
      getEncryptionKey(32, 'test-new-key'),
      getEncryptionKey(32, 'test-new-key'),
      getEncryptionKey(32, 'test-new-key'),
    ]);

    expect(new Set(keys).size).toBe(1);
    expect(mockGetStoredEncryptionKey).toHaveBeenCalledTimes(1);
    expect(mockStoreEncryptionKey).toHaveBeenCalledTimes(1);
  });

  it('caches keys independently by SecureStore storage key', async () => {
    mockGetStoredEncryptionKey.mockImplementation(async (storageKey) => `${storageKey}-value`);

    await expect(getEncryptionKey(32, 'test-key-a')).resolves.toBe('test-key-a-value');
    await expect(getEncryptionKey(32, 'test-key-b')).resolves.toBe('test-key-b-value');
    await expect(getEncryptionKey(32, 'test-key-a')).resolves.toBe('test-key-a-value');

    expect(mockGetStoredEncryptionKey).toHaveBeenCalledTimes(2);
  });

  it('allows a failed load to be retried', async () => {
    mockGetStoredEncryptionKey
      .mockRejectedValueOnce(new Error('SecureStore unavailable'))
      .mockResolvedValueOnce('recovered-key');

    await expect(getEncryptionKey(32, 'test-retry-key')).rejects.toThrow('SecureStore unavailable');
    await expect(getEncryptionKey(32, 'test-retry-key')).resolves.toBe('recovered-key');

    expect(mockGetStoredEncryptionKey).toHaveBeenCalledTimes(2);
  });
});
