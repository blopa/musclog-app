/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';

import { SETTINGS } from '@/constants/settingDefinitions';
import {
  ENABLE_CLAUDE_SETTING_TYPE,
  ENABLE_GOOGLE_GEMINI_SETTING_TYPE,
  ENABLE_LOCAL_LLM_SETTING_TYPE,
  ENABLE_OPENAI_SETTING_TYPE,
  LOCAL_LLM_BASE_URL_SETTING_TYPE,
  USE_MUSCLOG_FREE_TIER_SETTING_TYPE,
  USE_ON_DEVICE_AI_SETTING_TYPE,
} from '@/constants/settings';
import { SettingsProvider } from '@/context/SettingsContext';
import { useSettings } from '@/hooks/useSettings';
import AiService from '@/services/AiService';

// The probe in AiService and the three hand-written copies in SettingsContext must agree on which
// provider answers. This drives the real context from a table of setting combinations and compares
// its `aiProvider`, `isAiConfigured` and `isAiMealPhotoEnabled` with `AiService.getAiConfig()`.

const mockStore: Record<string, unknown> = {};
const mockNamed: Record<string, unknown> = {};
const mockFlagValue = { on: false };
const mockPremium = {
  status: 'active' as string,
  baseUrl: 'https://hosted.example' as string | null,
};

jest.mock('@/utils/premium/premiumUiFlag', () => ({
  isPremiumUiEnabled: () => mockFlagValue.on,
}));
jest.mock('@/services/premium/premiumService', () => ({
  getPremiumStatus: async () => mockPremium.status,
  hostedAiBaseUrl: () => mockPremium.baseUrl,
  getSessionGrant: async () => ({
    ok: true,
    value: { sessionToken: 'session-token', expiresAtMs: 1 },
  }),
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'get') {
          return async (definition: { type: string; defaultValue: unknown }) =>
            definition.type in mockStore ? mockStore[definition.type] : definition.defaultValue;
        }
        if (name in mockNamed) {
          return jest.fn().mockResolvedValue(mockNamed[name]);
        }
        return jest.fn().mockResolvedValue('');
      },
    }
  ),
}));
jest.mock('@/services/GatewayService', () => ({
  GatewayService: {
    buildGatewayConfig: jest.fn((language: string) => ({ provider: 'gateway', language })),
  },
}));
jest.mock('@/utils/musclogGatewayAvailability', () => ({
  effectiveUseMusclogGateway: (v: boolean) => v,
}));
jest.mock('@/services/localModels/onDeviceStatusStore', () => {
  const mockStatus = {
    initialized: true,
    engine: 'apple',
    state: 'ready',
    appleState: 'ready',
    progress: null,
    capabilities: { engine: 'apple', vision: false, contextChars: 4500 },
    updateAvailable: false,
  };

  return {
    refreshOnDeviceStatus: jest.fn().mockResolvedValue(mockStatus),
    getOnDeviceStatusSnapshot: () => mockStatus,
    subscribeOnDeviceStatus: () => () => undefined,
  };
});
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

// The settings table the provider observes: one row per stored setting type.
type FakeSetting = { id: string; type: string; updatedAt: number; value: string };
const mockRows: { current: FakeSetting[] } = { current: [] };
const mockQuery = {
  observeWithColumns: () => ({
    subscribe: (handlers: { next: (v: FakeSetting[]) => void }) => {
      handlers.next(mockRows.current);
      return { unsubscribe: () => undefined };
    },
  }),
};
jest.mock('@/database/database-instance', () => ({
  database: { get: () => ({ query: () => mockQuery }) },
}));
jest.mock('@/database/dbReady', () => ({
  isDbReady: () => true,
  waitForDbReady: jest.fn(() => Promise.resolve()),
}));
jest.mock('@/utils/settingsMirror', () => ({
  getSettingsMirror: () => null,
  recordSettingsMirror: jest.fn(),
}));
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(SettingsProvider, null, children);

type Combo = {
  flag: boolean;
  hosted: boolean;
  gateway: boolean;
  onDevice: boolean;
  local: boolean;
  gemini: boolean;
  openai: boolean;
  claude: boolean;
};

const bool = (value: boolean) => (value ? 'true' : 'false');

function apply(combo: Combo) {
  mockFlagValue.on = combo.flag;
  mockPremium.status = 'active';
  mockPremium.baseUrl = 'https://hosted.example';

  const pairs: Array<[string, string]> = [
    [SETTINGS.useHostedAi.type, bool(combo.hosted)],
    [USE_MUSCLOG_FREE_TIER_SETTING_TYPE, bool(combo.gateway)],
    [USE_ON_DEVICE_AI_SETTING_TYPE, bool(combo.onDevice)],
    [ENABLE_LOCAL_LLM_SETTING_TYPE, bool(combo.local)],
    [LOCAL_LLM_BASE_URL_SETTING_TYPE, combo.local ? 'http://localhost:11434' : ''],
    [ENABLE_GOOGLE_GEMINI_SETTING_TYPE, bool(combo.gemini)],
    [ENABLE_OPENAI_SETTING_TYPE, bool(combo.openai)],
    [ENABLE_CLAUDE_SETTING_TYPE, bool(combo.claude)],
  ];
  for (const key of Object.keys(mockStore)) delete mockStore[key];
  for (const [type, value] of pairs) {
    mockStore[type] = value === 'true' ? true : value === 'false' ? false : value;
  }
  mockRows.current = pairs.map(([type, value], index) => ({
    id: String(index),
    type,
    updatedAt: 1,
    value,
  }));

  for (const key of Object.keys(mockNamed)) delete mockNamed[key];
  Object.assign(mockNamed, {
    getLanguage: 'en-US',
    getUseMusclogFreeTier: combo.gateway,
    getUseOnDeviceAi: combo.onDevice,
    getEnableLocalLlm: combo.local,
    getLocalLlmBaseUrl: combo.local ? 'http://localhost:11434' : '',
    getEnableGoogleGemini: combo.gemini,
    getEnableOpenAi: combo.openai,
    getGoogleGeminiApiKey: combo.gemini ? 'gemini-key' : '',
    getOpenAiApiKey: combo.openai ? 'openai-key' : '',
    getLocalLlmApiKey: '',
    getClaudeApiKey: combo.claude ? 'claude-key' : '',
    getGoogleGeminiModel: '',
    getOpenAiModel: '',
  });
}

const combos: Combo[] = [];
for (const flag of [false, true])
  for (const hosted of [false, true])
    for (const gateway of [false, true])
      for (const onDevice of [false, true])
        for (const local of [false, true])
          for (const gemini of [false, true])
            for (const openai of [false, true])
              for (const claude of [false, true])
                combos.push({ flag, hosted, gateway, onDevice, local, gemini, openai, claude });

const flush = () =>
  act(async () => {
    for (let i = 0; i < 5; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  });

describe('AiService priority and SettingsContext agree', () => {
  it('for every setting combination, the context names the provider AiService answers with', async () => {
    for (const combo of combos) {
      apply(combo);
      const { result, unmount } = renderHook(() => useSettings(), { wrapper });
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await flush();

      const config = await AiService.getAiConfig();
      const label = JSON.stringify(combo);

      expect({ label, aiProvider: result.current.aiProvider }).toEqual({
        label,
        aiProvider: config?.provider ?? null,
      });
      expect({ label, isAiConfigured: result.current.isAiConfigured }).toEqual({
        label,
        isAiConfigured: config !== null,
      });
      expect({ label, photo: result.current.isAiMealPhotoEnabled }).toEqual({
        label,
        photo: config !== null && (config.provider !== 'on-device' || config.vision === true),
      });
      unmount();
    }
  }, 120_000);

  it('hosted is first when on and the Premium flag is on', async () => {
    apply({ ...combos[0], flag: true, hosted: true, gateway: true, gemini: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await flush();
    expect(result.current.aiProvider).toBe('hosted');
  });

  it('ignores a stored hosted switch when the Premium flag is off', async () => {
    apply({ ...combos[0], flag: false, hosted: true, gateway: true });
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await flush();
    expect(result.current.aiProvider).toBe('gateway');
  });
});
