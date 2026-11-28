import {
  isRestoreForcedOffSetting,
  SETTINGS_EXCLUDED_TYPES,
  SETTINGS_FORCED_OFF_ON_RESTORE_TYPES,
} from '@/constants/exportImport';
import { SETTINGS } from '@/constants/settingDefinitions';
import {
  AI_CONSENT_RECORDS_SETTING_TYPE,
  ENABLE_LOCAL_LLM_SETTING_TYPE,
  PREMIUM_CONSENT_VERSION_SETTING_TYPE,
  USE_HOSTED_AI_SETTING_TYPE,
  USE_MUSCLOG_FREE_TIER_SETTING_TYPE,
} from '@/constants/settings';

describe('settings a restore never takes from a file', () => {
  it('forces off every option that sends data off the phone and every consent record', () => {
    expect(SETTINGS_FORCED_OFF_ON_RESTORE_TYPES).toEqual(
      expect.arrayContaining([
        USE_HOSTED_AI_SETTING_TYPE,
        USE_MUSCLOG_FREE_TIER_SETTING_TYPE,
        ENABLE_LOCAL_LLM_SETTING_TYPE,
        AI_CONSENT_RECORDS_SETTING_TYPE,
        PREMIUM_CONSENT_VERSION_SETTING_TYPE,
      ])
    );
    expect(isRestoreForcedOffSetting(USE_MUSCLOG_FREE_TIER_SETTING_TYPE)).toBe(true);
    expect(isRestoreForcedOffSetting(ENABLE_LOCAL_LLM_SETTING_TYPE)).toBe(true);
    expect(isRestoreForcedOffSetting(AI_CONSENT_RECORDS_SETTING_TYPE)).toBe(true);
  });

  it('never exports consent records', () => {
    expect(SETTINGS_EXCLUDED_TYPES).toContain(AI_CONSENT_RECORDS_SETTING_TYPE);
  });

  it('defaults each forced-off setting to off or empty', () => {
    expect(SETTINGS.useHostedAi.defaultValue).toBe(false);
    expect(SETTINGS.aiConsentRecords.defaultValue).toEqual({});
    expect(SETTINGS.premiumConsentVersion.defaultValue).toBeNull();
  });
});
