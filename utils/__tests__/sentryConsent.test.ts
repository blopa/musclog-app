import * as Sentry from '@sentry/react-native';

import { SettingsService } from '@/database/services/SettingsService';
import { initializeSentry } from '@/sentry-init';
import { readRememberedCrashReportConsent } from '@/utils/crashReportConsent';
import { captureException, captureMessage } from '@/utils/sentry';
import { showSnackbar } from '@/utils/snackbarService';

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
}));
jest.mock('@/sentry-init', () => ({ initializeSentry: jest.fn() }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getAnonymousBugReport: jest.fn() },
}));
jest.mock('@/utils/crashReportConsent', () => ({
  readRememberedCrashReportConsent: jest.fn(),
}));
jest.mock('@/utils/snackbarService', () => ({ showSnackbar: jest.fn() }));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (k: string) => k } }));

const getSetting = SettingsService.getAnonymousBugReport as jest.Mock;
const remembered = readRememberedCrashReportConsent as jest.Mock;

describe('sentry consent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends nothing when the setting is off', async () => {
    getSetting.mockResolvedValue(false);

    await captureException(new Error('x'));
    await captureMessage('x');

    expect(initializeSentry).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('sends when the setting is on', async () => {
    getSetting.mockResolvedValue(true);

    await captureException(new Error('x'));

    expect(initializeSentry).toHaveBeenCalled();
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('sends nothing when the database fails and the remembered choice is off, but still warns', async () => {
    getSetting.mockRejectedValue(new Error('db'));
    remembered.mockResolvedValue(false);

    await captureException(new Error('x'));

    expect(initializeSentry).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(showSnackbar).toHaveBeenCalled();
  });

  it.each([true, null])(
    'sends when the database fails and the remembered choice is %s',
    async (value) => {
      getSetting.mockRejectedValue(new Error('db'));
      remembered.mockResolvedValue(value);

      await captureException(new Error('x'));

      expect(initializeSentry).toHaveBeenCalled();
      expect(Sentry.captureException).toHaveBeenCalled();
      expect(showSnackbar).toHaveBeenCalled();
    }
  );
});
