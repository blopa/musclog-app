import { SETTINGS_EXCLUDED_TYPES } from '@/constants/exportImport';
import { PREMIUM_CONSENT_VERSION_SETTING_TYPE } from '@/constants/settings';
import { SETTINGS } from '@/constants/settingDefinitions';

describe('premium_consent_version setting', () => {
  it('stores under its own key and defaults to no consent', () => {
    expect(PREMIUM_CONSENT_VERSION_SETTING_TYPE).toBe('premium_consent_version');
    expect(SETTINGS.premiumConsentVersion.type).toBe('premium_consent_version');
    expect(SETTINGS.premiumConsentVersion.defaultValue).toBeNull();
    expect(SETTINGS.premiumConsentVersion.parse('')).toBeNull();
  });

  it('parses only a positive whole version and round-trips it', () => {
    const { parse, serialize } = SETTINGS.premiumConsentVersion;

    expect(parse('1')).toBe(1);
    expect(parse('3')).toBe(3);
    expect(parse('0')).toBeNull();
    expect(parse('-2')).toBeNull();
    expect(parse('1.5')).toBeNull();
    expect(parse('junk')).toBeNull();
    expect(serialize(1)).toBe('1');
    expect(serialize(null)).toBe('');
    expect(parse(serialize(2))).toBe(2);
  });

  it('is never in a backup', () => {
    expect(SETTINGS_EXCLUDED_TYPES).toContain(PREMIUM_CONSENT_VERSION_SETTING_TYPE);
  });
});
