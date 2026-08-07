import { Directory, File } from 'expo-file-system';
import { deleteAsync, getInfoAsync, readDirectoryAsync } from 'expo-file-system/legacy';
import { zip } from 'react-native-zip-archive';

import {
  appendBleWorkoutSamplesToNdjsonFile,
  buildBleWorkoutFileName,
  cleanupStaleBleWorkoutTrackingFiles,
  compressRawToDataPoints,
  createBleWorkoutTrackingTempFile,
  createBleWorkoutZipFile,
  deleteBleDataPointsFiles,
  deleteBleWorkoutArchiveFile,
  deleteBleWorkoutFile,
  ensureBleWorkoutDataDir,
  ensureBleWorkoutShareDir,
  isBleWorkoutFile,
  loadAllBleWorkoutFiles,
  readBleDataPointsFile,
  saveBleWorkoutFile,
  type BleWorkoutSample,
} from '@/utils/bleWorkoutDataStorage';

// A small in-memory filesystem shared by both expo-file-system entry points, so these are
// real round-trips (write the header + NDJSON, then read the JSON back) rather than
// call-argument assertions. The `mock` prefix is required for jest.mock factory hoisting.
const mockFs = new Map<string, { content: string; modificationTime?: number }>();
const mockDirs = new Set<string>();

const normalizeUri = (uri: string) => uri.replace(/\/+$/, '');

jest.mock('expo-file-system', () => {
  const norm = (uri: string) => uri.replace(/\/+$/, '');
  const toUri = (segment: any) => (typeof segment === 'string' ? segment : segment.uri);
  const join = (segments: any[]) => segments.map(toUri).map(norm).filter(Boolean).join('/');

  class Directory {
    uri: string;

    constructor(...segments: any[]) {
      this.uri = join(segments);
    }

    create() {
      mockDirs.add(this.uri);
    }

    delete() {
      mockDirs.delete(this.uri);
      for (const key of Array.from(mockFs.keys())) {
        if (key.startsWith(`${this.uri}/`)) {
          mockFs.delete(key);
        }
      }
    }
  }

  class File {
    uri: string;

    constructor(...segments: any[]) {
      this.uri = join(segments);
    }

    get parentDirectory() {
      return new Directory(this.uri.slice(0, this.uri.lastIndexOf('/')));
    }

    write(text: string, options?: { append?: boolean }) {
      const existing = options?.append ? (mockFs.get(this.uri)?.content ?? '') : '';
      mockFs.set(this.uri, { content: existing + text });
    }

    delete() {
      mockFs.delete(this.uri);
    }

    open() {
      const bytes = new TextEncoder().encode(mockFs.get(this.uri)?.content ?? '');
      let offset = 0;
      return {
        readBytes(count: number) {
          const chunk = bytes.slice(offset, offset + count);
          offset += chunk.length;
          return chunk;
        },
        close() {},
      };
    }
  }

  return {
    Directory,
    File,
    FileMode: { Append: 'a', ReadOnly: 'r', ReadWrite: 'rw', WriteOnly: 'w' },
  };
});

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  documentDirectory: 'file:///document/',
  deleteAsync: jest.fn(async (uri: string) => {
    const normalized = uri.replace(/\/+$/, '');
    mockFs.delete(normalized);
    mockDirs.delete(normalized);
    for (const key of Array.from(mockFs.keys())) {
      if (key.startsWith(`${normalized}/`)) {
        mockFs.delete(key);
      }
    }
  }),
  getInfoAsync: jest.fn(async (uri: string) => {
    const entry = mockFs.get(uri.replace(/\/+$/, ''));
    return entry ? { exists: true, modificationTime: entry.modificationTime } : { exists: false };
  }),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockDirs.add(uri.replace(/\/+$/, ''));
  }),
  readAsStringAsync: jest.fn(async (uri: string) => {
    const entry = mockFs.get(uri.replace(/\/+$/, ''));
    if (!entry) {
      throw new Error(`ENOENT: ${uri}`);
    }
    return entry.content;
  }),
  readDirectoryAsync: jest.fn(async (uri: string) => {
    const dir = uri.replace(/\/+$/, '');
    if (!mockDirs.has(dir)) {
      throw new Error(`ENOENT: ${uri}`);
    }
    const names = new Set<string>();
    for (const key of [...mockFs.keys(), ...mockDirs]) {
      if (key.startsWith(`${dir}/`)) {
        names.add(key.slice(dir.length + 1).split('/')[0]);
      }
    }
    return [...names];
  }),
  writeAsStringAsync: jest.fn(async (uri: string, content: string) => {
    mockFs.set(uri.replace(/\/+$/, ''), { content });
  }),
}));

jest.mock('react-native-zip-archive', () => ({
  zip: jest.fn(async () => 'file:///cache/ble-workout-share/out.zip'),
}));

const DATA_DIR = 'file:///document/ble-workout-data';
const TRACKING_DIR = 'file:///cache/ble-workout-tracking';

const writeFile = (uri: string, content: string, modificationTime?: number) => {
  mockFs.set(normalizeUri(uri), { content, modificationTime });
};

const sample = (timestamp: number): BleWorkoutSample => ({
  timestamp,
  accel: { x: 1, y: 2, z: 3 } as any,
  gyro: { x: 4, y: 5, z: 6 } as any,
  angle: { x: 7, y: 8, z: 9 } as any,
});

const metadata = (overrides: Record<string, unknown> = {}) => ({
  version: 1 as const,
  workoutLogId: 'log-1',
  exerciseName: 'Bench Press',
  muscleGroup: 'chest',
  equipmentType: 'barbell',
  mechanicType: 'compound',
  setNumber: 2,
  deviceId: 'dev-1',
  deviceDisplayName: 'WT901',
  startedAt: '2026-05-20T10:00:00.000Z',
  stoppedAt: '2026-05-20T10:01:00.000Z',
  sampleCount: 0,
  ...overrides,
});

describe('bleWorkoutDataStorage', () => {
  beforeEach(() => {
    mockFs.clear();
    mockDirs.clear();
    jest.clearAllMocks();
  });

  describe('buildBleWorkoutFileName', () => {
    it('slugifies the exercise name and embeds the set number and ISO timestamp', () => {
      const name = buildBleWorkoutFileName(
        'Bench Press',
        2,
        Date.parse('2026-05-20T10:00:00.000Z')
      );

      expect(name).toMatch(/^ble_bench_press_set2_2026-05-20T10-00-00-000Z_[a-z0-9]*\.json$/);
    });

    it('collapses punctuation into single underscores and trims the edges', () => {
      expect(buildBleWorkoutFileName('  Lat-Pulldown (wide)!  ', 1, 0)).toMatch(
        /^ble_lat_pulldown_wide_set1_/
      );
    });

    it('caps the slug at 40 characters', () => {
      const name = buildBleWorkoutFileName('a'.repeat(80), 1, 0);
      const slug = name.slice('ble_'.length, name.indexOf('_set1_'));

      expect(slug).toHaveLength(40);
    });

    // An unnamed / entirely non-alphanumeric exercise would otherwise produce `ble__set1_...`.
    it('falls back to "exercise" when the name slugifies to nothing', () => {
      expect(buildBleWorkoutFileName('!!!', 3, 0)).toMatch(/^ble_exercise_set3_/);
    });

    it('adds a random suffix so two sets recorded in the same millisecond never collide', () => {
      const ts = Date.parse('2026-05-20T10:00:00.000Z');
      const names = new Set(
        Array.from({ length: 50 }, () => buildBleWorkoutFileName('Bench Press', 2, ts))
      );

      expect(names.size).toBeGreaterThan(1);
    });
  });

  describe('isBleWorkoutFile', () => {
    it('accepts a well-formed file', () => {
      expect(isBleWorkoutFile({ ...metadata(), samples: [] })).toBe(true);
    });

    it.each([
      ['null', null],
      ['a non-object', 'not-an-object'],
      ['a wrong version', { ...metadata({ version: 2 }), samples: [] }],
      ['a missing workoutLogId', { ...metadata({ workoutLogId: undefined }), samples: [] }],
      ['a non-string exerciseName', { ...metadata({ exerciseName: 5 }), samples: [] }],
      ['a non-number setNumber', { ...metadata({ setNumber: '2' }), samples: [] }],
      ['a missing samples array', metadata()],
      ['a non-array samples field', { ...metadata(), samples: {} }],
    ])('rejects %s', (_label, value) => {
      expect(isBleWorkoutFile(value)).toBe(false);
    });
  });

  describe('directory helpers', () => {
    it('creates the data directory under documentDirectory with intermediates', async () => {
      await expect(ensureBleWorkoutDataDir()).resolves.toBe('file:///document/ble-workout-data/');
      expect(mockDirs.has(DATA_DIR)).toBe(true);
    });

    // Share artefacts are throwaway zips, so they belong in the cache directory the OS may reclaim.
    it('creates the share directory under cacheDirectory', async () => {
      await expect(ensureBleWorkoutShareDir()).resolves.toBe('file:///cache/ble-workout-share/');
    });
  });

  describe('saveBleWorkoutFile', () => {
    it('writes an in-memory samples array as pretty JSON that reads back as a valid file', async () => {
      const uri = await saveBleWorkoutFile({
        ...metadata({ sampleCount: 2 }),
        samples: [sample(1), sample(2)],
      });

      const parsed = JSON.parse(mockFs.get(uri)!.content);
      expect(isBleWorkoutFile(parsed)).toBe(true);
      expect(parsed.samples).toHaveLength(2);
      expect(parsed.exerciseName).toBe('Bench Press');
    });

    // The streaming path exists so a long set never has to materialise every sample in RAM;
    // the NDJSON temp file has to come out the other side as a *valid* JSON array.
    it('streams an NDJSON temp file into a valid JSON array without loading it all into memory', async () => {
      mockDirs.add(`${TRACKING_DIR}/session-1`);
      const samplesFile = new File(`${TRACKING_DIR}/session-1`, 'samples.ndjson');
      appendBleWorkoutSamplesToNdjsonFile(samplesFile, [sample(1), sample(2), sample(3)]);

      const uri = await saveBleWorkoutFile({
        ...metadata({ sampleCount: 3, reps: 8, userHeightCm: 180, userWeightKg: 80 }),
        samplesFile,
      });

      const parsed = JSON.parse(mockFs.get(uri)!.content);
      expect(isBleWorkoutFile(parsed)).toBe(true);
      expect(parsed.samples.map((s: BleWorkoutSample) => s.timestamp)).toEqual([1, 2, 3]);
      expect(parsed.reps).toBe(8);
      expect(parsed.userHeightCm).toBe(180);
      expect(parsed.userWeightKg).toBe(80);
    });

    it('emits a valid empty samples array when the NDJSON temp file has no lines', async () => {
      mockDirs.add(`${TRACKING_DIR}/session-empty`);
      const samplesFile = new File(`${TRACKING_DIR}/session-empty`, 'samples.ndjson');
      samplesFile.write('', { append: false });

      const uri = await saveBleWorkoutFile({ ...metadata(), samplesFile });

      const parsed = JSON.parse(mockFs.get(uri)!.content);
      expect(parsed.samples).toEqual([]);
    });

    it('deletes the tracking session directory once the samples have been folded in', async () => {
      mockDirs.add(`${TRACKING_DIR}/session-1`);
      const samplesFile = new File(`${TRACKING_DIR}/session-1`, 'samples.ndjson');
      appendBleWorkoutSamplesToNdjsonFile(samplesFile, [sample(1)]);

      await saveBleWorkoutFile({ ...metadata({ sampleCount: 1 }), samplesFile });

      expect(mockFs.has(`${TRACKING_DIR}/session-1/samples.ndjson`)).toBe(false);
      expect(mockDirs.has(`${TRACKING_DIR}/session-1`)).toBe(false);
    });

    it('omits optional metadata fields that were not provided', async () => {
      const uri = await saveBleWorkoutFile({ ...metadata(), samplesFile: makeNdjsonFile([]) });
      const parsed = JSON.parse(mockFs.get(uri)!.content);

      expect(parsed).not.toHaveProperty('reps');
      expect(parsed).not.toHaveProperty('userGender');
      expect(parsed).not.toHaveProperty('userAgeYears');
    });
  });

  describe('appendBleWorkoutSamplesToNdjsonFile', () => {
    it('appends one JSON object per line without rewriting what is already there', () => {
      const file = makeNdjsonFile([]);
      appendBleWorkoutSamplesToNdjsonFile(file, [sample(1)]);
      appendBleWorkoutSamplesToNdjsonFile(file, [sample(2)]);

      const lines = mockFs.get(file.uri)!.content.trim().split('\n');
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0]).timestamp).toBe(1);
      expect(JSON.parse(lines[1]).timestamp).toBe(2);
    });

    // Called from the BLE notification handler on every flush; an empty batch is the common
    // case and must not touch the filesystem.
    it('does not write anything for an empty batch', () => {
      const file = makeNdjsonFile([]);
      const before = mockFs.get(file.uri)!.content;

      appendBleWorkoutSamplesToNdjsonFile(file, []);

      expect(mockFs.get(file.uri)!.content).toBe(before);
    });
  });

  describe('createBleWorkoutTrackingTempFile', () => {
    it('creates the session directory and truncates the samples file', () => {
      writeFile(`${TRACKING_DIR}/session-9/samples.ndjson`, 'stale content');

      const file = createBleWorkoutTrackingTempFile('session-9');

      expect(file.uri).toBe(`${TRACKING_DIR}/session-9/samples.ndjson`);
      expect(mockDirs.has(`${TRACKING_DIR}/session-9`)).toBe(true);
      expect(mockFs.get(file.uri)!.content).toBe('');
    });
  });

  describe('loadAllBleWorkoutFiles', () => {
    it('returns valid files newest-first by stoppedAt', async () => {
      writeFile(
        `${DATA_DIR}/ble_old.json`,
        JSON.stringify({
          ...metadata({ stoppedAt: '2026-05-20T10:00:00.000Z' }),
          samples: [],
        })
      );
      writeFile(
        `${DATA_DIR}/ble_new.json`,
        JSON.stringify({
          ...metadata({ stoppedAt: '2026-05-21T10:00:00.000Z' }),
          samples: [],
        })
      );

      const files = await loadAllBleWorkoutFiles();

      expect(files.map((f) => f.fileName)).toEqual(['ble_new.json', 'ble_old.json']);
      expect(files[0].uri).toBe(`${DATA_DIR}/ble_new.json`);
    });

    // A truncated write (app killed mid-save) or a `data_points_*.json` sidecar must not take
    // the whole BLE data list down with it.
    it('skips unparseable and structurally invalid files instead of throwing', async () => {
      writeFile(`${DATA_DIR}/ble_good.json`, JSON.stringify({ ...metadata(), samples: [] }));
      writeFile(`${DATA_DIR}/ble_truncated.json`, '{"version": 1, "sam');
      writeFile(`${DATA_DIR}/ble_wrong_shape.json`, JSON.stringify({ version: 2 }));

      const files = await loadAllBleWorkoutFiles();

      expect(files.map((f) => f.fileName)).toEqual(['ble_good.json']);
    });

    it('ignores non-.json entries', async () => {
      writeFile(`${DATA_DIR}/ble_good.json`, JSON.stringify({ ...metadata(), samples: [] }));
      writeFile(`${DATA_DIR}/notes.txt`, 'hello');

      const files = await loadAllBleWorkoutFiles();

      expect(files).toHaveLength(1);
    });

    it('returns an empty list when the directory cannot be read', async () => {
      (readDirectoryAsync as jest.Mock).mockRejectedValueOnce(new Error('EACCES'));

      await expect(loadAllBleWorkoutFiles()).resolves.toEqual([]);
    });
  });

  describe('data point files', () => {
    // `compressRawToDataPoints` streams the saved file line by line and only recognises a
    // sample when the whole object sits on one line — i.e. it is coupled to the NDJSON
    // streaming save path, which is what both production callers use.
    const saveStreamed = async (sampleCount: number) => {
      await saveBleWorkoutFile({
        ...metadata({ sampleCount }),
        samplesFile: makeNdjsonFile(Array.from({ length: sampleCount }, (_, i) => sample(i))),
      });
      return [...mockFs.keys()].find((k) => k.includes('/ble_bench_press_'))!;
    };

    it('downsamples with a uniform stride derived from sampleCount and reps', async () => {
      // 500 samples, 4 reps -> max(4 * 10, 50) = 50 points -> stride 10 -> 50 kept.
      const bleUri = await saveStreamed(500);

      const outUri = await compressRawToDataPoints(bleUri, 'set-1', 4);

      expect(outUri).toBe(`${DATA_DIR}/data_points_set-1.json`);
      const points = JSON.parse(mockFs.get(outUri)!.content);
      expect(points).toHaveLength(50);
      expect(points.map((p: BleWorkoutSample) => p.timestamp).slice(0, 3)).toEqual([0, 10, 20]);
    });

    // Short sets must not be thinned below the floor that makes the rep chart legible.
    it('keeps every sample when there are fewer than the minimum data points', async () => {
      const bleUri = await saveStreamed(20);

      const outUri = await compressRawToDataPoints(bleUri, 'set-2', 1);

      expect(JSON.parse(mockFs.get(outUri)!.content)).toHaveLength(20);
    });

    it('round-trips the compressed points through readBleDataPointsFile', async () => {
      const bleUri = await saveStreamed(60);
      await compressRawToDataPoints(bleUri, 'set-3', 2);

      const points = await readBleDataPointsFile('set-3');

      expect(points).toHaveLength(60);
      expect(points![0].timestamp).toBe(0);
    });

    it('produces a valid empty array when the source has no samples', async () => {
      const bleUri = await saveStreamed(0);

      const outUri = await compressRawToDataPoints(bleUri, 'set-4', 3);

      expect(JSON.parse(mockFs.get(outUri)!.content)).toEqual([]);
    });

    it('returns null when there is no data points file for the set', async () => {
      await expect(readBleDataPointsFile('missing-set')).resolves.toBeNull();
    });

    it('returns null when the data points file is corrupt', async () => {
      writeFile(`${DATA_DIR}/data_points_bad.json`, '[{"timestamp":');

      await expect(readBleDataPointsFile('bad')).resolves.toBeNull();
    });

    it('deletes the data point files for the given set ids', async () => {
      writeFile(`${DATA_DIR}/data_points_a.json`, '[]');
      writeFile(`${DATA_DIR}/data_points_b.json`, '[]');

      await deleteBleDataPointsFiles(['a', 'b']);

      expect(mockFs.has(`${DATA_DIR}/data_points_a.json`)).toBe(false);
      expect(mockFs.has(`${DATA_DIR}/data_points_b.json`)).toBe(false);
    });

    it('does not touch the filesystem for an empty set id list', async () => {
      await deleteBleDataPointsFiles([]);

      expect(deleteAsync).not.toHaveBeenCalled();
    });
  });

  describe('sharing', () => {
    it('zips the given files into the share directory', async () => {
      const uri = await createBleWorkoutZipFile([`${DATA_DIR}/a.json`, `${DATA_DIR}/b.json`]);

      expect(zip).toHaveBeenCalledWith(
        [`${DATA_DIR}/a.json`, `${DATA_DIR}/b.json`],
        expect.stringContaining('file:///cache/ble-workout-share/ble_workout_files_2_')
      );
      expect(uri).toContain('ble_workout_files_2_');
      expect(uri.endsWith('.zip')).toBe(true);
    });

    it('throws rather than producing an empty archive', async () => {
      await expect(createBleWorkoutZipFile([])).rejects.toThrow(
        'No BLE workout files available to zip'
      );
      expect(zip).not.toHaveBeenCalled();
    });

    it('deletes archives and data files idempotently', async () => {
      await deleteBleWorkoutArchiveFile('file:///cache/ble-workout-share/x.zip');
      await deleteBleWorkoutFile(`${DATA_DIR}/ble_x.json`);

      expect(deleteAsync).toHaveBeenNthCalledWith(1, 'file:///cache/ble-workout-share/x.zip', {
        idempotent: true,
      });
      expect(deleteAsync).toHaveBeenNthCalledWith(2, `${DATA_DIR}/ble_x.json`, {
        idempotent: true,
      });
    });
  });

  describe('cleanupStaleBleWorkoutTrackingFiles', () => {
    it('deletes session directories whose samples file is older than the cutoff, keeping fresh ones', async () => {
      const now = Date.now();
      mockDirs.add(TRACKING_DIR);
      writeFile(`${TRACKING_DIR}/stale/samples.ndjson`, '{}\n', now - 10_000);
      writeFile(`${TRACKING_DIR}/fresh/samples.ndjson`, '{}\n', now - 100);

      await cleanupStaleBleWorkoutTrackingFiles(5_000);

      expect(mockFs.has(`${TRACKING_DIR}/stale/samples.ndjson`)).toBe(false);
      expect(mockFs.has(`${TRACKING_DIR}/fresh/samples.ndjson`)).toBe(true);
    });

    // A session directory with no samples file is a crashed recording with nothing to recover.
    it('deletes a session directory that has no samples file at all', async () => {
      mockDirs.add(TRACKING_DIR);
      mockDirs.add(`${TRACKING_DIR}/orphan`);
      writeFile(`${TRACKING_DIR}/orphan/other.txt`, 'x');

      await cleanupStaleBleWorkoutTrackingFiles();

      expect(deleteAsync).toHaveBeenCalledWith(`${TRACKING_DIR}/orphan`, { idempotent: true });
    });

    it('is a no-op when the tracking directory does not exist yet', async () => {
      await cleanupStaleBleWorkoutTrackingFiles();

      expect(deleteAsync).not.toHaveBeenCalled();
    });

    // Cleanup runs on app start; a stat failure must not surface to the user.
    it('still attempts a delete when stat-ing the samples file throws', async () => {
      mockDirs.add(TRACKING_DIR);
      writeFile(`${TRACKING_DIR}/broken/samples.ndjson`, '{}');
      (getInfoAsync as jest.Mock).mockRejectedValueOnce(new Error('EIO'));

      await expect(cleanupStaleBleWorkoutTrackingFiles()).resolves.toBeUndefined();

      expect(deleteAsync).toHaveBeenCalledWith(`${TRACKING_DIR}/broken`, { idempotent: true });
    });
  });
});

function makeNdjsonFile(samples: BleWorkoutSample[]) {
  mockDirs.add(`${TRACKING_DIR}/session-tmp`);
  const file = new File(new Directory(`${TRACKING_DIR}/session-tmp`), 'samples.ndjson');
  file.write('', { append: false });
  appendBleWorkoutSamplesToNdjsonFile(file, samples);
  return file;
}
