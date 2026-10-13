import AiService from '../AiService';

const mockSettings: Record<string, jest.Mock> = {};
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: new Proxy({}, { get: (_t, name: string) => mockSettings[name] }),
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

function setSettings(values: Record<string, unknown>) {
  const defaults: Record<string, unknown> = {
    getUseMusclogFreeTier: false,
    getUseOnDeviceAi: false,
    getEnableLocalLlm: false,
    getLocalLlmBaseUrl: '',
    getLocalLlmApiKey: '',
    getLocalLlmModel: '',
    getEnableGoogleGemini: false,
    getGoogleGeminiApiKey: '',
    getGoogleGeminiModel: '',
    getEnableOpenAi: false,
    getOpenAiApiKey: '',
    getOpenAiModel: '',
    getLanguage: 'en-US',
    ...values,
  };
  for (const [name, value] of Object.entries(defaults)) {
    mockSettings[name] = jest.fn().mockResolvedValue(value);
  }
}

describe('AiService.getAiConfig', () => {
  it('prefers the gateway over every other provider', async () => {
    setSettings({
      getUseMusclogFreeTier: true,
      getEnableGoogleGemini: true,
      getGoogleGeminiApiKey: 'g',
    });
    await expect(AiService.getAiConfig()).resolves.toMatchObject({ provider: 'gateway' });
  });

  it('then on-device, then local, then Gemini, then OpenAI', async () => {
    setSettings({
      getUseOnDeviceAi: true,
      getEnableGoogleGemini: true,
      getGoogleGeminiApiKey: 'g',
    });
    await expect(AiService.getAiConfig()).resolves.toMatchObject({ provider: 'on-device' });

    setSettings({
      getEnableLocalLlm: true,
      getLocalLlmBaseUrl: ' http://x ',
      getEnableGoogleGemini: true,
      getGoogleGeminiApiKey: 'g',
    });
    await expect(AiService.getAiConfig()).resolves.toMatchObject({
      provider: 'local',
      baseUrl: 'http://x',
      apiKey: 'ollama',
      model: 'llama3',
    });

    setSettings({
      getEnableGoogleGemini: true,
      getGoogleGeminiApiKey: ' g ',
      getEnableOpenAi: true,
      getOpenAiApiKey: 'o',
    });
    await expect(AiService.getAiConfig()).resolves.toMatchObject({
      provider: 'gemini',
      apiKey: 'g',
    });

    setSettings({ getEnableOpenAi: true, getOpenAiApiKey: 'o' });
    await expect(AiService.getAiConfig()).resolves.toMatchObject({
      provider: 'openai',
      apiKey: 'o',
      model: 'gpt-4o',
    });
  });

  it('is null when nothing is enabled with a key', async () => {
    setSettings({ getEnableGoogleGemini: true, getGoogleGeminiApiKey: '   ' });
    await expect(AiService.getAiConfig()).resolves.toBeNull();
  });

  it('reads the settings in parallel: none waits for another to finish', async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    setSettings({});
    mockSettings.getUseMusclogFreeTier = jest.fn(async () => {
      order.push('start-gateway');
      await gate;
      order.push('end-gateway');
      return false;
    });
    mockSettings.getLanguage = jest.fn(async () => {
      order.push('start-language');
      return 'en-US';
    });

    const pending = AiService.getAiConfig();
    await Promise.resolve();
    // The language read started while the gateway read was still outstanding.
    expect(order).toEqual(['start-gateway', 'start-language']);
    release();
    await pending;
  });

  it('returns null instead of throwing when a read fails', async () => {
    setSettings({});
    mockSettings.getUseOnDeviceAi = jest.fn().mockRejectedValue(new Error('db down'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(AiService.getAiConfig()).resolves.toBeNull();
  });
});
