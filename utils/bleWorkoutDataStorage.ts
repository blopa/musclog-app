import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

import type { WitMotionVector3 } from '@/modules/witmotion-ble';

export interface BleWorkoutSample {
  timestamp: number;
  accel: WitMotionVector3;
  gyro: WitMotionVector3;
  angle: WitMotionVector3;
}

export interface BleWorkoutFile {
  version: 1;
  workoutLogId: string;
  exerciseName: string;
  muscleGroup: string;
  equipmentType: string;
  mechanicType: string;
  setNumber: number;
  deviceId: string;
  deviceDisplayName: string;
  startedAt: string;
  stoppedAt: string;
  sampleCount: number;
  samples: BleWorkoutSample[];
}

export interface StoredBleWorkoutFile extends BleWorkoutFile {
  uri: string;
  fileName: string;
  sortTimestampMs: number;
}

const BLE_WORKOUT_DATA_DIR = 'ble-workout-data';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

function randomSuffix(length: number): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length);
}

function getDataDirectoryUri(): string | null {
  const base = documentDirectory ?? cacheDirectory;
  return base ? `${base}${BLE_WORKOUT_DATA_DIR}/` : null;
}

export async function ensureBleWorkoutDataDir(): Promise<string | null> {
  const dir = getDataDirectoryUri();
  if (!dir) {
    return null;
  }

  await makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export function buildBleWorkoutFileName(
  exerciseName: string,
  setNumber: number,
  startedAtMs: number
): string {
  const slug = slugify(exerciseName) || 'exercise';
  const ts = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  const suffix = randomSuffix(4);
  return `ble_${slug}_set${setNumber}_${ts}_${suffix}.json`;
}

export async function saveBleWorkoutFile(data: BleWorkoutFile): Promise<string> {
  const dir = await ensureBleWorkoutDataDir();
  if (!dir) {
    throw new Error('BLE workout data directory unavailable');
  }

  const fileName = buildBleWorkoutFileName(
    data.exerciseName,
    data.setNumber,
    Date.parse(data.startedAt)
  );

  const uri = `${dir}${fileName}`;
  await writeAsStringAsync(uri, JSON.stringify(data, null, 2));
  return uri;
}

export function isBleWorkoutFile(value: unknown): value is BleWorkoutFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const c = value as Partial<BleWorkoutFile>;
  return (
    c.version === 1 &&
    typeof c.workoutLogId === 'string' &&
    typeof c.exerciseName === 'string' &&
    typeof c.setNumber === 'number' &&
    Array.isArray(c.samples)
  );
}

export async function loadAllBleWorkoutFiles(): Promise<StoredBleWorkoutFile[]> {
  const dir = await ensureBleWorkoutDataDir();
  if (!dir) {
    return [];
  }

  let fileNames: string[] = [];
  try {
    fileNames = await readDirectoryAsync(dir);
  } catch {
    return [];
  }

  const results = await Promise.all(
    fileNames
      .filter((name) => name.endsWith('.json'))
      .map(async (fileName) => {
        const uri = `${dir}${fileName}`;
        try {
          const raw = await readAsStringAsync(uri);
          const parsed = JSON.parse(raw) as unknown;
          if (!isBleWorkoutFile(parsed)) {
            return null;
          }

          return {
            ...parsed,
            uri,
            fileName,
            sortTimestampMs: new Date(parsed.stoppedAt ?? parsed.startedAt).getTime(),
          } satisfies StoredBleWorkoutFile;
        } catch {
          return null;
        }
      })
  );

  return results
    .filter((f): f is StoredBleWorkoutFile => f !== null)
    .sort((a, b) => b.sortTimestampMs - a.sortTimestampMs);
}

export async function deleteBleWorkoutFile(uri: string): Promise<void> {
  await deleteAsync(uri, { idempotent: true });
}
