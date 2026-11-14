import * as Sentry from '@sentry/react-native';

import { initializeSentry } from '@/sentry-init';
import { readRememberedCrashReportConsent } from '@/utils/crashReportConsent';

// Runs before the database exists, so the user's choice comes from the device-local copy
// (AsyncStorage). Never recorded keeps the default, which is on.
export async function reportMigrationFailure(
  error: Error,
  fromVersion: number | null,
  toVersion: number
): Promise<void> {
  const consent = await readRememberedCrashReportConsent();

  if (consent === false) {
    return;
  }

  initializeSentry();
  Sentry.captureException(error, {
    data: {
      context: 'SQLiteMigration.onError',
      fromVersion,
      toVersion,
    },
  });
}
