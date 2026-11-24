import { SETTINGS } from '@/constants/settingDefinitions';

import AiService from '../AiService';

// With Premium off (flag off, or the setting off) the resolution of every existing provider is the
// one it was before hosted AI existed.
const store: Record<string, unknown> = {};
const named: Record<string, unknown> = {};

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: new Proxy(
    {},
    {
      get: (_target, name: string) => {
        if (name === 'get') {
          return async (definition: { type: string; defaultValue: unknown }) =>
            definition.type in store ? store[definition.type] : definition.defaultValue;
        }
        if (name in named) {
          const value = named[name];
          return jest.fn().mockResolvedValue(value);
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
    engine: 'apple',
    state: 'ready',
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

let mockFlag = false;
jest.mock('@/utils/premium/premiumUiFlag', () => ({
  isPremiumUiEnabled: () => mockFlag,
}));

const mockGrant = jest.fn();
jest.mock('@/services/premium/premiumService', () => ({
  getPremiumStatus: jest.fn().mockResolvedValue('active'),
  hostedAiBaseUrl: jest.fn(() => 'https://hosted.example'),
  getSessionGrant: () => mockGrant(),
}));

type Case = { name: string; settings: Record<string, unknown>; expected: string };

// Each case turns one provider on; every other provider is off, so the expectation is unambiguous.
const cases: Case[] = [
  { name: 'gateway', settings: { getUseMusclogFreeTier: true }, expected: 'gateway' },
  { name: 'on-device', settings: { getUseOnDeviceAi: true }, expected: 'on-device' },
  {
    name: 'local',
    settings: { getEnableLocalLlm: true, getLocalLlmBaseUrl: 'http://localhost:11434' },
    expected: 'local',
  },
  {
    name: 'gemini',
    settings: { getEnableGoogleGemini: true, getGoogleGeminiApiKey: 'g' },
    expected: 'gemini',
  },
  { name: 'openai', settings: { getEnableOpenAi: true, getOpenAiApiKey: 'o' }, expected: 'openai' },
];

function load(settings: Record<string, unknown>, premium: { flag: boolean; hosted: boolean }) {
  for (const key of Object.keys(store)) delete store[key];
  for (const key of Object.keys(named)) delete named[key];
  mockFlag = premium.flag;
  store[SETTINGS.useHostedAi.type] = premium.hosted;
  store[SETTINGS.enableClaude.type] = false;
  Object.assign(named, { getLanguage: 'en-US', getClaudeApiKey: '' }, settings);
}

describe('AiService with Premium off keeps the existing resolution', () => {
  beforeEach(() => mockGrant.mockReset());

  it.each([
    ['flag off, setting on', { flag: false, hosted: true }],
    ['flag on, setting off', { flag: true, hosted: false }],
    ['flag off, setting off', { flag: false, hosted: false }],
  ])(
    '%s: each existing provider still answers alone and no grant is minted',
    async (_label, premium) => {
      for (const { settings, expected } of cases) {
        load(settings, premium);
        await expect(AiService.getAiConfig()).resolves.toMatchObject({ provider: expected });
      }
      expect(mockGrant).not.toHaveBeenCalled();
    }
  );

  it('keeps the priority among existing providers when Premium is off', async () => {
    load(
      { getUseMusclogFreeTier: true, getEnableGoogleGemini: true, getGoogleGeminiApiKey: 'g' },
      { flag: false, hosted: true }
    );
    await expect(AiService.getAiConfig()).resolves.toMatchObject({ provider: 'gateway' });
  });
});
