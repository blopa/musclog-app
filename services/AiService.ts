import { GoogleAuthService, SettingsService } from '../database/services';
import type { CoachAIConfig } from '../utils/coachAI';
import { getAccessToken } from '../utils/googleAuth';

export class AiService {
  /**
   * Resolves the AI configuration based on user settings and Google Auth state.
   * Priority:
   * 1. Google OAuth (Gemini)
   * 2. Manual Gemini API Key
   * 3. OpenAI API Key
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
      // 1. Priority: Google OAuth access token (user signed in with Google)
      const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
      if (oauthGeminiEnabled) {
        const accessToken = await getAccessToken();
        if (accessToken) {
          return {
            provider: 'gemini',
            accessToken,
            model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
            language: await SettingsService.getLanguage(),
          };
        }
      }

      // 2. Priority: Manual Gemini API key
      const enableGemini = await SettingsService.getEnableGoogleGemini();
      const geminiKey = await SettingsService.getGoogleGeminiApiKey();
      if (enableGemini && geminiKey) {
        return {
          provider: 'gemini',
          apiKey: geminiKey,
          model: (await SettingsService.getGoogleGeminiModel()) || 'gemini-2.5-flash',
          language: await SettingsService.getLanguage(),
        };
      }

      // 3. Priority: OpenAI API key
      const enableOpenAi = await SettingsService.getEnableOpenAi();
      const openAiKey = await SettingsService.getOpenAiApiKey();
      if (enableOpenAi && openAiKey) {
        return {
          provider: 'openai',
          apiKey: openAiKey,
          model: (await SettingsService.getOpenAiModel()) || 'gpt-4o',
          language: await SettingsService.getLanguage(),
        };
      }
    } catch (error) {
      console.error('[AiService] Error resolving AI config:', error);
    }

    return null;
  }
}

export default AiService;
