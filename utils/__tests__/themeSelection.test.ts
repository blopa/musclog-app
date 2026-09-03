import { normalizeThemeOption, THEME_IDS } from '@/constants/settings';
import { THEME_DEFINITIONS } from '@/theme.registry';
import { themeColorsById } from '@/theme.tokens';
import { getThemeMode, resolveThemeId } from '@/utils/themeSelection';

function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
}

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

  it('keeps every theme text and button ink at WCAG AA contrast', () => {
    for (const themeId of THEME_IDS) {
      const theme = themeColorsById[themeId];
      const mainSurfaces = [
        theme.background.primary,
        theme.background.card,
        theme.background.cardElevated,
      ];
      for (const textColor of [theme.text.primary, theme.text.secondary, theme.text.tertiary]) {
        for (const surface of mainSurfaces) {
          expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio(theme.text.black, theme.accent.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
