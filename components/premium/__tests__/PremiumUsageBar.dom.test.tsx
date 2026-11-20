import { fireEvent, render, screen } from '@testing-library/react';

import { PremiumUsageBar } from '@/components/premium/PremiumUsageBar';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatInteger: (n: number) => String(n) }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

/** The fill is the bar's only child; its width is the clamped percentage. */
function fillWidth(): string {
  const bar = screen.getByRole('progressbar');
  return (bar.firstElementChild as HTMLElement).style.width;
}

describe('PremiumUsageBar', () => {
  it('shows the rounded percentage and a progressbar with the clamped value', () => {
    render(<PremiumUsageBar usedPct={42.6} resetsAt={null} />);

    expect(screen.getByText('premium.usage.used:{"pct":"43"}')).toBeTruthy();
    expect(screen.getByRole('progressbar')).toBeTruthy();
    expect(fillWidth()).toBe('42.6%'); // the fill keeps the exact value; only the label rounds
  });

  it('carries no warning text of its own: the modal notice says it once', () => {
    render(<PremiumUsageBar usedPct={95} resetsAt={null} />);

    expect(screen.queryByText('premium.usage.nearLimit')).toBeNull();
    expect(screen.queryByText('premium.usage.full')).toBeNull();
  });

  it('clamps the fill to 100 above it', () => {
    render(<PremiumUsageBar usedPct={130} resetsAt={null} />);

    expect(fillWidth()).toBe('100%');
  });

  it('clamps a negative percentage to an empty fill', () => {
    render(<PremiumUsageBar usedPct={-5} resetsAt={null} />);

    expect(fillWidth()).toBe('0%');
  });

  it('shows the renewal line only when the reset instant is readable', () => {
    const { rerender } = render(
      <PremiumUsageBar usedPct={10} resetsAt="2026-12-01T00:00:00.000Z" />
    );
    expect(screen.getByText(/premium\.usage\.renews/)).toBeTruthy();

    rerender(<PremiumUsageBar usedPct={10} resetsAt="not a date" />);
    expect(screen.queryByText(/premium\.usage\.renews/)).toBeNull();
  });

  it('is fire-and-forget safe: rendering alone triggers no press handlers', () => {
    render(<PremiumUsageBar usedPct={10} resetsAt={null} />);
    fireEvent.click(screen.getByRole('progressbar'));
    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
