import { File } from 'expo-file-system';
import { documentDirectory } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { DATABASE_NAME } from '@/constants/database';

export type DbBootFileStats = {
  dbBytes: number | null;
  walBytes: number | null;
  shmBytes: number | null;
  capturedAt: number;
};

let bootFileStats: DbBootFileStats | null = null;

// Returns the directory where WatermelonDB's JSI adapter stores its database.
// See exportDb.ts wdbDir() for the full explanation.
function wdbDir(): string {
  const base = (documentDirectory ?? '').replace(/^file:\/\//, '').replace(/\/$/, '');
  return Platform.OS === 'android' ? base.replace(/\/files$/, '') : base;
}

function fileSize(path: string): number | null {
  try {
    const file = new File(`file://${path}`);
    return file.exists ? (file.size ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Captures the on-disk sizes of the SQLite database and its WAL/SHM siblings.
 *
 * Must be called from adapter.ts BEFORE readCurrentDbVersion() opens the first
 * raw connection: closing that connection checkpoints the WAL, so this is the
 * only moment the previous session's un-checkpointed WAL size is observable.
 * A large `walBytes` here followed by missing rows is direct evidence of the
 * WAL tail being lost between sessions (field incident: nutrition logs
 * vanishing after the app process was killed).
 */
export function captureBootDbFileStats(): void {
  if (Platform.OS === 'web') {
    return;
  }

  const dir = wdbDir();
  if (!dir) {
    return;
  }

  const basePath = `${dir}/${DATABASE_NAME}.db`;
  bootFileStats = {
    dbBytes: fileSize(basePath),
    walBytes: fileSize(`${basePath}-wal`),
    shmBytes: fileSize(`${basePath}-shm`),
    capturedAt: Date.now(),
  };
}

export function getBootDbFileStats(): DbBootFileStats | null {
  return bootFileStats;
}
