import { act, fireEvent, render, screen } from '@testing-library/react';
import { Linking } from 'react-native';

import { PREMIUM_BUSY_KEYS, PremiumModal } from '@/components/modals/PremiumModal';
import { PREMIUM_NOTICES } from '@/components/premium/premiumNotices';
import { PREMIUM_BENEFITS } from '@/components/premium/PremiumPaywall';
import { usePremium } from '@/hooks/usePremium';
import {
  beginPremiumActivity,
  endPremiumActivity,
  getPremiumActionFailure,
  resetPremiumActivity,
} from '@/utils/premium/premiumActivity';
import { PREMIUM_PRIVACY_PATH, PREMIUM_TERMS_PATH } from '@/utils/premium/premiumLinks';
import { websitePageUrl } from '@/utils/websiteUrl';
import {
  buildPremiumViewModel,
  type PremiumNotice,
  type PremiumViewInput,
  type PremiumViewModel,
} from '@/utils/premium/premiumUiState';

jest.mock('@/hooks/usePremium', () => ({ usePremium: jest.fn() }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/hooks/useFormatAppNumber', () => ({
  useFormatAppNumber: () => ({ formatInteger: (n: number) => String(n) }),
}));
jest.mock('@/hooks/useSubModalVisibility', () => {
  const react = require('react');
  return {
    // The real hook starts closed; the dialog opens only on a request.
    useSubModalVisibility: () => react.useState(false),
  };
});
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));
// The real modal chrome is out of scope here: render its children only while visible.
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({ visible, children, title, footer, overlay }: any) =>
    visible ? (
      <div>
        <h1>{title}</h1>
        {children}
        {footer}
        {overlay}
      </div>
    ) : null,
}));
jest.mock('@/components/modals/ConfirmationModal', () => ({
  ConfirmationModal: ({ visible, onConfirm, confirmLabel, title, message, scrollable }: any) =>
    visible ? (
      <div data-scrollable={scrollable ? 'true' : 'false'}>
        <span>{title}</span>
        <p>{message}</p>
        <button onClick={() => onConfirm()}>{confirmLabel}</button>
      </div>
    ) : null,
}));

const mockUsePremium = usePremium as jest.Mock;

function input(overrides: Partial<PremiumViewInput> = {}): PremiumViewInput {
  return {
    status: 'not_subscribed' as never,
    config: null,
    configFailure: null,
    usage: null,
    lastActionFailure: null,
    signal: null,
    busy: false,
    ...overrides,
  };
}

function premiumWith(view: PremiumViewModel, extra: Record<string, unknown> = {}) {
  return {
    enabled: true,
    view,
    priceString: null,
    busy: false,
    activity: null,
    useHostedAi: false,
    subscribe: jest.fn(async () => false),
    restore: jest.fn(async () => false),
    refresh: jest.fn(async () => undefined),
    setUseHostedAi: jest.fn(async () => undefined),
    reset: jest.fn(async () => undefined),
    consentNeeded: jest.fn(() => false),
    recordConsent: jest.fn(async () => undefined),
    ...extra,
  };
}

const CONFIG_ON = { enabled: true, acceptingNew: true } as never;

function renderModal() {
  return render(<PremiumModal visible onClose={jest.fn()} />);
}

describe('PremiumModal', () => {
  let openURL: jest.SpyInstance;

  beforeEach(() => {
    mockUsePremium.mockReset();
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  afterEach(() => {
    openURL.mockRestore();
  });

  describe('notices', () => {
    // 'exhausted' depends on the renewal date and has its own tests below.
    const plainNotices = (Object.keys(PREMIUM_NOTICES) as PremiumNotice[]).filter(
      (notice) => notice !== 'exhausted'
    );

    it.each(plainNotices)('renders the %s notice key', (notice) => {
      // A view carrying the notice directly; the phase does not matter for the text.
      mockUsePremium.mockReturnValue(
        premiumWith({
          ...buildPremiumViewModel(input({ status: 'active' as never })),
          notice,
        })
      );

      renderModal();

      expect(screen.getByText(PREMIUM_NOTICES[notice].key)).toBeTruthy();
    });

    it('renders the dated exhausted notice with the renewal date', () => {
      mockUsePremium.mockReturnValue(
        premiumWith({
          ...buildPremiumViewModel(input({ status: 'exhausted' as never })),
          notice: 'exhausted',
          resetsAt: '2026-12-01T00:00:00.000Z',
        })
      );

      renderModal();

      expect(screen.getByText(/premium\.notice\.exhausted:\{"date":"/)).toBeTruthy();
    });

    it('renders the undated exhausted notice when there is no renewal date', () => {
      mockUsePremium.mockReturnValue(
        premiumWith({
          ...buildPremiumViewModel(input({ status: 'exhausted' as never })),
          notice: 'exhausted',
          resetsAt: null,
        })
      );

      renderModal();

      expect(screen.getByText('premium.notice.exhaustedNoDate')).toBeTruthy();
    });
  });

  describe('subscribe and restore', () => {
    it('hides Subscribe when the view cannot subscribe', () => {
      mockUsePremium.mockReturnValue(premiumWith(buildPremiumViewModel(input({ config: null }))));

      renderModal();

      expect(screen.queryByText('premium.subscribe')).toBeNull();
    });

    it('shows Subscribe when the view can subscribe', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })))
      );

      renderModal();

      expect(screen.getByText('premium.subscribe')).toBeTruthy();
    });

    it('lets a revoked subscription subscribe again and restore', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ status: 'revoked' as never, config: CONFIG_ON })))
      );

      renderModal();

      expect(screen.getByText('premium.notice.revoked')).toBeTruthy();
      expect(screen.getByText('premium.subscribe')).toBeTruthy();
      expect(screen.getByText('premium.restore')).toBeTruthy();
    });

    it('shows Restore iff the view can restore', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })))
      );
      const { unmount } = renderModal();
      expect(screen.getByText('premium.restore')).toBeTruthy();
      unmount();

      mockUsePremium.mockReturnValue(
        premiumWith({ ...buildPremiumViewModel(input({ config: CONFIG_ON })), canRestore: false })
      );
      renderModal();
      expect(screen.queryByText('premium.restore')).toBeNull();
    });

    it('calls subscribe when Subscribe is pressed', () => {
      const premium = premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })));
      mockUsePremium.mockReturnValue(premium);

      renderModal();
      fireEvent.click(screen.getByText('premium.subscribe'));

      expect(premium.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('hosted AI switch and consent', () => {
    const activeView = buildPremiumViewModel(
      input({
        status: 'active' as never,
        usage: { usedPct: 10, resetsAt: null, devices: { count: 1, max: 3 } } as never,
      })
    );

    it('keeps the switch usable to turn AI off when the period has run out, never to turn it on', () => {
      const exhausted = buildPremiumViewModel(
        input({
          status: 'exhausted' as never,
          usage: { usedPct: 100, resetsAt: null, devices: { count: 1, max: 3 } } as never,
        })
      );

      mockUsePremium.mockReturnValue(premiumWith(exhausted, { useHostedAi: true }));
      const { unmount } = renderModal();
      expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(false);
      unmount();

      mockUsePremium.mockReturnValue(premiumWith(exhausted, { useHostedAi: false }));
      renderModal();
      expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
    });

    it('opens the consent dialog and does not enable AI until confirmed', async () => {
      const premium = premiumWith(activeView, {
        consentNeeded: jest.fn(() => true),
      });
      mockUsePremium.mockReturnValue(premium);

      renderModal();
      fireEvent.click(screen.getByRole('switch'));

      expect(screen.getByText('premium.consent.title')).toBeTruthy();
      // The consent ends with the AI-accuracy acknowledgement, after the body.
      expect(screen.getByText(/premium\.consent\.body\s+ai\.disclaimer\.consent/)).toBeTruthy();
      // The consent text is long (and longer in other languages): its body must scroll on a small
      // screen so the buttons never fall below the fold.
      expect(screen.getByText('premium.consent.title').parentElement?.dataset.scrollable).toBe(
        'true'
      );
      expect(premium.setUseHostedAi).not.toHaveBeenCalled();
      expect(premium.recordConsent).not.toHaveBeenCalled();
    });

    it('offers consent review for enabled AI with stale consent, even after allowance is exhausted', () => {
      const exhausted = buildPremiumViewModel(
        input({
          status: 'exhausted' as never,
          usage: { usedPct: 100, resetsAt: null, devices: { count: 1, max: 3 } } as never,
        })
      );
      const premium = premiumWith(exhausted, {
        useHostedAi: true,
        consentNeeded: jest.fn(() => true),
      });
      mockUsePremium.mockReturnValue(premium);

      renderModal();

      fireEvent.click(screen.getByText('premium.consent.review'));

      expect(screen.getByText('premium.consent.title')).toBeTruthy();
      expect(premium.recordConsent).not.toHaveBeenCalled();
      expect(premium.setUseHostedAi).not.toHaveBeenCalled();
    });

    it('records consent and then enables AI when the consent is confirmed', async () => {
      const calls: string[] = [];
      const premium = premiumWith(activeView, {
        consentNeeded: jest.fn(() => true),
        recordConsent: jest.fn(async () => {
          calls.push('consent');
        }),
        setUseHostedAi: jest.fn(async (on: boolean) => {
          calls.push(`set:${on}`);
        }),
      });
      mockUsePremium.mockReturnValue(premium);

      renderModal();
      fireEvent.click(screen.getByRole('switch'));
      fireEvent.click(screen.getByText('premium.consent.confirm'));

      await Promise.resolve();
      await Promise.resolve();
      expect(calls).toEqual(['consent', 'set:true']);
    });

    it('enables AI directly when consent is already on record', () => {
      const premium = premiumWith(activeView, { consentNeeded: jest.fn(() => false) });
      mockUsePremium.mockReturnValue(premium);

      renderModal();
      fireEvent.click(screen.getByRole('switch'));

      expect(premium.setUseHostedAi).toHaveBeenCalledWith(true);
      expect(screen.queryByText('premium.consent.title')).toBeNull();
    });
  });

  describe('disclosures and links', () => {
    beforeEach(() => {
      mockUsePremium.mockReturnValue(premiumWith(buildPremiumViewModel(input({ config: null }))));
    });

    it('shows the renewal, devices and platforms texts', () => {
      renderModal();

      expect(screen.getByText('premium.renewalDisclosure')).toBeTruthy();
      expect(screen.getByText('premium.devicesNote')).toBeTruthy();
      expect(screen.getByText('premium.platformsNote')).toBeTruthy();
    });

    it('opens the terms and privacy pages', () => {
      renderModal();

      fireEvent.click(screen.getByText('premium.terms'));
      expect(openURL).toHaveBeenLastCalledWith(websitePageUrl(PREMIUM_TERMS_PATH, 'en-US'));

      fireEvent.click(screen.getByText('premium.privacy'));
      expect(openURL).toHaveBeenLastCalledWith(websitePageUrl(PREMIUM_PRIVACY_PATH, 'en-US'));
    });

    it('opens each AI gateway privacy policy and terms', () => {
      renderModal();

      expect(screen.getByText('common.aiGateways.intro')).toBeTruthy();
      for (const link of [
        ['common.aiGateways.openrouterPrivacy', 'https://openrouter.ai/privacy'],
        ['common.aiGateways.openrouterTerms', 'https://openrouter.ai/terms'],
        ['common.aiGateways.otariPrivacy', 'https://otari.ai/privacy'],
        ['common.aiGateways.otariTerms', 'https://otari.ai/terms'],
      ]) {
        fireEvent.click(screen.getByText(link[0]));
        expect(openURL).toHaveBeenLastCalledWith(link[1]);
      }
    });
  });

  describe('paywall', () => {
    it('shows the headline, every benefit and the comparison when not subscribed', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })))
      );

      renderModal();

      expect(screen.getByText('premium.paywall.headline')).toBeTruthy();
      for (const { titleKey } of PREMIUM_BENEFITS) {
        expect(screen.getByText(titleKey)).toBeTruthy();
      }
      expect(screen.getByText('premium.paywall.compare.title')).toBeTruthy();
    });

    it('labels the CTA with the price when the store gave one', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })), { priceString: '$4.99' })
      );

      renderModal();

      expect(
        screen.getByText('premium.paywall.cta:' + JSON.stringify({ price: '$4.99' }))
      ).toBeTruthy();
      expect(screen.queryByText('premium.subscribe')).toBeNull();
    });

    it('falls back to the plain Subscribe label with no price', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })), { priceString: null })
      );

      renderModal();

      expect(screen.getByText('premium.subscribe')).toBeTruthy();
    });

    it('shows the reassurance only when it can subscribe', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })))
      );
      const { unmount } = renderModal();
      expect(screen.getByText('premium.paywall.reassurance')).toBeTruthy();
      unmount();

      mockUsePremium.mockReturnValue(premiumWith(buildPremiumViewModel(input({ config: null }))));
      renderModal();
      expect(screen.queryByText('premium.paywall.reassurance')).toBeNull();
    });

    it('shows Restore alongside Subscribe', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ config: CONFIG_ON })))
      );

      renderModal();

      expect(screen.getByText('premium.subscribe')).toBeTruthy();
      expect(screen.getByText('premium.restore')).toBeTruthy();
    });

    it('shows the benefit text and no paywall headline when active', () => {
      mockUsePremium.mockReturnValue(
        premiumWith(buildPremiumViewModel(input({ status: 'active' as never })))
      );

      renderModal();

      expect(screen.getByText('premium.benefit')).toBeTruthy();
      expect(screen.queryByText('premium.paywall.headline')).toBeNull();
    });
  });

  it('shows the loading text while the status is unknown', () => {
    mockUsePremium.mockReturnValue(premiumWith(buildPremiumViewModel(input({ status: null }))));

    renderModal();

    expect(screen.getByText('premium.loading')).toBeTruthy();
  });
});

describe('PremiumModal busy feedback', () => {
  const paywall = buildPremiumViewModel(input({ config: CONFIG_ON, busy: true }));
  const activeView = buildPremiumViewModel(
    input({
      status: 'active' as never,
      usage: { usedPct: 10, resetsAt: null, devices: { count: 1, max: 3 } } as never,
    })
  );

  beforeEach(() => {
    mockUsePremium.mockReset();
    resetPremiumActivity();
  });

  it.each([
    ['store', 'subscribe'],
    ['confirming', 'subscribe'],
    ['slow', 'restore'],
  ] as const)('shows the %s stage line in the paywall footer, keeps the buttons', (stage, kind) => {
    mockUsePremium.mockReturnValue(premiumWith(paywall, { busy: true, activity: { kind, stage } }));

    renderModal();

    const line = screen.getByText(PREMIUM_BUSY_KEYS[stage]);
    expect(line.closest('[aria-live]')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText('premium.subscribe')).toBeTruthy();
    // The quiet Restore link beside it is disabled while anything runs.
    expect(
      screen.getByText('premium.restore').closest('[aria-disabled]')?.getAttribute('aria-disabled')
    ).toBe('true');
  });

  it('shows no line when idle', () => {
    mockUsePremium.mockReturnValue(premiumWith(paywall));
    renderModal();

    Object.values(PREMIUM_BUSY_KEYS).forEach((key) => expect(screen.queryByText(key)).toBeNull());
  });

  it('shows a status line and disables the switch and reset while resetting', () => {
    mockUsePremium.mockReturnValue(
      premiumWith(activeView, { busy: true, activity: { kind: 'reset', stage: null } })
    );

    renderModal();

    expect(screen.getByText(PREMIUM_BUSY_KEYS.reset)).toBeTruthy();
    expect((screen.getByRole('switch') as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByText('premium.reset').closest('button') as HTMLButtonElement).disabled
    ).toBe(true);
  });

  it('shows a status line while the AI switch is being saved', () => {
    mockUsePremium.mockReturnValue(
      premiumWith(activeView, { busy: true, activity: { kind: 'toggle', stage: null } })
    );

    renderModal();

    expect(screen.getByText(PREMIUM_BUSY_KEYS.toggle)).toBeTruthy();
  });

  it('asks the consent question on open when a purchase finished while it was closed', async () => {
    beginPremiumActivity('subscribe');
    endPremiumActivity('subscribe', { ok: true });
    mockUsePremium.mockReturnValue(premiumWith(activeView, { consentNeeded: jest.fn(() => true) }));

    renderModal();

    expect(await screen.findByText('premium.consent.title')).toBeTruthy();
  });

  it('does not ask again when consent is already on record, and asks only once', async () => {
    beginPremiumActivity('restore');
    endPremiumActivity('restore', { ok: true });
    mockUsePremium.mockReturnValue(
      premiumWith(activeView, { consentNeeded: jest.fn(() => false) })
    );

    const { unmount } = renderModal();
    await act(async () => undefined);
    expect(screen.queryByText('premium.consent.title')).toBeNull();
    unmount();

    mockUsePremium.mockReturnValue(premiumWith(activeView, { consentNeeded: jest.fn(() => true) }));
    renderModal();
    await act(async () => undefined);
    expect(screen.queryByText('premium.consent.title')).toBeNull();
  });
});

describe('PremiumModal closing dismisses the last failure', () => {
  it('clears a cancelled-purchase failure when the modal closes, so a reopen shows no stale notice', () => {
    mockUsePremium.mockReturnValue(premiumWith(buildPremiumViewModel(input())));
    beginPremiumActivity('subscribe');
    endPremiumActivity('subscribe', { ok: false, failure: 'purchase_cancelled' });
    expect(getPremiumActionFailure()).toBe('purchase_cancelled');

    const { rerender } = render(<PremiumModal visible onClose={jest.fn()} />);
    rerender(<PremiumModal visible={false} onClose={jest.fn()} />);

    expect(getPremiumActionFailure()).toBeNull();

    rerender(<PremiumModal visible onClose={jest.fn()} />);
    expect(getPremiumActionFailure()).toBeNull();
    expect(screen.queryByText(PREMIUM_NOTICES.purchase_cancelled.key)).toBeNull();
  });
});
