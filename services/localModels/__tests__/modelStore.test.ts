import { LOCAL_MODEL_DOWNLOAD_STATE } from '@/constants/misc';
import { reportAiEvent } from '@/utils/aiTelemetry';
import { DEFAULT_LOCAL_MODEL } from '@/constants/localModels';

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

import { handleError } from '@/utils/handleError';
import {
  cancelLocalModelDownload,
  deleteLocalModel,
  getInstalledLocalModel,
  getFreeDiskBytes,
  getLocalModelSpaceCheck,
  pauseLocalModelDownload,
  getLocalModelSnapshot,
  refreshLocalModel,
  registerLocalModelUnloader,
  resetLocalModelStoreForTests,
  startLocalModelDownload,
} from '../modelStore';

const FOLDER = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}`;

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

describe('startLocalModelDownload', () => {
  it('does not reject if the storage directory lookup fails', async () => {
    const native = jest.requireMock('@/modules/on-device-ai').onDeviceAiModule;
    native.storageDirectory.mockImplementationOnce(() => {
      throw new Error('storage');
    });
    await expect(startLocalModelDownload()).resolves.toBeUndefined();
    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'storage' });
  });

  it('treats unreadable partial files as unavailable for reuse', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    fs.getInfoAsync.mockRejectedValueOnce(new Error('storage'));
    mockFree = 100e6;
    await expect(getLocalModelSpaceCheck({ withProjector: false })).resolves.toMatchObject({
      enough: false,
    });
  });

  it('continues a download when native pause fails', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    let finish!: (result: { status: number; uri: string }) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    fs.createDownloadResumable.mockImplementationOnce((_url: string, dest: string) => ({
      downloadAsync: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      pauseAsync: async () => {
        throw new Error('pause failed');
      },
    }));
    const download = startLocalModelDownload({ withProjector: false });
    await ready;
    const pause = pauseLocalModelDownload();
    await Promise.resolve();
    const file = DEFAULT_LOCAL_MODEL.files.find((item) => item.role === 'model')!;
    const dest = `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/${file.path}`;
    mockFs.set(dest, { dir: false, size: file.bytes });
    finish({ status: 200, uri: dest });
    await Promise.all([pause, download]);
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
  });

  it('reserves the download before checking disk space', async () => {
    await Promise.all([
      startLocalModelDownload({ withProjector: false }),
      startLocalModelDownload({ withProjector: false }),
    ]);
    expect(mockUrls).toHaveLength(1);
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
  });

  it('waits for a cancelled admission check before allowing another start', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    let release!: (bytes: number) => void;
    fs.getFreeDiskStorageAsync.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          release = resolve;
        })
    );
    const first = startLocalModelDownload({ withProjector: false });
    const cancelling = cancelLocalModelDownload();
    await startLocalModelDownload({ withProjector: false });
    release(10e9);
    await Promise.all([first, cancelling]);
    expect(mockUrls).toHaveLength(0);
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
  });

  it('reuses a complete partial file when checking free space', async () => {
    const model = DEFAULT_LOCAL_MODEL.files.find((file) => file.role === 'model')!;
    mockFs.set(
      `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/${model.path}`,
      {
        dir: false,
        size: model.bytes,
      }
    );
    mockFree = 350e6;
    await startLocalModelDownload({ withProjector: false });
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
    expect(mockUrls).toHaveLength(0);
  });

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
    // A published file that no longer hashes to its manifest is a fault to look at, not just a retry.
    expect(reportAiEvent).toHaveBeenCalledWith(
      'local-model-checksum-mismatch',
      expect.objectContaining({ file: 'LFM2.5-VL-450M-Q4_0.gguf' })
    );
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

  it('excludes root from backup as soon as .partial is created, even if download fails', async () => {
    mockStatus = 404;
    await startLocalModelDownload({ withProjector: false });

    expect(mockExcluded).toContain(ROOT);
    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'http' });
  });

  it('counts unresumable partial bytes as reclaimable in the space check', async () => {
    const partialPath = `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/LFM2.5-VL-450M-Q4_0.gguf`;
    mockFs.set(partialPath, { dir: false, size: 150e6 });
    mockFree = 400e6;
    await expect(getLocalModelSpaceCheck({ withProjector: false })).resolves.toEqual({
      enough: true,
    });
  });

  it('cleans up staging without leaving a partial target if moveAsync fails during install', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    const origMove = fs.moveAsync.getMockImplementation();
    let calls = 0;
    fs.moveAsync.mockImplementation(async (args: { from: string; to: string }) => {
      calls += 1;
      if (calls === 2) {
        throw new Error('ENOSPC: no space');
      }

      return origMove(args);
    });

    await startLocalModelDownload({ withProjector: true });
    fs.moveAsync.mockImplementation(origMove);

    expect(getLocalModelSnapshot().state).toEqual({ kind: 'failed', reason: 'noSpace' });
    expect([...mockFs.keys()].some((key) => key.startsWith(`${ROOT}/models/`))).toBe(false);
    expect(await getInstalledLocalModel()).toBeNull();
  });

  it('completes cleanly when the last file finishes right as pauseLocalModelDownload is called', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    const file = DEFAULT_LOCAL_MODEL.files.find((item) => item.role === 'model')!;
    const dest = `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/${file.path}`;
    let finish!: (result: { status: number; uri: string }) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });

    fs.createDownloadResumable.mockImplementationOnce((_url: string, d: string) => ({
      downloadAsync: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      pauseAsync: async () => {
        throw new Error('DownloadTaskNotFoundException');
      },
    }));

    const download = startLocalModelDownload({ withProjector: false });
    await ready;

    // Simulate download finishing right before pauseAsync fails.
    mockFs.set(dest, { dir: false, size: file.bytes });
    finish({ status: 200, uri: dest });
    const pause = pauseLocalModelDownload();
    await Promise.all([pause, download]);

    expect(getLocalModelSnapshot().state.kind).toBe('ready');
    expect(mockStorage.size).toBe(0);
  });

  it('pauses cleanly between files when file 1 completes right as pause is requested', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    const model = DEFAULT_LOCAL_MODEL.files.find((item) => item.role === 'model')!;
    const dest = `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/${model.path}`;
    let finish!: (result: { status: number; uri: string }) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });

    fs.createDownloadResumable.mockImplementationOnce((url: string, d: string) => ({
      downloadAsync: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      pauseAsync: async () => ({ url, fileUri: d, options: {}, resumeData: 'stale-file1' }),
    }));

    const download = startLocalModelDownload({ withProjector: true });
    await ready;

    mockFs.set(dest, { dir: false, size: model.bytes });
    finish({ status: 200, uri: dest });
    const pause = pauseLocalModelDownload();
    await Promise.all([pause, download]);

    expect(getLocalModelSnapshot().state).toEqual({
      kind: 'paused',
      receivedBytes: model.bytes,
      totalBytes: DEFAULT_LOCAL_MODEL.files.reduce((sum, f) => sum + f.bytes, 0),
    });
    expect(mockStorage.size).toBe(0);
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

  it('ignores and cleans up an incomplete install folder with no installed.json', async () => {
    mockFs.set(`${FOLDER}`, { dir: true, size: 0 });
    mockFs.set(`${FOLDER}/LFM2.5-VL-450M-Q4_0.gguf`, { dir: false, size: 5 });
    mockFs.set(
      `${ROOT}/models/.${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}.staging/x`,
      {
        dir: false,
        size: 5,
      }
    );
    await refreshLocalModel();

    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
    expect(await getInstalledLocalModel()).toBeNull();
    expect([...mockFs.keys()].some((key) => key.startsWith(`${ROOT}/models/`))).toBe(false);
  });

  it('keeps an older revision usable with updateAvailable until replaced by the current one', async () => {
    const oldFolder = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@oldrev`;
    const modelFile = DEFAULT_LOCAL_MODEL.files.find((file) => file.role === 'model')!;
    mockFs.set(oldFolder, { dir: true, size: 0 });
    mockFs.set(`${oldFolder}/${modelFile.path}`, { dir: false, size: modelFile.bytes });
    mockFs.set(`${oldFolder}/installed.json`, {
      dir: false,
      size: 10,
      text: JSON.stringify({
        id: DEFAULT_LOCAL_MODEL.id,
        revision: 'oldrev',
        files: [
          {
            role: 'model',
            path: modelFile.path,
            bytes: modelFile.bytes,
            sha256: modelFile.sha256,
          },
        ],
        installedAt: 100,
      }),
    });

    await refreshLocalModel();
    expect(getLocalModelSnapshot()).toMatchObject({
      state: { kind: 'ready', revision: 'oldrev', withProjector: false },
      updateAvailable: true,
      projectorInstalled: false,
    });
    const installedOld = await getInstalledLocalModel();
    expect(installedOld?.modelPath).toBe(`${oldFolder}/${modelFile.path}`);

    const unloaded: string[] = [];
    registerLocalModelUnloader(async () => {
      unloaded.push('unloaded');
    });
    await startLocalModelDownload({ withProjector: true });

    expect(unloaded).toEqual(['unloaded']);
    expect(mockFs.has(`${oldFolder}/installed.json`)).toBe(false);
    expect(getLocalModelSnapshot()).toMatchObject({
      state: { kind: 'ready', revision: DEFAULT_LOCAL_MODEL.revision, withProjector: true },
      updateAvailable: false,
      projectorInstalled: true,
    });
  });

  it('cleans up lingering older revision folders when current revision is already installed', async () => {
    const oldFolder = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@oldrev`;
    const modelFile = DEFAULT_LOCAL_MODEL.files.find((file) => file.role === 'model')!;
    await startLocalModelDownload({ withProjector: false });
    mockFs.set(oldFolder, { dir: true, size: 0 });
    mockFs.set(`${oldFolder}/installed.json`, {
      dir: false,
      size: 10,
      text: JSON.stringify({
        id: DEFAULT_LOCAL_MODEL.id,
        revision: 'oldrev',
        files: [{ role: 'model', path: modelFile.path, bytes: modelFile.bytes, sha256: 'x' }],
        installedAt: 100,
      }),
    });

    await refreshLocalModel();
    expect(mockFs.has(`${oldFolder}/installed.json`)).toBe(false);
    expect(getLocalModelSnapshot().updateAvailable).toBe(false);
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

  it('cancelling an update preserves the older installed revision', async () => {
    const oldFolder = `${ROOT}/models/${DEFAULT_LOCAL_MODEL.id}@oldrev`;
    const modelFile = DEFAULT_LOCAL_MODEL.files.find((file) => file.role === 'model')!;
    mockFs.set(oldFolder, { dir: true, size: 0 });
    mockFs.set(`${oldFolder}/${modelFile.path}`, { dir: false, size: modelFile.bytes });
    mockFs.set(`${oldFolder}/installed.json`, {
      dir: false,
      size: 10,
      text: JSON.stringify({
        id: DEFAULT_LOCAL_MODEL.id,
        revision: 'oldrev',
        files: [{ role: 'model', path: modelFile.path, bytes: modelFile.bytes, sha256: 'x' }],
        installedAt: 100,
      }),
    });
    await refreshLocalModel();

    const fs = jest.requireMock('expo-file-system/legacy');
    let finish!: (result: undefined) => void;
    let started!: () => void;
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    fs.createDownloadResumable.mockImplementationOnce((url: string, d: string) => ({
      downloadAsync: () => {
        started();
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
      pauseAsync: async () => {
        finish(undefined);
        return { url, fileUri: d, options: {}, resumeData: 'r' };
      },
    }));

    const download = startLocalModelDownload({ withProjector: false });
    await ready;
    await cancelLocalModelDownload();
    await download;

    expect(getLocalModelSnapshot()).toMatchObject({
      state: { kind: 'ready', revision: 'oldrev', withProjector: false },
      updateAvailable: true,
    });
  });
});

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function modelDestination() {
  const file = DEFAULT_LOCAL_MODEL.files.find((item) => item.role === 'model')!;

  return {
    file,
    dest: `${ROOT}/.partial/${DEFAULT_LOCAL_MODEL.id}@${DEFAULT_LOCAL_MODEL.revision}/${file.path}`,
  };
}

/** A download that stays open until `finish` is called, with a configurable pause. */
function holdNextDownload(pauseAsync: () => Promise<unknown>) {
  const fs = jest.requireMock('expo-file-system/legacy');
  const handle = {} as {
    finish: (result: { status: number; uri: string }) => void;
    ready: Promise<void>;
  };
  let started!: () => void;
  handle.ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  fs.createDownloadResumable.mockImplementationOnce(() => ({
    downloadAsync: () => {
      started();

      return new Promise((resolve) => {
        handle.finish = resolve;
      });
    },
    pauseAsync,
  }));

  return handle;
}

/** Holds the next `deleteAsync` call open until the returned `release` is called. */
function gateNextDelete() {
  const fs = jest.requireMock('expo-file-system/legacy');
  const original = fs.deleteAsync.getMockImplementation();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  fs.deleteAsync.mockImplementationOnce(async (uri: string) => {
    await gate;

    return original(uri);
  });

  return release;
}

describe('lifecycle operations run one at a time', () => {
  beforeEach(() => {
    (handleError as jest.Mock).mockClear();
  });

  it('a start requested during a delete waits for the delete to finish', async () => {
    await startLocalModelDownload({ withProjector: false });
    mockUrls.length = 0;
    const release = gateNextDelete();

    const deleting = deleteLocalModel();
    await flush();
    const starting = startLocalModelDownload({ withProjector: false });
    await flush();
    expect(mockUrls).toHaveLength(0);

    release();
    await Promise.all([deleting, starting]);
    expect(mockUrls).toHaveLength(1);
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
  });

  it('a refresh requested during a delete reads the disk only after it', async () => {
    await startLocalModelDownload({ withProjector: false });
    const fs = jest.requireMock('expo-file-system/legacy');
    const release = gateNextDelete();

    const deleting = deleteLocalModel();
    await flush();
    const readsBefore = fs.readDirectoryAsync.mock.calls.length;
    const refreshing = refreshLocalModel();
    await flush();
    expect(fs.readDirectoryAsync.mock.calls.length).toBe(readsBefore);

    release();
    await Promise.all([deleting, refreshing]);
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
  });

  it('a pause that lands as the last file finishes still installs, and the store stays usable', async () => {
    const { dest, file } = modelDestination();
    const held = holdNextDownload(async () => ({
      url: '',
      fileUri: dest,
      options: {},
      resumeData: 'late',
    }));
    const download = startLocalModelDownload({ withProjector: false });
    await held.ready;

    const pause = pauseLocalModelDownload();
    mockFs.set(dest, { dir: false, size: file.bytes });
    held.finish({ status: 200, uri: dest });
    await Promise.all([pause, download]);

    expect(getLocalModelSnapshot().state.kind).toBe('ready');
    expect(mockStorage.size).toBe(0);

    await deleteLocalModel();
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
    await startLocalModelDownload({ withProjector: false });
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
  });

  it('reports a native pause failure once', async () => {
    const { dest, file } = modelDestination();
    const held = holdNextDownload(async () => {
      throw new Error('pause failed');
    });
    const download = startLocalModelDownload({ withProjector: false });
    await held.ready;

    const pause = pauseLocalModelDownload();
    await flush();
    mockFs.set(dest, { dir: false, size: file.bytes });
    held.finish({ status: 200, uri: dest });
    await Promise.all([pause, download]);

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.pause', {
      showSnackbar: false,
    });
    expect(getLocalModelSnapshot().state.kind).toBe('ready');
  });

  it('reports a native pause failure while cancelling once', async () => {
    const { dest, file } = modelDestination();
    const held = holdNextDownload(async () => {
      throw new Error('pause failed');
    });
    const download = startLocalModelDownload({ withProjector: false });
    await held.ready;

    const cancelling = cancelLocalModelDownload();
    await flush();
    mockFs.set(dest, { dir: false, size: file.bytes });
    held.finish({ status: 200, uri: dest });
    await Promise.all([cancelling, download]);

    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.cancel', {
      showSnackbar: false,
    });
    expect(getLocalModelSnapshot().state.kind).toBe('notInstalled');
  });

  it('reports an unexpected refresh failure once and does not reject', async () => {
    const native = jest.requireMock('@/modules/on-device-ai').onDeviceAiModule;
    native.storageDirectory.mockImplementationOnce(() => {
      throw new Error('storage');
    });

    await expect(refreshLocalModel()).resolves.toBeUndefined();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.refresh', {
      showSnackbar: false,
    });
  });

  it('reports an unexpected delete failure once and does not reject', async () => {
    const native = jest.requireMock('@/modules/on-device-ai').onDeviceAiModule;
    native.storageDirectory.mockImplementationOnce(() => {
      throw new Error('storage');
    });

    await expect(deleteLocalModel()).resolves.toBeUndefined();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.delete', {
      showSnackbar: false,
    });
  });

  it('does not report a network failure', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    fs.createDownloadResumable.mockImplementationOnce(() => ({
      downloadAsync: async () => {
        throw new Error('Network request failed');
      },
      pauseAsync: async () => ({}),
    }));
    await startLocalModelDownload({ withProjector: false });

    expect(getLocalModelSnapshot().state.kind).toBe('failed');
    expect(handleError).not.toHaveBeenCalled();
  });
});

describe('failures are reported', () => {
  beforeEach(() => {
    (handleError as jest.Mock).mockClear();
  });

  it('reports a free-space read failure and resolves null', async () => {
    const fs = jest.requireMock('expo-file-system/legacy');
    const error = new Error('no statfs');
    fs.getFreeDiskStorageAsync.mockRejectedValueOnce(error);

    await expect(getFreeDiskBytes()).resolves.toBeNull();
    expect(handleError).toHaveBeenCalledTimes(1);
    expect(handleError).toHaveBeenCalledWith(error, 'localModels.freeSpace', {
      showSnackbar: false,
    });
  });

  it('reports a corrupt saved download state once and does not reject', async () => {
    mockStorage.set(LOCAL_MODEL_DOWNLOAD_STATE, 'not json{');

    await expect(refreshLocalModel()).resolves.toBeUndefined();
    expect(handleError).toHaveBeenCalledWith(expect.any(Error), 'localModels.savedDownload', {
      showSnackbar: false,
    });
  });
});
