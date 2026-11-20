import { SETTINGS } from '@/constants/settingDefinitions';

import AiService from '../AiService';

// One store for every setting, read through the definitions the probes use (`get`) and through the
// named getters the other providers use. Anything not set falls back to the definition default.
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
        if (name === 'set') {
          return jest.fn().mockResolvedValue(undefined);
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
jest.mock('@/utils/onDeviceAi', () => ({
  isOnDeviceAiAvailable: jest.fn().mockResolvedValue(true),
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

let mockFlag = false;
jest.mock('@/utils/premium/premiumUiFlag', () => ({
  isPremiumUiEnabled: () => mockFlag,
}));

const mockStatus = jest.fn();
const mockBaseUrl = jest.fn();
const mockGrant = jest.fn();
jest.mock('@/services/premium/premiumService', () => ({
  getPremiumStatus: () => mockStatus(),
  hostedAiBaseUrl: () => mockBaseUrl(),
  getSessionGrant: () => mockGrant(),
}));

function reset(options: {
  flag?: boolean;
  hosted?: boolean;
  status?: string;
  baseUrl?: string | null;
}) {
  for (const key of Object.keys(store)) delete store[key];
  for (const key of Object.keys(named)) delete named[key];
  mockFlag = options.flag ?? true;
  store[SETTINGS.useHostedAi.type] = options.hosted ?? true;
  mockStatus.mockResolvedValue(options.status ?? 'active');
  mockBaseUrl.mockReturnValue(
    options.baseUrl === undefined ? 'https://hosted.example' : options.baseUrl
  );
  mockGrant.mockReset();
  mockGrant.mockResolvedValue({
    ok: true,
    value: { sessionToken: 'session-token', expiresAtMs: 1 },
  });
  named.getLanguage = 'en-US';
}

describe('AiService hosted (Musclog Premium) probe', () => {
  beforeEach(() => reset({}));

  it('is null when the Premium build flag is off, even with the setting on', async () => {
    reset({ flag: false });
    const config = await AiService.getAiConfig();
    expect(config?.provider).not.toBe('hosted');
    await expect(AiService.getAiConfigForProvider('hosted')).resolves.toBeNull();
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('is null when the person has not switched hosted AI on', async () => {
    reset({ hosted: false });
    await expect(AiService.getAiConfigForProvider('hosted')).resolves.toBeNull();
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('is null when no base URL is configured (the web stub)', async () => {
    reset({ baseUrl: null });
    await expect(AiService.getAiConfigForProvider('hosted')).resolves.toBeNull();
  });

  it.each(['no_key', 'not_enrolled'] as const)('is null when the status is %s', async (status) => {
    reset({ status });
    await expect(AiService.getAiConfigForProvider('hosted')).resolves.toBeNull();
    expect(mockGrant).not.toHaveBeenCalled();
  });

  it('wins over a configured gateway and uses the session token as the key', async () => {
    reset({});
    named.getUseMusclogFreeTier = true;

    await expect(AiService.getAiConfig()).resolves.toEqual({
      provider: 'hosted',
      baseUrl: 'https://hosted.example',
      apiKey: 'session-token',
      model: 'musclog-hosted',
      language: 'en-US',
    });
    expect(mockGrant).toHaveBeenCalledTimes(1);
  });

  it('returns the config with the failure and does NOT fall through when the grant fails', async () => {
    reset({});
    named.getUseMusclogFreeTier = true;
    named.getEnableGoogleGemini = true;
    named.getGoogleGeminiApiKey = 'gemini-key';
    mockGrant.mockResolvedValue({ ok: false, failure: 'unknown_device' });

    const config = await AiService.getAiConfig();
    expect(config).toEqual({
      provider: 'hosted',
      baseUrl: 'https://hosted.example',
      apiKey: '',
      model: 'musclog-hosted',
      language: 'en-US',
      hostedGrantFailure: 'unknown_device',
    });
  });

  it('mints the grant only when the builder runs, not while probing a losing provider', async () => {
    reset({ hosted: false });
    named.getEnableGoogleGemini = true;
    named.getGoogleGeminiApiKey = 'gemini-key';

    await expect(AiService.getAiConfig()).resolves.toMatchObject({ provider: 'gemini' });
    expect(mockGrant).not.toHaveBeenCalled();
  });
});
