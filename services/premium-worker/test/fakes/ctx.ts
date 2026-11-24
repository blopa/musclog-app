// Shared test helpers: the test env's config with overrides, deterministic deps and a Ctx.
import { createExecutionContext, env } from 'cloudflare:test';

import type { AiConfig } from '../../src/config';
import type { Ctx } from '../../src/context';
import type { Deps } from '../../src/deps';
import type { LogEvent } from '../../src/log';
import type { OpenRouterClient, OtariClient, RevenueCatClient } from '../../src/upstream/types';

export const NOW = 1_800_000_000_000; // 2027-01-15T08:00:00.000Z
export const DAY_MS = 86_400_000;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K];
};

function merge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    const b = out[k];
    out[k] =
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      b &&
      typeof b === 'object' &&
      !Array.isArray(b)
        ? merge(b, v as DeepPartial<typeof b>)
        : v;
  }
  return out as T;
}

/** The [env.test] AI_CONFIG_JSON from wrangler.toml, deep-merged with overrides. */
export function testConfig(over?: DeepPartial<AiConfig>): AiConfig {
  return merge(JSON.parse(env.AI_CONFIG_JSON) as AiConfig, over);
}

const unexpected = (name: string) => () => {
  throw new Error(`unexpected upstream call: ${name}`);
};

export const throwingRevenueCat: RevenueCatClient = {
  listCustomerSubscriptions: unexpected('revenuecat.listCustomerSubscriptions'),
  getSubscription: unexpected('revenuecat.getSubscription'),
  listTransactions: unexpected('revenuecat.listTransactions'),
};

export const throwingOpenRouter: OpenRouterClient = {
  chatCompletions: unexpected('openrouter.chatCompletions'),
  getGeneration: unexpected('openrouter.getGeneration'),
  getKey: unexpected('openrouter.getKey'),
  listZdrEndpoints: unexpected('openrouter.listZdrEndpoints'),
};

export const throwingOtari: OtariClient = {
  chatCompletions: unexpected('otari.chatCompletions'),
  usageSummary: unexpected('otari.usageSummary'),
  budget: unexpected('otari.budget'),
};

export interface TestDeps extends Deps {
  logs: LogEvent[];
  /** Moves the fake clock. */
  advance(ms: number): void;
  sleeps: number[];
}

/** Fixed clock at NOW, counter-based randomHex, instant sleep, captured logs. */
export function testDeps(over: Partial<Deps> = {}): TestDeps {
  let t = NOW;
  let n = 0;
  const logs: LogEvent[] = [];
  const sleeps: number[] = [];
  const d: TestDeps = {
    revenuecat: throwingRevenueCat,
    openrouter: throwingOpenRouter,
    otari: null,
    log: { log: (e) => logs.push(e) },
    now: () => t,
    randomHex: () => (++n).toString(16).padStart(32, '0'),
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    logs,
    sleeps,
    advance: (ms) => {
      t += ms;
    },
    ...over,
  };
  return d;
}

export function makeCtx(
  o: { config?: AiConfig; deps?: Deps; env?: Partial<typeof env> } = {}
): Ctx {
  return {
    env: { ...env, ...o.env },
    config: o.config ?? testConfig(),
    deps: o.deps ?? testDeps(),
    exec: createExecutionContext(),
  };
}
