import { contrast } from '@/theme.audit';
import { darkTheme, lightTheme, THEMES } from '@/theme';

const kineticShockTheme = THEMES['kinetic-shock'];
const kineticVoltTheme = THEMES['kinetic-volt'];

/**
 * The Daily Summary card always renders the `colorful-gradient` background; a
 * theme decides how that reads purely through its gradient stops. These are the
 * per-theme intentions — the rule that every theme's ink stays legible on its own
 * stops lives in `theme.audit.js` and is asserted for all of them at once.
 */
describe('Daily Summary card theme', () => {
  it('keeps the established saturated sweep in every dark theme', () => {
    expect(darkTheme.colors.gradients.colorfulCard).toEqual(darkTheme.colors.gradients.progress);
    expect(darkTheme.colors.colorfulCard.ink).toBe('#ffffff');
    expect(kineticShockTheme.colors.colorfulCard.ink).toBe('#ffffff');
  });

  it('collapses the sweep to a flat card surface in Kinetic Light', () => {
    // Kinetic Light wants an ordinary card here. It says so with its stops rather
    // than by asking the component for a different background variant.
    expect(lightTheme.colors.gradients.colorfulCard).toEqual([
      lightTheme.colors.background.card,
      lightTheme.colors.background.card,
      lightTheme.colors.background.card,
    ]);
    expect(lightTheme.colors.colorfulCard.ink).toBe('#30413a');
    expect(lightTheme.colors.colorfulCard.ink70).toBe(lightTheme.colors.text.secondary);
    expect(
      contrast(lightTheme.colors.background.card, lightTheme.colors.colorfulCard.ink70)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrast(lightTheme.colors.background.card, lightTheme.colors.colorfulCard.ink)
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('uses warm-black ink on Kinetic Volt’s bright gradient', () => {
    expect(kineticVoltTheme.colors.gradients.colorfulCard).toEqual([
      '#818cf8',
      '#ca8a04',
      '#eab308',
    ]);
    expect(kineticVoltTheme.colors.colorfulCard.ink).toBe('#151208');
    expect(kineticVoltTheme.colors.colorfulCard.ink70).toBe('#30280d');
    // Volt's stops are bright enough that its dark ink clears full AA, not just
    // the audit's display-type floor.
    expect(
      kineticVoltTheme.colors.gradients.colorfulCard.every(
        (stop) =>
          contrast(stop, kineticVoltTheme.colors.colorfulCard.ink) >= 4.5 &&
          contrast(stop, kineticVoltTheme.colors.colorfulCard.ink70) >= 4.5
      )
    ).toBe(true);
  });
});
