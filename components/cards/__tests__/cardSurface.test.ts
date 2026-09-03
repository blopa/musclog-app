import { sheetSurfaceColor } from '@/components/sheetSurfaceColor';
import { THEME_IDS } from '@/constants/settings';
import { contrast } from '@/theme.audit';
import { THEMES } from '@/theme';

import { CardVariant, resolveCardSurface } from '../cardSurface';

/** DESIGN.md's 1.09x "a layer edge is visible" floor for a tonal seam. */
const MIN_SEAM = 1.09;

describe('resolveCardSurface', () => {
  it.each(THEME_IDS)('gives flat and raised distinct, on-brand surfaces on %s', (themeId) => {
    const theme = THEMES[themeId];

    const flat = resolveCardSurface('flat', theme);
    expect(flat.backgroundColor).toBe(theme.colors.background.card);
    expect(flat.borderColor).toBe(theme.colors.background.ink5);
    expect(flat.shadow).toBeUndefined();

    const raised = resolveCardSurface('raised', theme);
    expect(raised.backgroundColor).toBe(theme.colors.background.cardElevated);
    expect(raised.borderColor).toBe(theme.colors.background.ink5);
    expect(raised.shadow).toEqual(theme.shadows.md);

    // Both share the single card radius — no per-variant radius ladder.
    expect(flat.borderRadius).toBe(theme.borderRadius.lg);
    expect(raised.borderRadius).toBe(theme.borderRadius.lg);
  });

  it.each(THEME_IDS)('never gives raised the same fill as a BottomPopUp sheet on %s', (themeId) => {
    // Raised is illegal inside BottomPopUp/CenteredModal because their sheet
    // is already background.cardElevated — a raised card would disappear
    // into it. This assertion means that if either value ever moves, this
    // test (not just a visual review) tells you the rule broke.
    const theme = THEMES[themeId];
    const raised = resolveCardSurface('raised', theme);

    expect(raised.backgroundColor).toBe(sheetSurfaceColor(theme));
  });

  it.each(THEME_IDS)(
    'gives every card a visible edge — either fill contrast or a real border — on %s',
    (themeId) => {
      // The fill alone does not clear the 1.09x floor on every theme (Kinetic
      // Shock's flat surface sits at ~1.06x against the app background), so
      // the ink/5 hairline is what makes the seam visible there. That border
      // is load-bearing, not decoration — assert it is never dropped when the
      // fill falls short, instead of asserting fill-contrast alone (which
      // would make this test fail on Shock forever).
      const theme = THEMES[themeId];
      const base = theme.colors.background.primary;

      for (const variant of ['flat', 'raised'] as CardVariant[]) {
        const surface = resolveCardSurface(variant, theme);
        const fillContrast = contrast(base, surface.backgroundColor as string);

        if (fillContrast < MIN_SEAM) {
          expect(surface.borderWidth).toBeGreaterThan(0);
        }
      }
    }
  );

  it('hero has no flat fill — it renders the colorfulCard gradient instead', () => {
    const hero = resolveCardSurface('hero', THEMES[THEME_IDS[0]]);

    expect(hero.backgroundColor).toBeUndefined();
  });
});
