import { darkTheme, lightTheme } from '@/theme';

describe('Daily Summary card theme', () => {
  it('keeps the established saturated gradient and white ink in dark mode', () => {
    expect(darkTheme.colors.gradients.colorfulCard).toEqual(darkTheme.colors.gradients.progress);
    expect(darkTheme.colors.colorfulCard.ink).toBe('#ffffff');
  });

  it('uses a distinct light gradient and dark ink in light mode', () => {
    expect(lightTheme.colors.gradients.colorfulCard).not.toEqual(
      lightTheme.colors.gradients.progress
    );
    expect(lightTheme.colors.gradients.colorfulCard).toEqual(['#d8daee', '#c5dad7', '#bcd3cb']);
    expect(lightTheme.colors.colorfulCard.ink).toBe(lightTheme.colors.text.primary);
  });
});
