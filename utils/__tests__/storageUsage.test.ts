import {
  type CacheEntry,
  formatStorageSize,
  isClearableStorageCategory,
  planTemporaryCleanup,
  splitStorageSize,
  TEMPORARY_MIN_AGE_MS,
} from '../storageUsage';

const NOW = 10_000_000_000;
const OLD = NOW - TEMPORARY_MIN_AGE_MS - 1;

const entry = (overrides: Partial<CacheEntry>): CacheEntry => ({
  name: 'file.json',
  uri: 'file:///cache/file.json',
  isDirectory: false,
  bytes: 10,
  modifiedMs: OLD,
  ...overrides,
});

describe('planTemporaryCleanup', () => {
  it('removes old leftover files and the known temporary directories', () => {
    const files = [
      entry({ name: 'export.json', uri: 'file:///cache/export.json' }),
      entry({ name: 'ImagePicker', uri: 'file:///cache/ImagePicker', isDirectory: true }),
      entry({
        name: 'ble-workout-share',
        uri: 'file:///cache/ble-workout-share',
        isDirectory: true,
      }),
    ];

    const plan = planTemporaryCleanup(files, new Set(), NOW);

    expect(plan.remove.map((e) => e.name)).toEqual([
      'export.json',
      'ImagePicker',
      'ble-workout-share',
    ]);
    expect(plan.tooNew).toEqual([]);
  });

  it('never touches a registered safety backup or its sidecar', () => {
    const backup = entry({ name: 'x-pre-migration.db', uri: 'file:///cache/x-pre-migration.db' });
    const sidecar = entry({ name: 'x-async.json', uri: 'file:///cache/x-async.json' });
    const other = entry({ name: 'photo.jpg', uri: 'file:///cache/photo.jpg' });

    const plan = planTemporaryCleanup(
      [backup, sidecar, other],
      new Set([backup.uri, sidecar.uri]),
      NOW
    );

    expect(plan.remove).toEqual([other]);
  });

  it('leaves the live sensor recording and library-owned cache directories alone', () => {
    const entries = [
      entry({
        name: 'ble-workout-tracking',
        uri: 'file:///cache/ble-workout-tracking',
        isDirectory: true,
      }),
      entry({
        name: 'image_manager_disk_cache',
        uri: 'file:///cache/image_manager_disk_cache',
        isDirectory: true,
      }),
    ];

    const plan = planTemporaryCleanup(entries, new Set(), NOW);

    expect(plan.remove).toEqual([]);
    expect(plan.tooNew).toEqual([]);
  });

  it('keeps files that are recent or of unknown age', () => {
    const recent = entry({ name: 'a.csv', uri: 'file:///cache/a.csv', modifiedMs: NOW - 1000 });
    const unknown = entry({ name: 'b.csv', uri: 'file:///cache/b.csv', modifiedMs: null });

    const plan = planTemporaryCleanup([recent, unknown], new Set(), NOW);

    expect(plan.remove).toEqual([]);
    expect(plan.tooNew).toEqual([recent, unknown]);
  });
});

describe('storage categories', () => {
  it('offers to clear only rebuildable data', () => {
    expect(isClearableStorageCategory('exerciseImages')).toBe(true);
    expect(isClearableStorageCategory('temporary')).toBe(true);
    expect(isClearableStorageCategory('database')).toBe(false);
    expect(isClearableStorageCategory('photos')).toBe(false);
    expect(isClearableStorageCategory('recoveryPoints')).toBe(false);
    expect(isClearableStorageCategory('sensorRecordings')).toBe(false);
  });
});

describe('storage sizes', () => {
  const units = { b: 'B', kb: 'KB', mb: 'MB', gb: 'GB' };

  it('uses decimal steps', () => {
    expect(splitStorageSize(999)).toEqual({ value: 999, unit: 'b' });
    expect(splitStorageSize(1000)).toEqual({ value: 1, unit: 'kb' });
    expect(splitStorageSize(2_500_000)).toEqual({ value: 2.5, unit: 'mb' });
    expect(splitStorageSize(-5)).toEqual({ value: 0, unit: 'b' });
    expect(splitStorageSize(Number.NaN)).toEqual({ value: 0, unit: 'b' });
  });

  it('formats with the locale and the translated unit', () => {
    expect(formatStorageSize('en-US', 0, units)).toBe('0 B');
    expect(formatStorageSize('en-US', 830_000, units)).toBe('830 KB');
    expect(formatStorageSize('en-US', 12_400_000, units)).toBe('12.4 MB');
    expect(formatStorageSize('de-DE', 12_400_000, units)).toBe('12,4 MB');
    expect(formatStorageSize('en-US', 1_500_000_000, units)).toBe('1.5 GB');
    expect(formatStorageSize('ru-RU', 5_000, { ...units, kb: 'КБ' })).toBe('5 КБ');
  });
});
