import { THEME_IDS } from '@/constants/settings';
import { auditThemes } from '@/theme.audit';
import { THEME_DEFINITIONS } from '@/theme.registry';
import { themeColorsById } from '@/theme.tokens';
import { getThemeMode, normalizeThemeOption, resolveThemeId } from '@/utils/themeSelection';

describe('named theme selection', () => {
  it('keeps every named theme and rejects unknown stored values', () => {
    expect(THEME_IDS).toEqual(Object.keys(THEME_DEFINITIONS));
    for (const themeId of THEME_IDS) {
      expect(normalizeThemeOption(themeId)).toBe(themeId);
    }
    expect(normalizeThemeOption('neon-surprise')).toBe('system');
    expect(normalizeThemeOption('toString')).toBe('system');
    expect(normalizeThemeOption(undefined)).toBe('system');
  });

  it('maps legacy dark and light values without losing the existing preference', () => {
    expect(normalizeThemeOption('dark')).toBe('kinetic-depth');
    expect(normalizeThemeOption('light')).toBe('kinetic-light');
  });

  it('uses Kinetic Light or Kinetic Depth for system and preserves explicit themes', () => {
    expect(resolveThemeId('system', 'light')).toBe('kinetic-light');
    expect(resolveThemeId('system', 'dark')).toBe('kinetic-depth');
    expect(resolveThemeId('system', null)).toBe('kinetic-depth');
    expect(resolveThemeId('kinetic-shock', 'light')).toBe('kinetic-shock');
    expect(resolveThemeId('kinetic-volt', 'light')).toBe('kinetic-volt');
  });

  it('derives every display mode from the canonical registry', () => {
    for (const themeId of THEME_IDS) {
      expect(getThemeMode(themeId)).toBe(THEME_DEFINITIONS[themeId].mode);
    }
  });

  it('gives every theme the same semantic shape and a distinct palette', () => {
    const [referenceId, ...otherIds] = THEME_IDS;
    const reference = themeColorsById[referenceId];
    for (const themeId of otherIds) {
      const candidate = themeColorsById[themeId];
      expect(Object.keys(candidate)).toEqual(Object.keys(reference));
      expect(Object.keys(candidate.background)).toEqual(Object.keys(reference.background));
      expect(candidate.background.primary).not.toBe(reference.background.primary);
    }
  });

  // Seam visibility, ink contrast, legend separation and hue naming all live in
  // `theme.audit.js`, which `npm run check-palette` prints and this asserts. One
  // definition of the rules, so the report and the gate cannot drift.
  it('passes the palette audit on every named theme', () => {
    expect(auditThemes()).toEqual([]);
  });

  // These ten had zero consumers when the card/gradient cleanup landed — pinned
  // so a future copy-paste doesn't quietly reintroduce an unused gradient.
  it('keeps the retired gradient tokens gone', () => {
    const retired = [
      'primary',
      'card',
      'notification',
      'upNextCard',
      'indigoPurple',
      'emeraldTeal',
      'pinkRose',
      'onboardingAmbient',
      'inkSubtle',
      'backdrop90',
    ];
    for (const themeId of THEME_IDS) {
      for (const key of retired) {
        expect(themeColorsById[themeId].gradients).not.toHaveProperty(key);
      }
    }
  });
});
