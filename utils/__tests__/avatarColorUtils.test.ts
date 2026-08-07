import { themeColors } from '@/theme.tokens';
import type { AvatarColor } from '@/types/AvatarColor';

import { getAvatarBackgroundColor, getAvatarColor } from '@/utils/avatarColorUtils';

/** Every member of the `AvatarColor` union. */
const AVATAR_COLORS: AvatarColor[] = [
  'emerald',
  'blue',
  'purple',
  'pink',
  'orange',
  'teal',
  'yellow',
  'indigo',
];

// The real token set, so a token renamed or dropped from theme.tokens.js fails here.
const theme = { colors: themeColors } as unknown as Parameters<typeof getAvatarColor>[0];

describe('avatarColorUtils', () => {
  describe('getAvatarColor', () => {
    it.each(AVATAR_COLORS)('maps %s to its avatar token', (color) => {
      const expected = themeColors.avatar[color];
      expect(expected).toBeTruthy();
      expect(getAvatarColor(theme, color)).toBe(expected);
    });

    it('falls back to the accent colour when no avatar colour is set', () => {
      expect(getAvatarColor(theme, undefined)).toBe(themeColors.accent.primary);
      expect(getAvatarColor(theme, null)).toBe(themeColors.accent.primary);
    });

    it('falls back to the accent colour for an unknown colour name', () => {
      // A colour persisted by an older build that no longer exists must not render
      // `undefined` into a style prop.
      expect(getAvatarColor(theme, 'chartreuse' as AvatarColor)).toBe(themeColors.accent.primary);
    });

    it('gives every avatar colour a distinct value (the picker must be distinguishable)', () => {
      const values = AVATAR_COLORS.map((color) => getAvatarColor(theme, color));
      expect(new Set(values).size).toBe(AVATAR_COLORS.length);
    });
  });

  describe('getAvatarBackgroundColor', () => {
    it.each(AVATAR_COLORS)('maps %s to its translucent avatarBg token', (color) => {
      const expected = themeColors.avatarBg[color];
      expect(expected).toBeTruthy();
      expect(getAvatarBackgroundColor(theme, color)).toBe(expected);
    });

    it('falls back to the 20%-opacity accent when no avatar colour is set', () => {
      expect(getAvatarBackgroundColor(theme, undefined)).toBe(themeColors.accent.primary20);
      expect(getAvatarBackgroundColor(theme, null)).toBe(themeColors.accent.primary20);
    });

    it('falls back to the 20%-opacity accent for an unknown colour name', () => {
      expect(getAvatarBackgroundColor(theme, 'chartreuse' as AvatarColor)).toBe(
        themeColors.accent.primary20
      );
    });

    it('gives every avatar colour a distinct background value', () => {
      const values = AVATAR_COLORS.map((color) => getAvatarBackgroundColor(theme, color));
      expect(new Set(values).size).toBe(AVATAR_COLORS.length);
    });
  });

  it('pairs the foreground and background of a colour (both resolve, never mixed sources)', () => {
    for (const color of AVATAR_COLORS) {
      expect(getAvatarColor(theme, color)).not.toBe(getAvatarBackgroundColor(theme, color));
    }
  });

  it('reads colours from the theme it is given, not from a module-level import', () => {
    // Both light and dark themes are passed in at call time; the helper must honour them.
    const customTheme = {
      colors: {
        accent: { primary: '#fallback', primary20: '#fallback20' },
        avatar: { ...themeColors.avatar, blue: '#custom' },
        avatarBg: { ...themeColors.avatarBg, blue: '#custombg' },
      },
    } as unknown as Parameters<typeof getAvatarColor>[0];

    expect(getAvatarColor(customTheme, 'blue')).toBe('#custom');
    expect(getAvatarBackgroundColor(customTheme, 'blue')).toBe('#custombg');
    expect(getAvatarColor(customTheme, null)).toBe('#fallback');
    expect(getAvatarBackgroundColor(customTheme, null)).toBe('#fallback20');
  });
});
