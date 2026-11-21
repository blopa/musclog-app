import { readFileSync } from 'fs';
import { join } from 'path';

import { hostedToggleDecision, PREMIUM_NOTICES } from '@/components/modals/PremiumModal';
import type { PremiumNotice } from '@/utils/premium/premiumUiState';

// The pure helpers live beside the component, so the module is loaded for them. Its UI imports pull
// ESM-only native packages the node project cannot load, and none of them run here.
jest.mock('@/components/modals/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('@/components/modals/FullScreenModal', () => ({ FullScreenModal: () => null }));
jest.mock('@/components/premium/PremiumUsageBar', () => ({
  PremiumUsageBar: () => null,
  formatRenewalDate: () => null,
}));
jest.mock('@/components/theme/Button', () => ({ Button: () => null }));
jest.mock('@/components/theme/TextButton', () => ({ TextButton: () => null }));
jest.mock('@/components/theme/ToggleInput', () => ({ ToggleInput: () => null }));
jest.mock('@/hooks/usePremium', () => ({ usePremium: () => ({}) }));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => ({}) }));
jest.mock('@/hooks/useFormatAppNumber', () => ({ useFormatAppNumber: () => ({}) }));
jest.mock('@/hooks/useSubModalVisibility', () => ({
  useSubModalVisibility: () => [false, () => {}],
}));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: {} }) }));

const modalSource = readFileSync(join(__dirname, '..', 'modals', 'PremiumModal.tsx'), 'utf8');
const cardSource = readFileSync(join(__dirname, '..', 'settings', 'PremiumCard.tsx'), 'utf8');

const ALL_NOTICES: PremiumNotice[] = [
  'offline',
  'purchase_cancelled',
  'purchase_failed',
  'restore_nothing',
  'confirming',
  'removed',
  'revoked',
  'exhausted',
  'at_capacity',
  'unavailable',
  'not_accepting',
  'not_available',
  'warning80',
];

describe('PREMIUM_NOTICES', () => {
  it.each(ALL_NOTICES)('has a whole key and a tone for %s', (notice) => {
    expect(PREMIUM_NOTICES[notice].key).toBe(`premium.notice.${notice}`);
    expect(PREMIUM_NOTICES[notice].tone).toMatch(/^(info|warning|error)$/);
  });

  it('has no entries beyond the PremiumNotice values', () => {
    expect(Object.keys(PREMIUM_NOTICES).sort()).toEqual([...ALL_NOTICES].sort());
  });
});

describe('hostedToggleDecision', () => {
  it('turning the switch off never asks for consent', () => {
    expect(hostedToggleDecision(false, true)).toBe('off');
    expect(hostedToggleDecision(false, false)).toBe('off');
  });

  it('turning it on without consent asks first', () => {
    expect(hostedToggleDecision(true, true)).toBe('ask_consent');
  });

  it('turning it on with consent on record applies directly', () => {
    expect(hostedToggleDecision(true, false)).toBe('on');
  });
});

describe('PremiumModal copy and structure', () => {
  it('shows Subscribe only when the view allows it', () => {
    expect(modalSource).toMatch(/view\.canSubscribe \?/);
  });

  it('shows Restore only when the view allows it', () => {
    expect(modalSource).toMatch(/view\.canRestore \?/);
  });

  it('puts the consent dialog inside the FullScreenModal tree, not beside it', () => {
    const start = modalSource.indexOf('<FullScreenModal');
    const end = modalSource.indexOf('</FullScreenModal>');
    expect(start).toBeGreaterThan(-1);
    expect(modalSource.indexOf('<ConfirmationModal', start)).toBeLessThan(end);
  });

  it('uses one ConfirmationModal for both questions', () => {
    expect(modalSource.match(/<ConfirmationModal/g)).toHaveLength(1);
  });

  it('turns the switch on only through the consent confirm path', () => {
    expect(modalSource).toMatch(
      /confirmConsent = async \(\) => \{\s*await premium\.recordConsent\(\);\s*await premium\.setUseHostedAi\(true\);/
    );
  });

  it('carries the disclosure, device and platform keys', () => {
    expect(modalSource).toContain("t('premium.renewalDisclosure')");
    expect(modalSource).toContain("t('premium.devicesNote')");
    expect(modalSource).toContain("t('premium.platformsNote')");
  });

  it('links the terms and the privacy policy', () => {
    expect(modalSource).toContain("t('premium.terms')");
    expect(modalSource).toContain("t('premium.privacy')");
    expect(modalSource).toContain('PREMIUM_TERMS_URL');
    expect(modalSource).toContain('PREMIUM_PRIVACY_URL');
  });

  it('never names another provider as the fallback', () => {
    expect(modalSource.toLowerCase()).not.toMatch(/automatically (use|switch)/);
  });

  it('draws no glow, gradient or shadow', () => {
    expect(modalSource).not.toMatch(/shadow|gradient|Gradient/);
  });
});

describe('PremiumCard', () => {
  it('renders nothing while Premium is switched off', () => {
    expect(cardSource).toMatch(/if \(!enabled\) \{\s*return null;/);
  });

  it('gives each phase its own subtitle key', () => {
    for (const key of [
      'premium.card.notSubscribed',
      'premium.card.active',
      'premium.card.exhausted',
      'premium.card.removed',
      'premium.card.revoked',
    ]) {
      expect(cardSource).toContain(`'${key}'`);
    }
  });

  it('reuses the SettingsCard row', () => {
    expect(cardSource).toContain("from '@/components/cards/SettingsCard'");
  });
});
