import { darkTheme, kineticShockTheme, kineticVoltTheme, lightTheme } from '@/theme';

const relativeLuminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (first: string, second: string): number => {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);

  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

describe('Daily Summary card theme', () => {
  it('keeps the established saturated presentation in every dark theme', () => {
    expect(darkTheme.colors.gradients.colorfulCard).toEqual(darkTheme.colors.gradients.progress);
    expect(darkTheme.colors.colorfulCard.ink).toBe('#ffffff');
    expect(darkTheme.components.dailySummaryCardBackground).toBe('colorful-gradient');
    expect(kineticShockTheme.components.dailySummaryCardBackground).toBe('colorful-gradient');
    expect(kineticVoltTheme.components.dailySummaryCardBackground).toBe('colorful-gradient');
  });

  it('uses the standard surface and matching ink in Kinetic Light', () => {
    expect(lightTheme.components.dailySummaryCardBackground).toBe('default');
    expect(lightTheme.colors.colorfulCard.ink).toBe('#30413a');
    expect(lightTheme.colors.colorfulCard.ink70).toBe(lightTheme.colors.text.secondary);
    expect(
      contrastRatio(lightTheme.colors.background.overlay, lightTheme.colors.colorfulCard.ink70)
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      contrastRatio(lightTheme.colors.background.overlay, lightTheme.colors.colorfulCard.ink)
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
    expect(
      kineticVoltTheme.colors.gradients.colorfulCard.every(
        (stop) =>
          contrastRatio(stop, kineticVoltTheme.colors.colorfulCard.ink) >= 4.5 &&
          contrastRatio(stop, kineticVoltTheme.colors.colorfulCard.ink70) >= 4.5
      )
    ).toBe(true);
  });
});
