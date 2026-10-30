import { SettingsService } from '@/database/services/SettingsService';
import { enableFreeTier, testAndSaveApiKey } from '@/services/aiProviderSetup';
import { testApiKey } from '@/utils/aiKeyTest';

jest.mock('@/utils/aiKeyTest', () => ({ testApiKey: jest.fn() }));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    setGoogleGeminiApiKey: jest.fn(),
    setEnableGoogleGemini: jest.fn(),
    setOpenAiApiKey: jest.fn(),
    setEnableOpenAi: jest.fn(),
    setUseMusclogFreeTier: jest.fn(),
  },
}));

const mockTest = testApiKey as jest.Mock;

beforeEach(() => jest.clearAllMocks());

describe('testAndSaveApiKey', () => {
  it('saves and enables a Gemini key the provider accepted, trimmed', async () => {
    mockTest.mockResolvedValue('ok');

    await expect(testAndSaveApiKey('gemini', '  AIza-key  ')).resolves.toBe('ok');

    expect(mockTest).toHaveBeenCalledWith('gemini', 'AIza-key');
    expect(SettingsService.setGoogleGeminiApiKey).toHaveBeenCalledWith('AIza-key');
    expect(SettingsService.setEnableGoogleGemini).toHaveBeenCalledWith(true);
    expect(SettingsService.setOpenAiApiKey).not.toHaveBeenCalled();
  });

  it('saves and enables an OpenAI key the provider accepted', async () => {
    mockTest.mockResolvedValue('ok');

    await testAndSaveApiKey('openai', 'sk-key');

    expect(SettingsService.setOpenAiApiKey).toHaveBeenCalledWith('sk-key');
    expect(SettingsService.setEnableOpenAi).toHaveBeenCalledWith(true);
    expect(SettingsService.setGoogleGeminiApiKey).not.toHaveBeenCalled();
  });

  it.each(['rejected', 'network'] as const)(
    'saves nothing when the check says %s',
    async (result) => {
      mockTest.mockResolvedValue(result);

      await expect(testAndSaveApiKey('openai', 'sk-key')).resolves.toBe(result);

      for (const setter of Object.values(SettingsService)) {
        expect(setter).not.toHaveBeenCalled();
      }
    }
  );

  it('does not save an empty key', async () => {
    mockTest.mockResolvedValue('rejected');

    await expect(testAndSaveApiKey('gemini', '   ')).resolves.toBe('rejected');
    expect(SettingsService.setGoogleGeminiApiKey).not.toHaveBeenCalled();
  });
});

describe('enableFreeTier', () => {
  it('turns the free tier on', async () => {
    await enableFreeTier();

    expect(SettingsService.setUseMusclogFreeTier).toHaveBeenCalledWith(true);
  });
});
