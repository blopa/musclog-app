import { SettingsService } from '@/database/services/SettingsService';
import { GatewayService } from '@/services/GatewayService';
import { resolveGeminiModel, resolveOpenAiModel } from '@/utils/aiModels';
import type { CoachAIConfig, CoachAIProvider } from '@/utils/coachAI';
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
        return await AiService.localConfig(localLlmBaseUrl, language);
      }

      const geminiKey = geminiKeyRaw.trim();
      if (enableGemini && geminiKey) {
        return await AiService.geminiConfig(geminiKey, language);
      }

      const openAiKey = openAiKeyRaw.trim();
      if (enableOpenAi && openAiKey) {
        return await AiService.openAiConfig(openAiKey, language);
      }
    } catch (error) {
      handleError(error, 'AiService.getAiConfig');
      console.error('[AiService] Error resolving AI config:', error);
    }

    return null;
  }

  /**
   * The configuration for ONE named provider, ignoring the priority order above. `getAiConfig`
   * answers "which provider does the app use"; this answers "is this particular provider ready",
   * which the setup chat needs: someone who just saved a Gemini key must talk to Gemini even while
   * the free tier or a local model would win the priority order. Null when that provider is not
   * usable (disabled, no key, unavailable on this device or platform).
   */
  static async getAiConfigForProvider(provider: CoachAIProvider): Promise<CoachAIConfig | null> {
    try {
      const language = await SettingsService.getLanguage();
      switch (provider) {
        case 'gateway':
          return effectiveUseMusclogGateway(await SettingsService.getUseMusclogFreeTier())
            ? GatewayService.buildGatewayConfig(language)
            : null;
        case 'on-device':
          return (await SettingsService.getUseOnDeviceAi()) && (await isOnDeviceAiAvailable())
            ? { provider: 'on-device', model: 'on-device', language }
            : null;
        case 'local': {
          const baseUrl = (await SettingsService.getLocalLlmBaseUrl()).trim();
          return (await SettingsService.getEnableLocalLlm()) && baseUrl
            ? await AiService.localConfig(baseUrl, language)
            : null;
        }
        case 'gemini': {
          const key = (await SettingsService.getGoogleGeminiApiKey()).trim();
          return (await SettingsService.getEnableGoogleGemini()) && key
            ? await AiService.geminiConfig(key, language)
            : null;
        }
        case 'openai': {
          const key = (await SettingsService.getOpenAiApiKey()).trim();
          return (await SettingsService.getEnableOpenAi()) && key
            ? await AiService.openAiConfig(key, language)
            : null;
        }
      }
    } catch (error) {
      handleError(error, 'AiService.getAiConfigForProvider');
      console.error('[AiService] Error resolving AI config for provider:', error);
      return null;
    }
  }

  private static async localConfig(baseUrl: string, language: string): Promise<CoachAIConfig> {
    const [localKey, localModel] = await Promise.all([
      SettingsService.getLocalLlmApiKey(),
      SettingsService.getLocalLlmModel(),
    ]);
    return {
      provider: 'local',
      apiKey: localKey.trim() || 'ollama',
      model: localModel || 'llama3',
      baseUrl,
      language,
    };
  }

  private static async geminiConfig(apiKey: string, language: string): Promise<CoachAIConfig> {
    return {
      provider: 'gemini',
      apiKey,
      model: await AiService.currentGeminiModel(),
      language,
    };
  }

  private static async openAiConfig(apiKey: string, language: string): Promise<CoachAIConfig> {
    return {
      provider: 'openai',
      apiKey,
      model: await AiService.currentOpenAiModel(),
      language,
    };
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
