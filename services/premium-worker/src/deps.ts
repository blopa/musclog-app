import { consoleLogger, type Logger } from './log';
import { sentryLogger } from './logReport';
import type { Env } from './env';
import type { OpenRouterClient, OtariClient, RevenueCatClient } from './upstream/types';
import { createOpenRouterClient } from './upstream/openrouter';
import { createOtariClient } from './upstream/otari';
import { createRevenueCatClient } from './upstream/revenuecat';
import type { AiConfig } from './config';
import { hex } from './identity/crypto';

/** Everything with side effects outside D1. Tests pass fakes through createApp. */
export interface Deps {
  revenuecat: RevenueCatClient;
  openrouter: OpenRouterClient;
  /** Built only when OTARI_API_KEY is set; null otherwise (the toggle then means OpenRouter). */
  otari: OtariClient | null;
  log: Logger;
  now(): number;
  /** 32 hex chars of CSPRNG output (hold tokens, nonce randomness). */
  randomHex(): string;
  sleep(ms: number): Promise<void>;
}

export function randomHex(bytes = 16): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

export function defaultDeps(env: Env, config: AiConfig): Deps {
  return {
    revenuecat: createRevenueCatClient({
      baseUrl: env.REVENUECAT_BASE_URL,
      apiKey: env.REVENUECAT_V2_SECRET_KEY,
      projectId: config.revenuecat.project_id,
    }),
    openrouter: createOpenRouterClient({
      baseUrl: env.OPENROUTER_BASE_URL,
      apiKey: env.OPENROUTER_API_KEY,
    }),
    otari: env.OTARI_API_KEY
      ? createOtariClient({ baseUrl: env.OTARI_BASE_URL, apiKey: env.OTARI_API_KEY })
      : null,
    log: sentryLogger(consoleLogger(0.1)),
    now: () => Date.now(),
    randomHex: () => randomHex(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

export type MakeDeps = (env: Env, config: AiConfig) => Deps;
