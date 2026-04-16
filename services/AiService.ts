import { GEMINI_MODELS } from '@/constants/ai';
import { SettingsService } from '@/database/services';
import type { CoachAIConfig } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';

export class AiService {
  /**
   * Resolves the AI configuration based on user settings.
   * Priority:
   * 1. Manual Gemini API Key
   * 2. OpenAI API Key
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
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
