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
      // Every surface that carries body copy. `overlay` is the tinted branch of the
      // ladder (overlays, filter tabs, buttons) and takes small labels like the rest.
      const textSurfaces = [
        theme.background.primary,
        theme.background.card,
        theme.background.cardElevated,
        theme.background.overlay,
      ];
      for (const textColor of [theme.text.primary, theme.text.secondary, theme.text.tertiary]) {
        for (const surface of textSurfaces) {
          expect(contrastRatio(textColor, surface)).toBeGreaterThanOrEqual(4.5);
        }
      }
      expect(contrastRatio(theme.text.onAccent, theme.accent.primary)).toBeGreaterThanOrEqual(4.5);
    }
  });

  // The accent surface is the lightest, most saturated step of the dark ladder, so it
  // cannot host every ink: on Kinetic Depth, text.tertiary lands at 3.82:1 there.
  // Neither value can move — lifting text.tertiary to clear it pushes tertiary to
  // 6.17:1 on the card and collapses it into text.secondary, and darkening the surface
  // drops its seam against cardElevated to 1.03x, which is invisible. So it is a
  // border-and-well surface that takes primary or secondary ink only, and this is the
  // assertion that keeps that true.
  it('keeps primary and secondary ink legible on the accent surface', () => {
    for (const themeId of THEME_IDS) {
      const theme = themeColorsById[themeId];
      for (const textColor of [theme.text.primary, theme.text.secondary]) {
        expect(contrastRatio(textColor, theme.background.imageLight)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the surface ladder visible at every step', () => {
    for (const themeId of THEME_IDS) {
      const theme = themeColorsById[themeId];
      const ladder = [
        theme.background.primary,
        theme.background.card,
        theme.background.cardElevated,
        theme.background.hairline,
      ];
      // Below ~1.05x a seam does not render on any display, which is the defect the
      // 57-to-23 consolidation set out to fix. Keep every step above it.
      for (let step = 1; step < ladder.length; step += 1) {
        expect(contrastRatio(ladder[step - 1], ladder[step])).toBeGreaterThanOrEqual(1.05);
      }
    }
  });

  it('names no semantic token after a hue the palette no longer guarantees', () => {
    // `status.emerald` was emerald on Kinetic Depth and pink on Kinetic Shock. Semantic
    // keys name the role they resolve to, so one key reads correctly on all four.
    // A hue followed by a Tailwind scale step (three digits) — `teal400`, `indigo600`.
    // Two-digit suffixes are opacity percentages (`amber10`), which are fine.
    const staleHue =
      /^(gray|zinc|slate|teal|red|rose|amber|yellow|blue|indigo|violet|green|emerald|orange)\d{3}/;
    // `avatar`/`avatarBg` are keyed by the persisted AvatarColor enum, not by palette role.
    const enumKeyed = new Set(['avatar', 'avatarBg']);
    const offenders: string[] = [];

    for (const [group, tokens] of Object.entries(themeColorsById['kinetic-depth'])) {
      if (enumKeyed.has(group) || typeof tokens !== 'object' || Array.isArray(tokens)) {
        continue;
      }
      offenders.push(
        ...Object.keys(tokens)
          .filter((key) => staleHue.test(key))
          .map((key) => `${group}.${key}`)
      );
    }

    expect(offenders).toEqual([]);
  });
});
