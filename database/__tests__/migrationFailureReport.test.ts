import * as Sentry from '@sentry/react-native';

import { reportMigrationFailure } from '@/database/migrationFailureReport';
import { initializeSentry } from '@/sentry-init';
import { readRememberedCrashReportConsent } from '@/utils/crashReportConsent';

jest.mock('@sentry/react-native', () => ({ captureException: jest.fn() }));
jest.mock('@/sentry-init', () => ({ initializeSentry: jest.fn() }));
jest.mock('@/utils/crashReportConsent', () => ({
  readRememberedCrashReportConsent: jest.fn(),
}));

const remembered = readRememberedCrashReportConsent as jest.Mock;

describe('reportMigrationFailure', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends nothing when the remembered choice is off', async () => {
    remembered.mockResolvedValue(false);

    await reportMigrationFailure(new Error('m'), 3, 4);

    expect(initializeSentry).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it.each([true, null])(
    'reports with the versions when the remembered choice is %s',
    async (value) => {
      remembered.mockResolvedValue(value);
      const error = new Error('m');

      await reportMigrationFailure(error, 3, 4);

      expect(initializeSentry).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        data: { context: 'SQLiteMigration.onError', fromVersion: 3, toVersion: 4 },
      });
    }
  );
});
