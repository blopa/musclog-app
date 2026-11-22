import { fireEvent, render, screen } from '@testing-library/react';

import { PremiumCard } from '@/components/settings/PremiumCard';
import { usePremium } from '@/hooks/usePremium';
import { buildPremiumViewModel, type PremiumViewModel } from '@/utils/premium/premiumUiState';

jest.mock('@/hooks/usePremium', () => ({ usePremium: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatInteger: (n: number) => String(n) }),
}));
jest.mock('@/hooks/useIsCramped', () => ({ useIsCramped: () => false }));
jest.mock('@/hooks/useMeasuredWidth', () => ({
  useMeasuredWidth: () => ({ width: 360, fontScale: 1, onLayout: () => undefined }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

const mockUsePremium = usePremium as jest.Mock;

function premiumWith(view: PremiumViewModel, enabled = true) {
  return {
    enabled,
    view,
    priceString: null,
    busy: false,
    useHostedAi: false,
    subscribe: jest.fn(),
    restore: jest.fn(),
    refresh: jest.fn(),
    setUseHostedAi: jest.fn(),
    reset: jest.fn(),
    consentNeeded: jest.fn(() => false),
    recordConsent: jest.fn(),
  };
}

const loadingView = buildPremiumViewModel({
  status: null,
  config: null,
  configFailure: null,
  usage: null,
  lastActionFailure: null,
  signal: null,
  busy: false,
});

describe('PremiumCard', () => {
  beforeEach(() => {
    mockUsePremium.mockReset();
  });

  it('renders nothing while Premium is switched off in this build', () => {
    mockUsePremium.mockReturnValue(premiumWith(loadingView, false));

    const { container } = render(<PremiumCard onPress={jest.fn()} />);

    expect(container.textContent).toBe('');
    expect(screen.queryByText('premium.title')).toBeNull();
  });

  it('shows the loading subtitle before the status is read', () => {
    mockUsePremium.mockReturnValue(premiumWith(loadingView));

    render(<PremiumCard onPress={jest.fn()} />);

    expect(screen.getByText('premium.title')).toBeTruthy();
    expect(screen.getByText('premium.card.checking')).toBeTruthy();
  });

  it('shows the not-subscribed subtitle', () => {
    mockUsePremium.mockReturnValue(
      premiumWith(
        buildPremiumViewModel({
          status: 'not_subscribed' as never,
          config: null,
          configFailure: null,
          usage: null,
          lastActionFailure: null,
          signal: null,
          busy: false,
        })
      )
    );

    render(<PremiumCard onPress={jest.fn()} />);

    expect(screen.getByText('premium.card.notSubscribed')).toBeTruthy();
  });

  it('shows the active subtitle with the rounded usage and device count', () => {
    mockUsePremium.mockReturnValue(
      premiumWith(
        buildPremiumViewModel({
          status: 'active',
          config: null,
          configFailure: null,
          usage: {
            usedPct: 42.4,
            resetsAt: null,
            devices: { count: 2, max: 3 },
          } as never,
          lastActionFailure: null,
          signal: null,
          busy: false,
        })
      )
    );

    render(<PremiumCard onPress={jest.fn()} />);

    expect(screen.getByText('premium.card.active:{"pct":"42","count":"2","max":"3"}')).toBeTruthy();
  });

  it('says active, never checking, when the status is read but usage could not be', () => {
    mockUsePremium.mockReturnValue(
      premiumWith(
        buildPremiumViewModel({
          status: 'active',
          config: null,
          configFailure: null,
          usage: null,
          lastActionFailure: null,
          signal: null,
          busy: false,
        })
      )
    );

    render(<PremiumCard onPress={jest.fn()} />);

    expect(screen.getByText('premium.card.activeNoUsage')).toBeTruthy();
    expect(screen.queryByText('premium.card.checking')).toBeNull();
  });

  it.each([
    ['exhausted', 'premium.card.exhausted'],
    ['removed', 'premium.card.removed'],
    ['revoked', 'premium.card.revoked'],
  ])('shows the %s subtitle', (status, key) => {
    mockUsePremium.mockReturnValue(
      premiumWith(
        buildPremiumViewModel({
          status: status as never,
          config: null,
          configFailure: null,
          usage: null,
          lastActionFailure: null,
          signal: null,
          busy: false,
        })
      )
    );

    render(<PremiumCard onPress={jest.fn()} />);

    expect(screen.getByText(key)).toBeTruthy();
  });

  it('calls onPress when the row is tapped', () => {
    const onPress = jest.fn();
    mockUsePremium.mockReturnValue(premiumWith(loadingView));

    render(<PremiumCard onPress={onPress} />);
    fireEvent.click(screen.getByText('premium.title'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
