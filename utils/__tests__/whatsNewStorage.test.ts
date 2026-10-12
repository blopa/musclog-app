import AsyncStorage from '@react-native-async-storage/async-storage';

import { WHATS_NEW_SEEN_THROUGH_KEY } from '@/constants/whatsNew';
import { captureAsyncStorageDump } from '@/database/asyncStorageBackup';
import { replaceAppAsyncStorage } from '@/database/asyncStorageReset';

import {
  getWhatsNewSeenThrough,
  markWhatsNewSeenThrough,
  whatsNewSeenEntry,
} from '../whatsNew/storage';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
test('validates stored values and normalizes app versions', async () => {
  expect(await getWhatsNewSeenThrough()).toBeNull();
  await AsyncStorage.setItem(WHATS_NEW_SEEN_THROUGH_KEY, 'garbage');
  expect(await getWhatsNewSeenThrough()).toBeNull();
  expect(whatsNewSeenEntry('2.13.0-dev')).toEqual([WHATS_NEW_SEEN_THROUGH_KEY, '2.13.0']);
});
test('serializes concurrent writes and never goes backwards', async () => {
  await Promise.all([markWhatsNewSeenThrough('2.15.0'), markWhatsNewSeenThrough('2.13.0')]);
  expect(await getWhatsNewSeenThrough()).toBe('2.15.0');
});
test('propagates errors and lets a later write recover', async () => {
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await expect(markWhatsNewSeenThrough('2.13.0')).rejects.toThrow('disk');
  await markWhatsNewSeenThrough('2.14.0');
  expect(await getWhatsNewSeenThrough()).toBe('2.14.0');
});
test('backs up the record and restoring older backups removes it', async () => {
  await markWhatsNewSeenThrough('2.13.0');
  expect(await captureAsyncStorageDump()).toMatchObject({ [WHATS_NEW_SEEN_THROUGH_KEY]: '2.13.0' });
  await replaceAppAsyncStorage([['onboardingCompleted', 'true']]);
  expect(await getWhatsNewSeenThrough()).toBeNull();
  await replaceAppAsyncStorage([whatsNewSeenEntry('2.14.0')]);
  expect(await getWhatsNewSeenThrough()).toBe('2.14.0');
});
