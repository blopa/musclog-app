import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';

type Entry = { dir: boolean; size: number; text?: string };

const mockFs = new Map<string, Entry>();
let mockFree = 10e9;
let mockStatus = 200;
let mockBadHash: string | null = null;
const mockUrls: string[] = [];
const mockExcluded: string[] = [];

const ROOT = 'file:///no-backup/local-ai';

jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockFs.set(uri, { dir: true, size: 0 });
  }),
  getInfoAsync: jest.fn(async (uri: string) => {
    const entry = mockFs.get(uri);

    return entry
      ? { exists: true, isDirectory: entry.dir, size: entry.size, uri }
      : { exists: false, isDirectory: false, uri };
  }),
  deleteAsync: jest.fn(async (uri: string) => {
    for (const key of [...mockFs.keys()]) {
      if (key === uri || key.startsWith(`${uri}/`)) {
        mockFs.delete(key);
      }
    }
  }),
  moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
    const entry = mockFs.get(from);
    if (!entry) {
      throw new Error('missing source');
    }

    mockFs.delete(from);
    mockFs.set(to, entry);
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const entry = mockFs.get(uri);
    if (!entry || entry.text === undefined) {
      throw new Error('ENOENT');
    }

    return entry.text;
  }),
  writeAsStringAsync: jest.fn(async (uri: string, text: string) => {
    mockFs.set(uri, { dir: false, size: text.length, text });
  }),
  readDirectoryAsync: jest.fn(async (uri: string) => {
    const prefix = `${uri}/`;
    const names = new Set<string>();
    for (const key of mockFs.keys()) {
      if (key.startsWith(prefix)) {
        names.add(key.slice(prefix.length).split('/')[0]);
      }
    }

    return [...names];
  }),
  getFreeDiskStorageAsync: jest.fn(async () => mockFree),
  createDownloadResumable: jest.fn((url: string, dest: string) => ({
    downloadAsync: async () => {
      mockUrls.push(url);
      if (mockStatus >= 400) {
        return { status: mockStatus, uri: dest };
      }

      const { DEFAULT_LOCAL_MODEL: model } = jest.requireActual('@/constants/localModels');
      const file = model.files.find((f: { path: string }) => url.endsWith(f.path));
      mockFs.set(dest, { dir: false, size: file?.bytes ?? 1 });

      return { status: 200, uri: dest };
    },
    pauseAsync: async () => ({ url, fileUri: dest, options: {}, resumeData: 'resume' }),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async () => null),
    setItem: jest.fn(async () => undefined),
    removeItem: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/modules/on-device-ai', () => ({
  onDeviceAiModule: {
    storageDirectory: () => 'file:///no-backup/local-ai',
    sha256File: jest.fn(async (path: string) => {
      const { DEFAULT_LOCAL_MODEL: model } = jest.requireActual('@/constants/localModels');
      const file = model.files.find((f: { path: string }) => path.endsWith(f.path));
      if (mockBadHash && path.endsWith(mockBadHash)) {
        return 'f'.repeat(64);
      }

      return file?.sha256 ?? '';
    }),
    setExcludedFromBackup: jest.fn(async (path: string) => {
      mockExcluded.push(path);

      return true;
    }),
  },
}));

import {
  cancelLocalModelDownload,
  deleteLocalModel,
  getInstalledLocalModel,
  getLocalModelSnapshot,
  refreshLocalModel,
  registerLocalModelUnloader,
  resetLocalModelStoreForTests,
  startLocalModelDownload,
} from '../modelStore';

const FOLDER = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}`;

beforeEach(() => {
  mockFs.clear();
  mockFree = 10e9;
  mockStatus = 200;
  mockBadHash = null;
  mockUrls.length = 0;
  mockExcluded.length = 0;
  resetLocalModelStoreForTests();
});

describe('startLocalModelDownload', () => {
  it('downloads both files, verifies them and installs atomically', async () => {
    await startLocalModelDownload({ withProjector: true });

    expect(getLocalModelSnapshot().state).toEqual({
      kind: 'ready',
      revision: DEFAULT_LOCAL_MODEL.revision,
      withProjector: true,
    });
    expect(mockUrls).toHaveLength(2);
    expect(mockUrls.every((url) => url.includes(DEFAULT_LOCAL_MODEL.revision))).toBe(true);
    expect(mockFs.has(`${FOLDER}/installed.json`)).toBe(true);
    expect([...mockFs.keys()].some((key) => key.includes('/.partial'))).toBe(false);
    expect(mockExcluded).toContain(ROOT);

    const installed = await getInstalledLocalModel();
    expect(installed?.modelPath).toBe(`${FOLDER}/LFM2.5-VL-450M-Q4_0.gguf`);
    expect(installed?.projectorPath).toBe(`${FOLDER}/mmproj-LFM2.5-VL-450m-Q8_0.gguf`);
  });

  it('a text-only selection never fetches the projector', async () => {
    await startLocalModelDownload({ withProjector: false });

    expect(mockUrls).toHaveLength(1);
    expect(mockUrls[0]).toContain('Q4_0.gguf');
    const installed = await getInstalledLocalModel();
    expect(installed?.projectorPath).toBeNull();
    expect(getLocalModelSnapshot().projectorInstalled).toBe(false);
  });

  it('fails closed on a checksum mismatch and keeps nothing', async () => {
    mockBadHash = 'LFM2.5-VL-450M-Q4_0.gguf';
    await startLocalModelDownload({ withProjector: true });

    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'checksum' });
    expect(await getInstalledLocalModel()).toBeNull();
    expect([...mockFs.keys()].some((key) => key.includes('installed.json'))).toBe(false);
    expect([...mockFs.keys()].some((key) => key.includes('/.partial'))).toBe(false);
  });

  it('refuses before downloading when there is no room', async () => {
    mockFree = 100e6;
    await startLocalModelDownload({ withProjector: true });

    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'noSpace' });
    expect(mockUrls).toHaveLength(0);
  });

  it('reports an HTTP failure and installs nothing', async () => {
    mockStatus = 404;
    await startLocalModelDownload({ withProjector: true });

    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'http' });
    expect(await getInstalledLocalModel()).toBeNull();
  });
});

describe('refreshLocalModel', () => {
  it('finds a complete install on disk', async () => {
    await startLocalModelDownload({ withProjector: true });
    resetLocalModelStoreForTests();
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');

    await refreshLocalModel();
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
    expect(getLocalModelSnapshot().projectorInstalled).toBe(true);
  });

  it('reads a partial download left by a killed app as interrupted', async () => {
    mockFs.set(`${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}`, {
      dir: true,
      size: 0,
    });
    mockFs.set(
      `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/LFM2.5-VL-450M-Q4_0.gguf`,
      { dir: false, size: 1000 }
    );
    await refreshLocalModel();

    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'interrupted' });
  });

  it('ignores an install folder with no installed.json', async () => {
    mockFs.set(`${FOLDER}`, { dir: true, size: 0 });
    mockFs.set(`${FOLDER}/LFM2.5-VL-450M-Q4_0.gguf`, { dir: false, size: 5 });
    await refreshLocalModel();

    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
    expect(await getInstalledLocalModel()).toBeNull();
  });
});

describe('deleteLocalModel and cancel', () => {
  it('unloads the runtime first, then removes everything', async () => {
    const order: string[] = [];
    registerLocalModelUnloader(async () => {
      order.push('unload');
      expect(mockFs.has(`${FOLDER}/installed.json`)).toBe(true);
    });
    await startLocalModelDownload({ withProjector: true });
    await deleteLocalModel();

    expect(order).toEqual(['unload']);
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
    expect(await getInstalledLocalModel()).toBeNull();
    expect([...mockFs.keys()].some((key) => key.includes('/models'))).toBe(false);
  });

  it('cancel leaves nothing behind', async () => {
    await cancelLocalModelDownload();
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
  });
});
