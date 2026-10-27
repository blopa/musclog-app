import { SettingsService } from '@/database/services/SettingsService';
import { GatewayService } from '@/services/GatewayService';
import { resolveGeminiModel, resolveOpenAiModel } from '@/utils/aiModels';
import type { CoachAIConfig } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { effectiveUseMusclogGateway } from '@/utils/musclogGatewayAvailability';
import { isOnDeviceAiAvailable } from '@/utils/onDeviceAi';

export class AiService {
  /**
   * Resolves the AI configuration based on user settings.
   * Priority:
   * 0. Musclog Free Tier Gateway (overrides all other providers when enabled)
   * 1. On-device AI (when enabled and available)
   * 2. Local LLM
   * 3. Gemini API Key
   * 4. OpenAI API Key
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
      // Every setting is read in parallel: they used to be awaited one after another, so the first
      // AI call of a session paid for up to twelve sequential reads before it could even start.
      // The priority below is unchanged — it only decides which of the already-read values wins.
      const [
        useGateway,
        useOnDeviceAi,
        enableLocalLlm,
        localLlmBaseUrlRaw,
        enableGemini,
        geminiKeyRaw,
        enableOpenAi,
        openAiKeyRaw,
        language,
      ] = await Promise.all([
        SettingsService.getUseMusclogFreeTier(),
        SettingsService.getUseOnDeviceAi(),
        SettingsService.getEnableLocalLlm(),
        SettingsService.getLocalLlmBaseUrl(),
        SettingsService.getEnableGoogleGemini(),
        SettingsService.getGoogleGeminiApiKey(),
        SettingsService.getEnableOpenAi(),
        SettingsService.getOpenAiApiKey(),
        SettingsService.getLanguage(),
      ]);

      // On web production builds, CORS blocks browser→Cloudflare direct calls.
      // In development the client uses a CORS proxy (see buildOpenAIClient).
      if (effectiveUseMusclogGateway(useGateway)) {
        return GatewayService.buildGatewayConfig(language);
      }

      if (useOnDeviceAi && (await isOnDeviceAiAvailable())) {
        return { provider: 'on-device', model: 'on-device', language };
      }

      const localLlmBaseUrl = localLlmBaseUrlRaw.trim();
      if (enableLocalLlm && localLlmBaseUrl) {
        const [localKey, localModel] = await Promise.all([
          SettingsService.getLocalLlmApiKey(),
          SettingsService.getLocalLlmModel(),
        ]);
        return {
          provider: 'local',
          apiKey: localKey.trim() || 'ollama',
          model: localModel || 'llama3',
          baseUrl: localLlmBaseUrl,
          language,
        };
      }

      const geminiKey = geminiKeyRaw.trim();
      if (enableGemini && geminiKey) {
        return {
          provider: 'gemini',
          apiKey: geminiKey,
          model: await AiService.currentGeminiModel(),
          language,
        };
      }

      const openAiKey = openAiKeyRaw.trim();
      if (enableOpenAi && openAiKey) {
        return {
          provider: 'openai',
          apiKey: openAiKey,
          model: await AiService.currentOpenAiModel(),
          language,
        };
      }
    } catch (error) {
      handleError(error, 'AiService.getAiConfig');
      console.error('[AiService] Error resolving AI config:', error);
    }

    return null;
  }

  /**
   * The Gemini model to use, with a stored model that is no longer supported replaced by the
   * default and saved, so the settings screen shows what is actually being called.
   */
  private static async currentGeminiModel(): Promise<string> {
    const stored = await SettingsService.getGoogleGeminiModel();
    const model = resolveGeminiModel(stored);
    if (stored && stored !== model) {
      await SettingsService.setGoogleGeminiModel(model).catch((error) =>
        handleError(error, 'AiService.currentGeminiModel')
      );
    }

    return model;
  }

  private static async currentOpenAiModel(): Promise<string> {
    const stored = await SettingsService.getOpenAiModel();
    const model = resolveOpenAiModel(stored);
    if (stored && stored !== model) {
      await SettingsService.setOpenAiModel(model).catch((error) =>
        handleError(error, 'AiService.currentOpenAiModel')
      );
    }

    return model;
  }
}

export default AiService;
