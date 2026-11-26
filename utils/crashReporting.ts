import { Platform } from 'react-native';

import { isStaticExport } from '@/constants/platform';
import { closeSentry, initializeSentry } from '@/sentry-init';
import {
  readRememberedCrashReportConsent,
  rememberCrashReportConsent,
} from '@/utils/crashReportConsent';

/**
 * Crash reporting runs from launch when the "Anonymous bug report" setting is on, so a crash a few
 * seconds after opening the app is reported too. It used to start only on the first explicit
 * report, which left no JS or native crash handler installed until then (docs/FIXES.md).
 *
 * Only in the app: the public website keeps starting Sentry on the first report, so a visit
 * sends nothing.
 */
function startsWithTheApp(): boolean {
  return !isStaticExport && Platform.OS !== 'web';
}

/**
 * Called at module load in `app/_layout.tsx`, before the database is readable, so it decides from
 * the device-local copy of the setting. Never recorded means the default, which is on. The
 * database value then confirms or corrects it through `syncCrashReporting`.
 */
export async function startCrashReportingAtLaunch(): Promise<void> {
  if (!startsWithTheApp()) {
    return;
  }

  try {
    const remembered = await readRememberedCrashReportConsent();

    if (remembered === false) {
      return;
    }

    initializeSentry();
  } catch {
    // Starting the crash reporter must never be what breaks the launch.
  }
}

/** Applies the setting's stored value: remember it for the next launch, then start or stop. */
export async function syncCrashReporting(consent: boolean): Promise<void> {
  try {
    await rememberCrashReportConsent(consent);

    if (!consent) {
      await closeSentry();

      return;
    }

    if (startsWithTheApp()) {
      initializeSentry();
    }
  } catch {
    // Nothing more to do: the next launch reads the setting again.
  }
}
