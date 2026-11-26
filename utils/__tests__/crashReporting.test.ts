import { Platform } from 'react-native';

import { closeSentry, initializeSentry } from '@/sentry-init';
import { startCrashReportingAtLaunch, syncCrashReporting } from '@/utils/crashReporting';
import {
  readRememberedCrashReportConsent,
  rememberCrashReportConsent,
} from '@/utils/crashReportConsent';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/sentry-init', () => ({
  initializeSentry: jest.fn(),
  closeSentry: jest.fn(async () => undefined),
}));
jest.mock('@/utils/crashReportConsent', () => ({
  readRememberedCrashReportConsent: jest.fn(),
  rememberCrashReportConsent: jest.fn(async () => undefined),
}));

const remembered = jest.mocked(readRememberedCrashReportConsent);
const platform = Platform as { OS: string };

describe('startCrashReportingAtLaunch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platform.OS = 'android';
  });

  it('starts Sentry when the setting is on', async () => {
    remembered.mockResolvedValue(true);

    await startCrashReportingAtLaunch();

    expect(initializeSentry).toHaveBeenCalledTimes(1);
  });

  it('starts Sentry when the choice was never recorded, because the default is on', async () => {
    remembered.mockResolvedValue(null);

    await startCrashReportingAtLaunch();

    expect(initializeSentry).toHaveBeenCalledTimes(1);
  });

  it('never starts Sentry for someone who turned crash reports off', async () => {
    remembered.mockResolvedValue(false);

    await startCrashReportingAtLaunch();

    expect(initializeSentry).not.toHaveBeenCalled();
  });

  it('leaves the website alone, which starts Sentry only on a first report', async () => {
    platform.OS = 'web';
    remembered.mockResolvedValue(true);

    await startCrashReportingAtLaunch();

    expect(remembered).not.toHaveBeenCalled();
    expect(initializeSentry).not.toHaveBeenCalled();
  });

  it('never throws, so it cannot break the launch', async () => {
    remembered.mockResolvedValue(true);
    jest.mocked(initializeSentry).mockImplementationOnce(() => {
      throw new Error('init failed');
    });

    await expect(startCrashReportingAtLaunch()).resolves.toBeUndefined();
  });
});

describe('syncCrashReporting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platform.OS = 'android';
  });

  it('remembers an on value and starts Sentry', async () => {
    await syncCrashReporting(true);

    expect(rememberCrashReportConsent).toHaveBeenCalledWith(true);
    expect(initializeSentry).toHaveBeenCalledTimes(1);
    expect(closeSentry).not.toHaveBeenCalled();
  });

  it('remembers an off value and stops Sentry', async () => {
    await syncCrashReporting(false);

    expect(rememberCrashReportConsent).toHaveBeenCalledWith(false);
    expect(closeSentry).toHaveBeenCalledTimes(1);
    expect(initializeSentry).not.toHaveBeenCalled();
  });

  it('does not start Sentry on the website, but still stops it there', async () => {
    platform.OS = 'web';

    await syncCrashReporting(true);
    expect(initializeSentry).not.toHaveBeenCalled();

    await syncCrashReporting(false);
    expect(closeSentry).toHaveBeenCalledTimes(1);
  });

  it('never throws', async () => {
    jest.mocked(rememberCrashReportConsent).mockRejectedValueOnce(new Error('storage full'));

    await expect(syncCrashReporting(true)).resolves.toBeUndefined();
  });
});
