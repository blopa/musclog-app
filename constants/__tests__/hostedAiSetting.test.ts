import {
  ASYNC_STORAGE_EXCLUDED_KEYS,
  isRestoreForcedOffSetting,
  SETTINGS_EXCLUDED_TYPES,
  SETTINGS_FORCED_OFF_ON_RESTORE_TYPES,
} from '@/constants/exportImport';
import { PREMIUM_DEVICE_STATE } from '@/constants/misc';
import { SETTINGS } from '@/constants/settingDefinitions';
import { USE_HOSTED_AI_SETTING_TYPE } from '@/constants/settings';

describe('use_hosted_ai setting', () => {
  it('defaults to off and parses only the literal true', () => {
    expect(USE_HOSTED_AI_SETTING_TYPE).toBe('use_hosted_ai');
    expect(SETTINGS.useHostedAi.type).toBe('use_hosted_ai');
    expect(SETTINGS.useHostedAi.defaultValue).toBe(false);
    expect(SETTINGS.useHostedAi.parse('true')).toBe(true);
    expect(SETTINGS.useHostedAi.parse('x')).toBe(false);
    expect(SETTINGS.useHostedAi.serialize(true)).toBe('true');
  });

  it('is never included in a backup', () => {
    expect(SETTINGS_EXCLUDED_TYPES).toContain(USE_HOSTED_AI_SETTING_TYPE);
    expect(SETTINGS_EXCLUDED_TYPES).toContain('claude_api_key');
  });

  it('keeps the premium device state out of backups', () => {
    expect(ASYNC_STORAGE_EXCLUDED_KEYS.has(PREMIUM_DEVICE_STATE)).toBe(true);
  });

  it('forces off only use_hosted_ai on restore, leaving API keys restoring as before', () => {
    expect(SETTINGS_FORCED_OFF_ON_RESTORE_TYPES).toEqual([USE_HOSTED_AI_SETTING_TYPE]);
    expect(isRestoreForcedOffSetting('use_hosted_ai')).toBe(true);
    expect(isRestoreForcedOffSetting('claude_api_key')).toBe(false);
    expect(isRestoreForcedOffSetting('openai_api_key')).toBe(false);
    expect(isRestoreForcedOffSetting('enable_claude')).toBe(false);
  });
});
