import { darkTheme, lightTheme } from '@/theme';

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
  it('keeps the established saturated gradient and white ink in dark mode', () => {
    expect(darkTheme.colors.gradients.colorfulCard).toEqual(darkTheme.colors.gradients.progress);
    expect(darkTheme.colors.colorfulCard.ink).toBe('#ffffff');
  });

  it('uses a distinct light gradient with softer high-contrast ink in light mode', () => {
    expect(lightTheme.colors.gradients.colorfulCard).not.toEqual(
      lightTheme.colors.gradients.progress
    );
    expect(lightTheme.colors.gradients.colorfulCard).toEqual(['#d8daee', '#c5dad7', '#bcd3cb']);
    expect(lightTheme.colors.colorfulCard.ink).toBe('#30413a');
    expect(lightTheme.colors.colorfulCard.ink70).toBe(lightTheme.colors.text.secondary);
    expect(
      lightTheme.colors.gradients.colorfulCard.every(
        (stop) => contrastRatio(stop, lightTheme.colors.colorfulCard.ink70) >= 4.5
      )
    ).toBe(true);
  });
});
