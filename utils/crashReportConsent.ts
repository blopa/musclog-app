import AsyncStorage from '@react-native-async-storage/async-storage';

import { CRASH_REPORT_CONSENT_KEY } from '@/constants/misc';

// Deliberately AsyncStorage only: this is read when the database cannot be.
let lastWritten: boolean | null = null;

export async function rememberCrashReportConsent(value: boolean): Promise<void> {
  if (lastWritten === value) {
    return;
  }

  lastWritten = value;

  try {
    await AsyncStorage.setItem(CRASH_REPORT_CONSENT_KEY, value ? 'true' : 'false');
  } catch {
    // Retry on the next write.
    lastWritten = null;
  }
}

/** null = never recorded or unreadable. */
export async function readRememberedCrashReportConsent(): Promise<boolean | null> {
  try {
    const stored = await AsyncStorage.getItem(CRASH_REPORT_CONSENT_KEY);

    if (stored === 'true') {
      return true;
    }

    return stored === 'false' ? false : null;
  } catch {
    return null;
  }
}

/** Test helper: forget the in-memory last-written value. */
export function resetRememberedCrashReportConsentCache(): void {
  lastWritten = null;
}
