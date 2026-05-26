import { Directory, File } from 'expo-file-system';
import {
  cacheDirectory,
  deleteAsync,
  documentDirectory,
  getInfoAsync,
  makeDirectoryAsync,
  readAsStringAsync,
  readDirectoryAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import { zip } from 'react-native-zip-archive';

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
  reps?: number;
  deviceId: string;
  deviceDisplayName: string;
  startedAt: string;
  stoppedAt: string;
  sampleCount: number;
  userHeightCm?: number;
  userAgeYears?: number;
  userGender?: string;
  userWeightKg?: number;
  samples: BleWorkoutSample[];
}

export type BleWorkoutFileInput = Omit<BleWorkoutFile, 'samples'> & {
  samples?: BleWorkoutSample[];
  samplesFile?: File;
};

export interface StoredBleWorkoutFile extends BleWorkoutFile {
  uri: string;
  fileName: string;
  sortTimestampMs: number;
}

const BLE_WORKOUT_DATA_DIR = 'ble-workout-data';
const BLE_WORKOUT_SHARE_DIR = 'ble-workout-share';
const BLE_WORKOUT_TRACKING_DIR = 'ble-workout-tracking';
const BLE_WORKOUT_TRACKING_STALE_AFTER_MS = 6 * 60 * 60 * 1000;

function getTrackingDirectoryUri(): string | null {
  const base = cacheDirectory ?? documentDirectory;
  return base ? `${base}${BLE_WORKOUT_TRACKING_DIR}/` : null;
}

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

function getShareDirectoryUri(): string | null {
  const base = cacheDirectory ?? documentDirectory;
  return base ? `${base}${BLE_WORKOUT_SHARE_DIR}/` : null;
}

function buildMetadataHeader(data: Omit<BleWorkoutFile, 'samples'>): string {
  const lines = [
    '{',
    `  "version": ${data.version},`,
    `  "workoutLogId": ${JSON.stringify(data.workoutLogId)},`,
    `  "exerciseName": ${JSON.stringify(data.exerciseName)},`,
    `  "muscleGroup": ${JSON.stringify(data.muscleGroup)},`,
    `  "equipmentType": ${JSON.stringify(data.equipmentType)},`,
    `  "mechanicType": ${JSON.stringify(data.mechanicType)},`,
    `  "setNumber": ${data.setNumber},`,
  ];

  if (data.reps != null) {
    lines.push(`  "reps": ${data.reps},`);
  }

  lines.push(
    `  "deviceId": ${JSON.stringify(data.deviceId)},`,
    `  "deviceDisplayName": ${JSON.stringify(data.deviceDisplayName)},`,
    `  "startedAt": ${JSON.stringify(data.startedAt)},`,
    `  "stoppedAt": ${JSON.stringify(data.stoppedAt)},`,
    `  "sampleCount": ${data.sampleCount},`
  );

  if (data.userHeightCm != null) {
    lines.push(`  "userHeightCm": ${data.userHeightCm},`);
  }

  if (data.userAgeYears != null) {
    lines.push(`  "userAgeYears": ${data.userAgeYears},`);
  }

  if (data.userGender != null) {
    lines.push(`  "userGender": ${JSON.stringify(data.userGender)},`);
  }

  if (data.userWeightKg != null) {
    lines.push(`  "userWeightKg": ${data.userWeightKg},`);
  }

  lines.push(`  "samples": [`);

  return `${lines.join('\n')}\n`;
}

function getTrackingDirectoryFile(sessionId: string): Directory | null {
  const dirUri = getTrackingDirectoryUri();
  if (!dirUri) {
    return null;
  }

  return new Directory(dirUri, sessionId);
}

function joinUri(baseUri: string, childName: string): string {
  return `${baseUri.replace(/\/?$/, '/')}${childName}`;
}

function buildBleWorkoutZipFileName(fileCount: number, startedAtMs: number): string {
  const ts = new Date(startedAtMs).toISOString().replace(/[:.]/g, '-');
  const suffix = randomSuffix(4);
  return `ble_workout_files_${fileCount}_${ts}_${suffix}.zip`;
}

export function createBleWorkoutTrackingTempFile(sessionId: string): File {
  const dir = getTrackingDirectoryFile(sessionId);
  if (!dir) {
    throw new Error('BLE workout tracking directory unavailable');
  }

  dir.create({ intermediates: true, idempotent: true });

  const tempFile = new File(dir, 'samples.ndjson');
  tempFile.write('', { append: false });
  return tempFile;
}

export async function cleanupStaleBleWorkoutTrackingFiles(
  maxAgeMs: number = BLE_WORKOUT_TRACKING_STALE_AFTER_MS
): Promise<void> {
  const trackingDirUri = getTrackingDirectoryUri();
  if (!trackingDirUri) {
    return;
  }

  let sessionDirNames: string[];
  try {
    sessionDirNames = await readDirectoryAsync(trackingDirUri);
  } catch {
    return;
  }

  const now = Date.now();

  await Promise.all(
    sessionDirNames.map(async (sessionDirName) => {
      const sessionDirUri = joinUri(trackingDirUri, sessionDirName);
      const samplesUri = joinUri(sessionDirUri, 'samples.ndjson');

      try {
        const info = await getInfoAsync(samplesUri);
        if (!info.exists) {
          await deleteAsync(sessionDirUri, { idempotent: true });
          return;
        }

        const modifiedAt = info.modificationTime ?? null;
        if (modifiedAt !== null && now - modifiedAt >= maxAgeMs) {
          await deleteAsync(sessionDirUri, { idempotent: true });
        }
      } catch {
        try {
          await deleteAsync(sessionDirUri, { idempotent: true });
        } catch {
          // Best-effort cleanup only.
        }
      }
    })
  );
}

function serializeSamplesAsNdjson(samples: BleWorkoutSample[]): string {
  return samples.map((s) => `${JSON.stringify(s)}\n`).join('');
}

export function appendBleWorkoutSamplesToNdjsonFile(file: File, samples: BleWorkoutSample[]): void {
  if (samples.length === 0) {
    return;
  }

  const ndjsonText = serializeSamplesAsNdjson(samples);
  file.write(ndjsonText, { append: true });
}

function appendNdjsonFileToJsonArray(sourceFile: File, destinationFile: File): void {
  const handle = sourceFile.open();
  const decoder = new TextDecoder();
  let buffer = '';
  let wroteAnySample = false;

  const flushBuffer = (isFinal = false) => {
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      destinationFile.write(`${wroteAnySample ? ',\n' : ''}  ${line}`, { append: true });
      wroteAnySample = true;
    }

    if (isFinal) {
      const finalLine = buffer.trim();
      if (finalLine) {
        destinationFile.write(`${wroteAnySample ? ',\n' : ''}  ${finalLine}`, { append: true });
        wroteAnySample = true;
      }
      buffer = '';
    }
  };

  try {
    while (true) {
      const bytes = handle.readBytes(8192);
      if (bytes.length === 0) {
        break;
      }

      buffer += decoder.decode(bytes, { stream: true });
      flushBuffer();
    }

    buffer += decoder.decode();
    flushBuffer(true);
  } finally {
    handle.close();
  }

  if (wroteAnySample) {
    destinationFile.write('\n', { append: true });
  }
}

export async function ensureBleWorkoutDataDir(): Promise<string | null> {
  const dir = getDataDirectoryUri();
  if (!dir) {
    return null;
  }

  await makeDirectoryAsync(dir, { intermediates: true });
  return dir;
}

export async function ensureBleWorkoutShareDir(): Promise<string | null> {
  const dir = getShareDirectoryUri();
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

export async function createBleWorkoutZipFile(fileUris: string[]): Promise<string> {
  if (fileUris.length === 0) {
    throw new Error('No BLE workout files available to zip');
  }

  const dir = await ensureBleWorkoutShareDir();
  if (!dir) {
    throw new Error('BLE workout share directory unavailable');
  }

  const outputFile = new File(dir, buildBleWorkoutZipFileName(fileUris.length, Date.now()));
  await zip(fileUris, outputFile.uri);
  return outputFile.uri;
}

export async function deleteBleWorkoutArchiveFile(uri: string): Promise<void> {
  await deleteAsync(uri, { idempotent: true });
}

export async function saveBleWorkoutFile(data: BleWorkoutFileInput): Promise<string> {
  const dir = await ensureBleWorkoutDataDir();
  if (!dir) {
    throw new Error('BLE workout data directory unavailable');
  }

  const fileName = buildBleWorkoutFileName(
    data.exerciseName,
    data.setNumber,
    Date.parse(data.startedAt)
  );

  if (data.samplesFile) {
    const outputFile = new File(dir, fileName);
    outputFile.write(buildMetadataHeader(data), { append: false });
    appendNdjsonFileToJsonArray(data.samplesFile, outputFile);
    outputFile.write('  ]\n}\n', { append: true });

    try {
      data.samplesFile.parentDirectory.delete();
    } catch {
      try {
        data.samplesFile.delete();
      } catch {
        // Best-effort cleanup only.
      }
    }

    return outputFile.uri;
  }

  const uri = `${dir}${fileName}`;
  await writeAsStringAsync(uri, JSON.stringify(data, null, 2));
  return uri;
}

export const BLE_DATA_POINTS_PER_REP = 10;
export const BLE_DATA_POINTS_MIN = 50;

const BLE_COMPRESS_CHUNK_BYTES = 65_536;

/**
 * Reads the `sampleCount` field from the metadata header of a `ble_*.json` file
 * by scanning the first few chunks — no need to load the full file.
 */
function readSampleCountFromBleFile(file: File): number {
  const handle = file.open();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (buffer.length < 4096) {
      const bytes = handle.readBytes(BLE_COMPRESS_CHUNK_BYTES);
      if (bytes.length === 0) {
        break;
      }

      buffer += decoder.decode(bytes, { stream: true });

      const match = /"sampleCount"\s*:\s*(\d+)/.exec(buffer);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
  } finally {
    handle.close();
  }

  return 0;
}

/**
 * Streams through a `ble_*.json` file and writes every `step`-th sample line
 * to `outFile` as a JSON array, chunked to avoid loading all samples into RAM.
 */
async function streamDownsampledSamples(
  source: File,
  outFile: File,
  step: number
): Promise<void> {
  const handle = source.open();
  const decoder = new TextDecoder();
  let buffer = '';
  let inSamples = false;
  let sampleIndex = 0;
  let wroteAny = false;

  outFile.write('[', { append: false });

  const processLine = (rawLine: string) => {
    const t = rawLine.trimStart();

    if (!inSamples) {
      if (t.startsWith('"samples"')) {
        inSamples = true;
      }

      return;
    }

    if (!t.startsWith('{')) {
      return;
    }

    if (sampleIndex % step === 0) {
      // Strip trailing comma that appendNdjsonFileToJsonArray may have added.
      const sampleJson = t.endsWith(',') ? t.slice(0, -1) : t;
      outFile.write(`${wroteAny ? ',' : ''}\n  ${sampleJson}`, { append: true });
      wroteAny = true;
    }

    sampleIndex++;
  };

  try {
    while (true) {
      const bytes = handle.readBytes(BLE_COMPRESS_CHUNK_BYTES);
      if (bytes.length === 0) {
        break;
      }

      buffer += decoder.decode(bytes, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processLine(line);
      }

      // Yield to the event loop between chunks so we don't block the UI thread.
      await new Promise<void>((r) => setTimeout(r, 0));
    }

    buffer += decoder.decode();
    for (const line of buffer.split('\n')) {
      processLine(line);
    }
  } finally {
    handle.close();
  }

  outFile.write('\n]', { append: true });
}

/**
 * Reads an existing `ble_*.json` file, downsamples its samples array to
 * `max(reps * BLE_DATA_POINTS_PER_REP, BLE_DATA_POINTS_MIN)` points using
 * uniform stride, and writes the result to `data_points_<setId>.json`.
 * Runs in chunks to avoid loading the full file into RAM.
 */
export async function compressRawToDataPoints(
  bleFileUri: string,
  setId: string,
  reps: number
): Promise<string> {
  const dir = await ensureBleWorkoutDataDir();
  if (!dir) {
    throw new Error('BLE workout data directory unavailable');
  }

  const sourceFile = new File(bleFileUri);
  const sampleCount = readSampleCountFromBleFile(sourceFile);
  const maxPts = Math.max(reps * BLE_DATA_POINTS_PER_REP, BLE_DATA_POINTS_MIN);
  const step = Math.max(1, Math.floor(sampleCount / maxPts));

  const outUri = `${dir}data_points_${setId}.json`;
  const outFile = new File(outUri);
  await streamDownsampledSamples(sourceFile, outFile, step);
  return outUri;
}

export async function deleteBleDataPointsFiles(setIds: string[]): Promise<void> {
  const dir = getDataDirectoryUri();
  if (!dir || setIds.length === 0) {
    return;
  }

  await Promise.all(setIds.map((id) => deleteAsync(`${dir}data_points_${id}.json`, { idempotent: true })));
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
