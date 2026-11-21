// Render tests for the Premium entry rows. With the Premium build flag off (the default here, since
// EXPO_PUBLIC_PREMIUM_UI is never set in Jest) the real usePremium() reports enabled=false and the
// rows must render nothing. A forced enabled=true is the sanity check that the rows can be seen.
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';

import AiProviderScreen from '@/app/app/onboarding/ai-provider';
import { AINotConfiguredModal } from '@/components/modals/AINotConfiguredModal';

const mockForcePremium = { on: false };
const mockGo = jest.fn();
const mockDraftUpdate = jest.fn(async () => undefined);

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en-US' } }),
  initReactI18next: { type: '3rdParty', init: () => undefined },
}));
// The real usePremium imports the settings service and the database; this suite only needs its flag
// answer, so the storage layer is stubbed out.
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { get: jest.fn(async () => null), observe: jest.fn() },
}));
jest.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({ useHostedAi: false, premiumConsentVersion: null }),
}));
jest.mock('@/hooks/usePremium', () => {
  const actual = jest.requireActual('@/hooks/usePremium');

  return {
    usePremium: () => {
      const real = actual.usePremium();

      return mockForcePremium.on ? { ...real, enabled: true } : real;
    },
  };
});
jest.mock('@/components/modals/FullScreenModal', () => {
  const { createElement: create } = require('react');

  return {
    FullScreenModal: ({
      visible,
      children,
      footer,
    }: {
      visible: boolean;
      children?: unknown;
      footer?: unknown;
    }) => (visible ? create('div', { 'data-testid': 'full-screen' }, children, footer) : null),
  };
});
jest.mock('@/components/modals/PremiumModal', () => ({
  PremiumModal: () => null,
}));

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ navigate: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock('react-native-keyboard-controller', () => {
  const { View } = require('react-native');

  return { KeyboardAwareScrollView: View };
});
jest.mock('@/components/MasterLayout', () => ({
  MasterLayout: ({ children }: { children?: unknown }) => children,
}));
jest.mock('@/components/modals/ConfirmationModal', () => ({ ConfirmationModal: () => null }));
jest.mock('@/hooks/useAiSetupSession', () => ({
  useAiSetupSession: () => ({
    draftApi: { update: mockDraftUpdate },
    go: mockGo,
    isDraftLoaded: true,
  }),
}));
jest.mock('@/services/aiProviderSetup', () => ({
  enableFreeTier: jest.fn(async () => undefined),
  testAndSaveApiKey: jest.fn(async () => 'ok'),
}));
jest.mock('@/services/AiService', () => ({
  AiService: { getAiConfigForProvider: jest.fn(async () => null) },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
jest.mock('@/components/theme/ScreenHeader', () => ({ ScreenHeader: () => null }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({
  isMusclogGatewayAvailable: () => false,
}));

describe('AINotConfiguredModal Premium entry', () => {
  beforeEach(() => {
    mockForcePremium.on = false;
  });

  it('renders no Premium button when the Premium build flag is off', () => {
    render(
      createElement(AINotConfiguredModal, {
        visible: true,
        onClose: jest.fn(),
        onOpenAISettings: jest.fn(),
      })
    );

    expect(screen.queryByText('ai.notConfiguredModal.premium')).toBeNull();
    expect(screen.getByText('ai.notConfiguredModal.openSettings')).toBeTruthy();
    expect(screen.getByText('ai.notConfiguredModal.notNow')).toBeTruthy();
  });

  it('keeps the plain close button when there is no settings handler and Premium is off', () => {
    render(createElement(AINotConfiguredModal, { visible: true, onClose: jest.fn() }));

    expect(screen.queryByText('ai.notConfiguredModal.premium')).toBeNull();
    expect(screen.getByText('common.close')).toBeTruthy();
  });

  it('shows the Premium button above the settings button when Premium is enabled', () => {
    mockForcePremium.on = true;
    render(
      createElement(AINotConfiguredModal, {
        visible: true,
        onClose: jest.fn(),
        onOpenAISettings: jest.fn(),
      })
    );

    const premium = screen.getByText('ai.notConfiguredModal.premium');
    const settings = screen.getByText('ai.notConfiguredModal.openSettings');

    expect(premium).toBeTruthy();
    // DOCUMENT_POSITION_FOLLOWING: the settings button comes after the Premium button in the DOM.
    expect(
      premium.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('AI provider screen Premium row', () => {
  beforeEach(() => {
    mockForcePremium.on = false;
  });

  it('shows no Premium row when the Premium build flag is off', () => {
    render(createElement(AiProviderScreen));
    expect(screen.queryByText('aiOnboarding.provider.premiumTitle')).toBeNull();
    expect(screen.queryByText('aiOnboarding.provider.premiumHint')).toBeNull();
    // The rows around it are still there, so the screen did render.
    expect(screen.getByText('aiOnboarding.provider.intro')).toBeTruthy();
    expect(screen.getByText('aiOnboarding.provider.names.gemini')).toBeTruthy();
  });

  it('shows the Premium row when Premium is enabled', () => {
    mockForcePremium.on = true;
    render(createElement(AiProviderScreen));

    expect(screen.getByText('aiOnboarding.provider.premiumTitle')).toBeTruthy();
  });
});
