import AsyncStorage from '@react-native-async-storage/async-storage';

import { WHATS_NEW_SEEN_THROUGH_KEY } from '@/constants/whatsNew';

import { nextSeenThrough, parseVersion } from './version';

export async function getWhatsNewSeenThrough(): Promise<string | null> {
  const value = await AsyncStorage.getItem(WHATS_NEW_SEEN_THROUGH_KEY);
  return parseVersion(value) ? value : null;
}

export function whatsNewSeenEntry(version: string): [string, string] {
  return [WHATS_NEW_SEEN_THROUGH_KEY, nextSeenThrough(null, version)];
}

// Serialize read/compare/write, including overlapping dismissals. Recover after a failed write.
let pending: Promise<unknown> = Promise.resolve();
export function markWhatsNewSeenThrough(version: string): Promise<void> {
  const write = pending.then(async () => {
    const next = nextSeenThrough(await getWhatsNewSeenThrough(), version);
    await AsyncStorage.setItem(...whatsNewSeenEntry(next));
  });
  pending = write.catch(() => undefined);
  return write;
}
