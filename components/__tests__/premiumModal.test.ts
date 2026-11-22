import { readFileSync } from 'fs';
import { join } from 'path';

import { PREMIUM_NOTICES, premiumNoticeCopy } from '@/components/premium/premiumNotices';
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

describe('premiumNoticeCopy', () => {
  it('uses the plain key for every notice but the used-up allowance', () => {
    expect(premiumNoticeCopy('offline', 'x')).toEqual({ key: 'premium.notice.offline' });
  });

  it('names the renewal date when it is known and falls back when it is not', () => {
    expect(premiumNoticeCopy('exhausted', '1 Dec')).toEqual({
      key: 'premium.notice.exhausted',
      params: { date: '1 Dec' },
    });
    expect(premiumNoticeCopy('exhausted', null)).toEqual({
      key: 'premium.notice.exhaustedNoDate',
    });
  });
});
