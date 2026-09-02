import { normalizeThemeOption, THEME_IDS } from '@/constants/settings';
import {
  kineticDepthThemeColors,
  kineticLightThemeColors,
  kineticPinkThemeColors,
} from '@/theme.tokens';
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
    for (const themeId of THEME_IDS) {
      expect(normalizeThemeOption(themeId)).toBe(themeId);
    }
    expect(normalizeThemeOption('neon-surprise')).toBe('system');
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
    expect(resolveThemeId('kinetic-pink', 'light')).toBe('kinetic-pink');
  });

  it('treats Kinetic Pink as dark for status bars and dark variants', () => {
    expect(getThemeMode('kinetic-depth')).toBe('dark');
    expect(getThemeMode('kinetic-pink')).toBe('dark');
    expect(getThemeMode('kinetic-light')).toBe('light');
  });

  it('gives Kinetic Pink the same semantic shape and a distinct palette', () => {
    expect(Object.keys(kineticPinkThemeColors)).toEqual(Object.keys(kineticDepthThemeColors));
    expect(Object.keys(kineticPinkThemeColors.background)).toEqual(
      Object.keys(kineticLightThemeColors.background)
    );
    expect(kineticPinkThemeColors.background.primary).not.toBe(
      kineticDepthThemeColors.background.primary
    );
    expect(kineticPinkThemeColors.accent.primary).not.toBe(kineticDepthThemeColors.accent.primary);
  });

  it('keeps Kinetic Pink text and button ink at WCAG AA contrast', () => {
    const mainSurfaces = [
      kineticPinkThemeColors.background.primary,
      kineticPinkThemeColors.background.card,
      kineticPinkThemeColors.background.cardElevated,
    ];
    for (const textColor of [
      kineticPinkThemeColors.text.primary,
      kineticPinkThemeColors.text.secondary,
      kineticPinkThemeColors.text.tertiary,
    ]) {
      for (const surface of mainSurfaces) {
        expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(
      contrastRatio(kineticPinkThemeColors.text.black, kineticPinkThemeColors.accent.primary)
    ).toBeGreaterThanOrEqual(4.5);
  });
});
