import AsyncStorage from '@react-native-async-storage/async-storage';

import { CYCLE_BACKUP_STATUS_KEY } from '@/constants/cycle';
import { openCycleBackup, sealCycleBackup } from '@/utils/cycle/backupCrypto';
import { parseCycleTransfer } from '@/utils/cycle/cycleTransfer';

export async function encryptCycleBackup(text: string, password: string): Promise<string> {
  if (password.trim().length < 8) {
    throw new Error('cycle_password_too_short');
  }

  parseCycleTransfer(text);
  await new Promise((resolve) => setTimeout(resolve, 0));
  return sealCycleBackup(text, password);
}

export async function decodeCycleFile(text: string, password: string): Promise<string> {
  if (text.length > 7_000_000) {
    throw new Error('cycle_file_too_large');
  }

  if (!text.trimStart().startsWith('{')) {
    return text;
  }

  const object = JSON.parse(text);
  if (object.format !== 'musclog-cycle-encrypted') {
    return text;
  }

  if (object.version !== 1 || typeof object.payload !== 'string' || !password) {
    throw new Error('invalid_cycle_backup');
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
  const plain = openCycleBackup(object, password);
  parseCycleTransfer(plain);
  return plain;
}

export async function recordCycleBackupPrepared(): Promise<void> {
  await AsyncStorage.setItem(CYCLE_BACKUP_STATUS_KEY, String(Date.now()));
}

export async function getCycleBackupPreparedAt(): Promise<number | null> {
  const value = Number(await AsyncStorage.getItem(CYCLE_BACKUP_STATUS_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}
