import { GEMINI_MODELS } from '@/constants/ai';
import { SettingsService } from '@/database/services';
import type { CoachAIConfig } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { isOnDeviceAiAvailable } from '@/utils/onDeviceAi';

export class AiService {
  /**
   * Resolves the AI configuration based on user settings.
   * Priority:
   * 1. On-device AI (when enabled and available)
   * 2. Local LLM
   * 3. Gemini API Key
   * 4. OpenAI API Key
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
      const useOnDeviceAi = await SettingsService.getUseOnDeviceAi();
      if (useOnDeviceAi && (await isOnDeviceAiAvailable())) {
        return {
          provider: 'on-device',
          model: 'on-device',
          language: await SettingsService.getLanguage(),
        };
      }

      const enableLocalLlm = await SettingsService.getEnableLocalLlm();
      const localLlmBaseUrl = (await SettingsService.getLocalLlmBaseUrl()).trim();
      if (enableLocalLlm && localLlmBaseUrl) {
        return {
          provider: 'local',
          apiKey: (await SettingsService.getLocalLlmApiKey()).trim() || 'ollama',
          model: (await SettingsService.getLocalLlmModel()) || 'llama3',
          baseUrl: localLlmBaseUrl,
          language: await SettingsService.getLanguage(),
        };
      }

      const enableGemini = await SettingsService.getEnableGoogleGemini();
      const geminiKey = (await SettingsService.getGoogleGeminiApiKey()).trim();
      if (enableGemini && geminiKey) {
        return {
          provider: 'gemini',
          apiKey: geminiKey,
          model:
            (await SettingsService.getGoogleGeminiModel()) || GEMINI_MODELS.GEMINI_2_5_FLASH.value,
          language: await SettingsService.getLanguage(),
        };
      }

      const enableOpenAi = await SettingsService.getEnableOpenAi();
      const openAiKey = (await SettingsService.getOpenAiApiKey()).trim();
      if (enableOpenAi && openAiKey) {
        return {
          provider: 'openai',
          apiKey: openAiKey,
          model: (await SettingsService.getOpenAiModel()) || 'gpt-4o',
          language: await SettingsService.getLanguage(),
        };
      }
    } catch (error) {
      handleError(error, 'AiService.getAiConfig');
      console.error('[AiService] Error resolving AI config:', error);
    }

    return null;
  }
}

export default AiService;
