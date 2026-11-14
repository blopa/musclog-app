import AsyncStorage from '@react-native-async-storage/async-storage';

import { CRASH_REPORT_CONSENT_KEY } from '@/constants/misc';
import {
  readRememberedCrashReportConsent,
  rememberCrashReportConsent,
  resetRememberedCrashReportConsentCache,
} from '@/utils/crashReportConsent';

describe('crashReportConsent', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    resetRememberedCrashReportConsentCache();
    jest.restoreAllMocks();
  });

  it('reads null when nothing was recorded', async () => {
    expect(await readRememberedCrashReportConsent()).toBeNull();
  });

  it('round-trips true and false', async () => {
    await rememberCrashReportConsent(false);
    expect(await readRememberedCrashReportConsent()).toBe(false);

    await rememberCrashReportConsent(true);
    expect(await readRememberedCrashReportConsent()).toBe(true);
  });

  it('skips a redundant write', async () => {
    const spy = jest.spyOn(AsyncStorage, 'setItem').mockResolvedValue(undefined);
    spy.mockClear();

    await rememberCrashReportConsent(true);
    await rememberCrashReportConsent(true);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(CRASH_REPORT_CONSENT_KEY, 'true');
  });

  it('reads null for an unknown stored value', async () => {
    await AsyncStorage.setItem(CRASH_REPORT_CONSENT_KEY, 'maybe');

    expect(await readRememberedCrashReportConsent()).toBeNull();
  });

  it('swallows storage errors', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValue(new Error('full'));
    jest.spyOn(AsyncStorage, 'getItem').mockRejectedValue(new Error('broken'));

    await expect(rememberCrashReportConsent(false)).resolves.toBeUndefined();
    expect(await readRememberedCrashReportConsent()).toBeNull();
  });
});
