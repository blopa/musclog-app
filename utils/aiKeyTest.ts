import OpenAI from 'openai';

import { GEMINI_MODELS } from '@/constants/ai';

import { isInvalidApiKeyError } from './aiErrors';
import { configureBasicGenAI } from './gemini';

export type AiKeyTestResult = 'ok' | 'rejected' | 'network';

/** How long a key test may take. A bad connection should say so, not spin. */
const KEY_TEST_TIMEOUT_MS = 15_000;

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Request timed out')), KEY_TEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks a key with the cheapest request each provider offers, so a typo is caught while the user is
 * still on the settings screen instead of on their first scan. It tests the key as typed, saved or
 * not. "rejected" means the provider said no; anything else that failed (offline, DNS, a timeout) is
 * "network" — the key may be fine, and saying it was rejected would send the user to retype it.
 */
export async function testApiKey(
  provider: 'gemini' | 'openai',
  apiKey: string,
  model?: string
): Promise<AiKeyTestResult> {
  const key = apiKey.trim();
  if (!key) {
    return 'rejected';
  }

  try {
    if (provider === 'gemini') {
      const client = await configureBasicGenAI({
        apiKey: key,
        model: model || GEMINI_MODELS.GEMINI_2_5_FLASH.model,
        generationConfig: { maxOutputTokens: 1 },
      });
      await withTimeout(
        client.generateContent({ contents: [{ role: 'user', parts: [{ text: 'ping' }] }] })
      );
    } else {
      const client = new OpenAI({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 0 });
      await withTimeout(client.models.list());
    }

    return 'ok';
  } catch (error) {
    return isInvalidApiKeyError(error) ? 'rejected' : 'network';
  }
}
