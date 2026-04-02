import { GEMINI_MODELS, OPENAI_CODEX_CONFIG } from '../constants/ai';
import { GoogleAuthService, SettingsService } from '../database/services';
import type { CoachAIConfig } from '../utils/coachAI';
import { getAccessToken } from '../utils/googleAuth';
import { OpenAiCodexAuthService } from './OpenAiCodexAuthService';

export class AiService {
  /**
   * Resolves the AI configuration based on user settings and Google Auth state.
   * Priority:
   * 1. OpenAI Codex OAuth (User's subscription)
   * 2. Google OAuth (Gemini)
   * 3. Manual Gemini API Key
   * 4. OpenAI API Key
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
      // 1. Priority: OpenAI Codex OAuth (User's personal subscription)
      const codexToken = await OpenAiCodexAuthService.getValidAccessToken();
      if (codexToken) {
        return {
          provider: 'openai',
          accessToken: codexToken,
          model: OPENAI_CODEX_CONFIG.model,
          language: await SettingsService.getLanguage(),
          isCodex: true,
        };
      }

      // 2. Priority: Google OAuth access token (user signed in with Google)
      const oauthGeminiEnabled = await GoogleAuthService.getOAuthGeminiEnabled();
      if (oauthGeminiEnabled) {
        const accessToken = await getAccessToken();
        if (accessToken) {
          return {
            provider: 'gemini',
            accessToken,
            model:
              (await SettingsService.getGoogleGeminiModel()) ||
              GEMINI_MODELS.GEMINI_2_5_FLASH.value,
            language: await SettingsService.getLanguage(),
          };
        }
      }

      // 2. Priority: Manual Gemini API key
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

      // 3. Priority: OpenAI API key
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
      console.error('[AiService] Error resolving AI config:', error);
    }

    return null;
  }
}

export default AiService;
