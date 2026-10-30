import { SettingsService } from '@/database/services/SettingsService';
import { GatewayService } from '@/services/GatewayService';
import { resolveGeminiModel, resolveOpenAiModel } from '@/utils/aiModels';
import type { CoachAIConfig, CoachAIProvider } from '@/utils/coachAI';
import { handleError } from '@/utils/handleError';
import { effectiveUseMusclogGateway } from '@/utils/musclogGatewayAvailability';
import { isOnDeviceAiAvailable } from '@/utils/onDeviceAi';

/**
 * The Gemini model to use, with a stored model that is no longer supported replaced by the
 * default and saved, so the settings screen shows what is actually being called.
 */
async function currentGeminiModel(): Promise<string> {
  const stored = await SettingsService.getGoogleGeminiModel();
  const model = resolveGeminiModel(stored);
  if (stored && stored !== model) {
    await SettingsService.setGoogleGeminiModel(model).catch((error) =>
      handleError(error, 'currentGeminiModel')
    );
  }

  return model;
}

async function currentOpenAiModel(): Promise<string> {
  const stored = await SettingsService.getOpenAiModel();
  const model = resolveOpenAiModel(stored);
  if (stored && stored !== model) {
    await SettingsService.setOpenAiModel(model).catch((error) =>
      handleError(error, 'currentOpenAiModel')
    );
  }

  return model;
}

async function localConfig(baseUrl: string, language: string): Promise<CoachAIConfig> {
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

async function geminiConfig(apiKey: string, language: string): Promise<CoachAIConfig> {
  return {
    provider: 'gemini',
    apiKey,
    model: await currentGeminiModel(),
    language,
  };
}

async function openAiConfig(apiKey: string, language: string): Promise<CoachAIConfig> {
  return {
    provider: 'openai',
    apiKey,
    model: await currentOpenAiModel(),
    language,
  };
}

/** Builds the config of a provider that was found usable; the language is read once, alongside. */
type ProviderBuilder = (language: string) => Promise<CoachAIConfig>;

/**
 * Per provider: is it usable right now (switched on, with a key, available on this device)? When
 * it is, the answer is how to build its config, so a provider that loses the priority race costs
 * only the reads that decided it, never a config build with its side effects.
 */
const PROVIDER_PROBES: Record<CoachAIProvider, () => Promise<ProviderBuilder | null>> = {
  // On web production builds, CORS blocks browser→Cloudflare direct calls.
  // In development the client uses a CORS proxy (see buildOpenAIClient).
  gateway: async () =>
    effectiveUseMusclogGateway(await SettingsService.getUseMusclogFreeTier())
      ? async (language) => GatewayService.buildGatewayConfig(language)
      : null,
  'on-device': async () =>
    (await SettingsService.getUseOnDeviceAi()) && (await isOnDeviceAiAvailable())
      ? async (language) => ({ provider: 'on-device', model: 'on-device', language })
      : null,
  local: async () => {
    const [enabled, baseUrlRaw] = await Promise.all([
      SettingsService.getEnableLocalLlm(),
      SettingsService.getLocalLlmBaseUrl(),
    ]);
    const baseUrl = baseUrlRaw.trim();

    return enabled && baseUrl ? (language) => localConfig(baseUrl, language) : null;
  },
  gemini: async () => {
    const [enabled, keyRaw] = await Promise.all([
      SettingsService.getEnableGoogleGemini(),
      SettingsService.getGoogleGeminiApiKey(),
    ]);
    const key = keyRaw.trim();

    return enabled && key ? (language) => geminiConfig(key, language) : null;
  },
  openai: async () => {
    const [enabled, keyRaw] = await Promise.all([
      SettingsService.getEnableOpenAi(),
      SettingsService.getOpenAiApiKey(),
    ]);
    const key = keyRaw.trim();

    return enabled && key ? (language) => openAiConfig(key, language) : null;
  },
};

/** Which provider wins when several are usable, first to last. */
const PROVIDER_PRIORITY = [
  'gateway',
  'on-device',
  'local',
  'gemini',
  'openai',
] as const satisfies readonly CoachAIProvider[];

export class AiService {
  /**
   * Resolves the AI configuration based on user settings, from the first usable provider in
   * `PROVIDER_PRIORITY`: the Musclog free-tier gateway (it overrides every other provider when
   * enabled), on-device AI, a local LLM, then a Gemini or an OpenAI key. Every provider is probed in
   * parallel, since the first AI call of a session used to wait for a dozen settings read one
   * after another; the priority only decides which of the answers wins.
   */
  static async getAiConfig(): Promise<CoachAIConfig | null> {
    try {
      const [builders, language] = await Promise.all([
        Promise.all(PROVIDER_PRIORITY.map((provider) => PROVIDER_PROBES[provider]())),
        SettingsService.getLanguage(),
      ]);
      const build = builders.find((candidate) => candidate !== null);

      return build ? await build(language) : null;
    } catch (error) {
      handleError(error, 'AiService.getAiConfig');
      console.error('[AiService] Error resolving AI config:', error);
      return null;
    }
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
      const [build, language] = await Promise.all([
        PROVIDER_PROBES[provider](),
        SettingsService.getLanguage(),
      ]);

      return build ? await build(language) : null;
    } catch (error) {
      handleError(error, 'AiService.getAiConfigForProvider');
      console.error('[AiService] Error resolving AI config for provider:', error);
      return null;
    }
  }
}

export default AiService;
