import { LOCAL_MODEL_DOWNLOAD_STATE, LOCAL_TEXT_MODEL_DOWNLOAD_STATE } from '@/constants/misc';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { DEFAULT_LOCAL_MODEL, LOCAL_TEXT_MODEL } from '@/constants/localModels';

type Entry = { dir: boolean; size: number; text?: string };

const mockFs = new Map<string, Entry>();
const mockStorage = new Map<string, string>();
let mockFree = 10e9;
let mockStatus = 200;
let mockBadHash: string | null = null;
const mockUrls: string[] = [];
const mockExcluded: string[] = [];

const ROOT = 'file:///no-backup/local-ai';

jest.mock('@/utils/aiTelemetry', () => ({ reportAiEvent: jest.fn() }));
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
    if (entry.dir) {
      const prefix = `${from}/`;
      for (const key of [...mockFs.keys()]) {
        if (key.startsWith(prefix)) {
          const child = mockFs.get(key)!;
          mockFs.delete(key);
          mockFs.set(`${to}/${key.slice(prefix.length)}`, child);
        }
      }
    }
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

      const { LOCAL_MODELS } = jest.requireActual('@/constants/localModels');
      const file = LOCAL_MODELS.flatMap((m: { files: { path: string }[] }) => m.files).find(
        (f: { path: string }) => url.endsWith(f.path)
      );
      mockFs.set(dest, { dir: false, size: file?.bytes ?? 1 });

      return { status: 200, uri: dest };
    },
    pauseAsync: async () => ({ url, fileUri: dest, options: {}, resumeData: 'resume' }),
  })),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

jest.mock('@/modules/on-device-ai', () => ({
  onDeviceAiModule: {
    storageDirectory: jest.fn(() => 'file:///no-backup/local-ai'),
    sha256File: jest.fn(async (path: string) => {
      const { LOCAL_MODELS } = jest.requireActual('@/constants/localModels');
      const file = LOCAL_MODELS.flatMap((m: { files: { path: string }[] }) => m.files).find(
        (f: { path: string }) => path.endsWith(f.path)
      );
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
  deleteLocalModel,
  localModelStore,
  localTextModelStore,
  registerLocalModelUnloader,
  resetLocalModelStoreForTests,
} from '../modelStore';

const MAIN_FOLDER = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}`;
const TEXT_BASE = `${ROOT}/text`;
const TEXT_FOLDER = `${TEXT_BASE}/models/${LOCAL_TEXT_MODEL.id}@${LOCAL_TEXT_MODEL.revision}`;
const TEXT_FILE = LOCAL_TEXT_MODEL.files[0];

beforeEach(() => {
  mockFs.clear();
  mockStorage.clear();
  mockFree = 10e9;
  mockStatus = 200;
  mockBadHash = null;
  mockUrls.length = 0;
  mockExcluded.length = 0;
  resetLocalModelStoreForTests();
});

describe('localTextModelStore', () => {
  it('downloads its one file into its own partial folder and installs it last-record-first', async () => {
    await localTextModelStore.start();

    expect(mockUrls).toHaveLength(1);
    expect(mockUrls[0]).toContain(LOCAL_TEXT_MODEL.repo);
    expect(mockFs.has(`${TEXT_FOLDER}/${TEXT_FILE.path}`)).toBe(true);
    expect(mockFs.has(`${TEXT_FOLDER}/installed.json`)).toBe(true);
    expect(mockFs.has(`${TEXT_BASE}/.partial`)).toBe(false);
    expect(localTextModelStore.getSnapshot().state).toMatchObject({
      kind: 'ready',
      withProjector: false,
    });
    expect(localTextModelStore.getSnapshot().selection).toEqual({ withProjector: false });
  });

  it('returns its own manifest with no projector from getInstalled', async () => {
    expect(await localTextModelStore.getInstalled()).toBeNull();
    await localTextModelStore.start();

    const installed = await localTextModelStore.getInstalled();
    expect(installed?.manifest).toBe(LOCAL_TEXT_MODEL);
    expect(installed?.projectorPath).toBeNull();
    expect(installed?.modelPath).toBe(`${TEXT_FOLDER}/${TEXT_FILE.path}`);
    expect(localTextModelStore.manifest).toBe(LOCAL_TEXT_MODEL);
    expect(localModelStore.manifest).toBe(DEFAULT_LOCAL_MODEL);
  });

  it('keeps both installs when each store refreshes after both are installed', async () => {
    await localModelStore.start({ withProjector: false });
    await localTextModelStore.start();
    await localModelStore.refresh();
    await localTextModelStore.refresh();

    expect(localModelStore.getSnapshot().state.kind).toBe('ready');
    expect(localTextModelStore.getSnapshot().state.kind).toBe('ready');
    expect(mockFs.has(`${MAIN_FOLDER}/installed.json`)).toBe(true);
    expect(mockFs.has(`${TEXT_FOLDER}/installed.json`)).toBe(true);
    expect((await localModelStore.getInstalled())?.manifest).toBe(DEFAULT_LOCAL_MODEL);
  });

  it('does not clean the other store partial files while it scans', async () => {
    const mainPartial = `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}`;
    const textPartial = `${TEXT_BASE}/.partial/${LOCAL_TEXT_MODEL.id}@${LOCAL_TEXT_MODEL.revision}`;
    mockFs.set(`${mainPartial}/part.gguf`, { dir: false, size: 10 });
    mockFs.set(`${textPartial}/${TEXT_FILE.path}`, { dir: false, size: 10 });

    await localModelStore.refresh();
    await localTextModelStore.refresh();

    expect(mockFs.has(`${mainPartial}/part.gguf`)).toBe(true);
    expect(mockFs.has(`${textPartial}/${TEXT_FILE.path}`)).toBe(true);
  });

  it('keeps snapshots and listeners independent', async () => {
    const mainListener = jest.fn();
    const textListener = jest.fn();
    localModelStore.subscribe(mainListener);
    localTextModelStore.subscribe(textListener);

    await localTextModelStore.start();

    expect(textListener).toHaveBeenCalled();
    expect(mainListener).not.toHaveBeenCalled();
    expect(localModelStore.getSnapshot().state.kind).toBe('notInstalled');
  });

  it('removes only its own files', async () => {
    await localModelStore.start({ withProjector: false });
    await localTextModelStore.start();

    await localTextModelStore.remove();

    expect(mockFs.has(`${TEXT_FOLDER}/installed.json`)).toBe(false);
    expect(mockFs.has(`${MAIN_FOLDER}/installed.json`)).toBe(true);
    expect(localTextModelStore.getSnapshot().state.kind).toBe('notInstalled');
  });

  it('deleteLocalModel removes both and unloads first', async () => {
    const unload = jest.fn(async () => {});
    registerLocalModelUnloader(unload);
    await localModelStore.start({ withProjector: false });
    await localTextModelStore.start();

    await deleteLocalModel();

    expect(unload).toHaveBeenCalled();
    expect(mockFs.has(`${TEXT_FOLDER}/installed.json`)).toBe(false);
    expect(mockFs.has(`${MAIN_FOLDER}/installed.json`)).toBe(false);
    expect(localModelStore.getSnapshot().state.kind).toBe('notInstalled');
    expect(localTextModelStore.getSnapshot().state.kind).toBe('notInstalled');
  });

  it('saves pause data under its own key', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    let finish!: (result: never) => void;
    fs.createDownloadResumable.mockImplementationOnce((url: string, dest: string) => ({
      downloadAsync: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      pauseAsync: async () => {
        finish(undefined as never);

        return { url, fileUri: dest, options: {}, resumeData: 'resume' };
      },
    }));

    const download = localTextModelStore.start();
    await ready;
    await localTextModelStore.pause();
    await download;

    expect(mockStorage.has(LOCAL_TEXT_MODEL_DOWNLOAD_STATE)).toBe(true);
    expect(mockStorage.has(LOCAL_MODEL_DOWNLOAD_STATE)).toBe(false);
    expect(localTextModelStore.getSnapshot().state.kind).toBe('paused');
  });
});
