import { SettingsService } from '@/database/services/SettingsService';
import { type AiKeyTestResult, testApiKey } from '@/utils/aiKeyTest';

export type AiKeyProvider = 'gemini' | 'openai';

/**
 * Saves an API key typed during AI setup, but only once the provider has accepted it. The key goes
 * through the same encrypted setters as Settings → AI, and the provider is switched on so the app
 * can use it afterwards. A key that is rejected, or that could not be checked, is not saved, so a
 * working key already stored is never replaced by one that does not work.
 *
 * Nothing here logs, returns or otherwise exposes the key.
 */
export async function testAndSaveApiKey(
  provider: AiKeyProvider,
  apiKey: string
): Promise<AiKeyTestResult> {
  const key = apiKey.trim();
  const result = await testApiKey(provider, key);
  if (result !== 'ok') {
    return result;
  }

  if (provider === 'gemini') {
    await SettingsService.setGoogleGeminiApiKey(key);
    await SettingsService.setEnableGoogleGemini(true);
  } else {
    await SettingsService.setOpenAiApiKey(key);
    await SettingsService.setEnableOpenAi(true);
  }

  return 'ok';
}

/** Choosing free AI in the setup is the same opt-in the later "Musclog AI" step offers. */
export async function enableFreeTier(): Promise<void> {
  await SettingsService.setUseMusclogFreeTier(true);
}
