import { consoleLogger, type Logger } from './log';
import type { Env } from './env';
import type { OpenRouterClient, RevenueCatClient } from './upstream/types';
import { createOpenRouterClient } from './upstream/openrouter';
import { createRevenueCatClient } from './upstream/revenuecat';
import type { AiConfig } from './config';

/** Everything with side effects outside D1. Tests pass fakes through createApp. */
export interface Deps {
  revenuecat: RevenueCatClient;
  openrouter: OpenRouterClient;
  log: Logger;
  now(): number;
  /** 32 hex chars of CSPRNG output (hold tokens, nonce randomness). */
  randomHex(): string;
  sleep(ms: number): Promise<void>;
}

export function randomHex(bytes = 16): string {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
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
    log: consoleLogger(0.1),
    now: () => Date.now(),
    randomHex: () => randomHex(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

export type MakeDeps = (env: Env, config: AiConfig) => Deps;
