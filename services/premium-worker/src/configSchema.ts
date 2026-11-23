// Validation of AI_CONFIG_JSON (plan section 7). Fail closed: any problem returns
// `{ ok: false, errors }` and the Worker refuses to serve. Never throws; errors name the field
// path and the reason, never the offending value.
import { z } from 'zod';

import {
  OFFICIAL_OPENROUTER_BASE_URL,
  OFFICIAL_REVENUECAT_BASE_URL,
  type AiConfig,
  type ConfigResult,
} from './config';
import type { Env } from './env';

const num = z.number().finite();
const int = z.number().int();
const nonEmpty = z.string().min(1);

const feature = z
  .object({
    max_tokens: int.min(1).max(32000),
    temperature_max: num.min(0).max(2),
    reasoning: z.enum(['low', 'medium', 'high']).nullable(),
    reasoning_max: z.enum(['low', 'medium', 'high']).nullable().optional(),
  })
  .strict();

const uniqueStrings = (arr: string[]) => new Set(arr).size === arr.length;

const schema = z
  .object({
    version: z.literal(1),
    model: z
      .string()
      .regex(/^[a-z0-9._-]+\/[a-z0-9._:-]+$/i, 'invalid model id')
      .refine((m) => !m.toLowerCase().startsWith('google/'), 'google/ models are excluded (ZDR)'),
    prices: z
      .object({
        prompt_per_mtok: num.min(0),
        completion_per_mtok: num.min(0),
        image_per_image: num.min(0),
        request_fee_u: int.min(0),
      })
      .strict(),
    provider: z
      .object({
        zdr: z.literal(true),
        data_collection: z.literal('deny'),
        require_parameters: z.literal(true),
        allow_fallbacks: z.literal(false),
        only: z.array(nonEmpty).min(1).optional(),
      })
      .strict(),
    features: z.object({ chat: feature, structured: feature, vision: feature }).strict(),
    vision_enabled: z.boolean(),
    image: z
      .object({
        max_px: int.min(64).max(4096),
        max_bytes: int.min(1).max(524288),
        quality: int.min(1).max(100),
        max_images: int.min(0).max(8),
        tokens_max: int.min(0),
      })
      .strict(),
    finance: z
      .object({
        spend_share: num.gt(0).max(0.5),
        estimate_haircut: num.min(0).lt(1),
        fx_haircut: num.min(0).lt(1),
        rc_fee_rate: num.min(0).lt(1),
        rc_fee_vat_factor: num.min(1),
        infra_per_period_u: int.min(0),
        openrouter_fee: num.min(1.055),
        early_share: num.gt(0).max(1),
        early_days: int.min(0).max(31),
        daily_share: num.gt(0).max(1),
        max_cap_u: int.gt(0),
        global_share: num.gt(0).lt(1),
        price_slack: num.min(1),
      })
      .strict()
      .refine((f) => f.global_share >= f.spend_share, {
        path: ['global_share'],
        message: 'must be >= spend_share',
      }),
    limits: z
      .object({
        max_requests_per_day: int.min(1),
        max_inflight: int.min(1).max(10),
        global_max_requests_per_day: int.min(1),
        max_subscribers: int.min(1),
        max_devices: int.min(1).max(50),
        body_max_bytes: int.min(1).max(1048576),
        max_messages: int.min(1).max(256),
        max_tools: int.min(0).max(128),
        max_stop: int.min(0).max(16),
        response_format_max_bytes: int.min(1).max(262144),
      })
      .strict(),
    revenuecat: z
      .object({
        project_id: nonEmpty,
        product_ids: z.array(nonEmpty).refine(uniqueStrings, 'must be unique'),
        environments: z
          .array(z.enum(['production', 'sandbox']))
          .min(1)
          .refine(uniqueStrings, 'must be unique'),
        grace_ms: z
          .object({
            app_store: int.min(0).max(2592000000),
            play_store: int.min(0).max(2592000000),
          })
          .strict(),
      })
      .strict(),
    reconciliation: z
      .object({ tolerance_share: num.min(0).lt(1), tolerance_u: int.min(0) })
      .strict(),
    breaker: z.object({ overruns_24h: int.min(1) }).strict(),
    min_app_version: z.string().regex(/^\d+\.\d+\.\d+$/),
  })
  .strict();

// Compile-time: the schema accepts exactly the AiConfig shape.
type Inferred = z.infer<typeof schema>;
const _assignable = (x: Inferred): AiConfig => x;
const _exact = (x: AiConfig): Inferred => x;
void _assignable;
void _exact;

const ENVIRONMENTS = ['production', 'staging', 'local', 'test'];

/** A RevenueCat product id as API v2 reports it on a subscription (`prod` + its own suffix). */
const REVENUECAT_PRODUCT_ID = /^prod[A-Za-z0-9_]+$/;

const isUrl = (s: string) => {
  try {
    new URL(s);
    return true;
  } catch {
    return false;
  }
};

export function parseConfig(
  env: Pick<Env, 'AI_CONFIG_JSON' | 'WORKER_ENV' | 'OPENROUTER_BASE_URL' | 'REVENUECAT_BASE_URL'>
): ConfigResult {
  const errors: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(env.AI_CONFIG_JSON);
  } catch {
    return { ok: false, errors: ['AI_CONFIG_JSON: not valid JSON'] };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      const keys =
        issue.code === 'unrecognized_keys'
          ? ` (${(issue as { keys: string[] }).keys.join(', ')})`
          : '';
      errors.push(
        `${path}: ${issue.code === 'unrecognized_keys' ? 'unknown key' : issue.message}${keys}`
      );
    }
  }

  const workerEnv = String(env.WORKER_ENV);
  if (!ENVIRONMENTS.includes(workerEnv))
    errors.push('WORKER_ENV: must be one of ' + ENVIRONMENTS.join(', '));

  if (parsed.success) {
    const c = parsed.data;
    if (c.vision_enabled && c.image.tokens_max <= 0) {
      errors.push('image.tokens_max: must be > 0 when vision_enabled');
    }
    if (c.vision_enabled && c.image.max_images < 1) {
      errors.push('image.max_images: must be >= 1 when vision_enabled');
    }
    if (workerEnv === 'production') {
      const e = c.revenuecat.environments;
      // Production accepts real purchases only: a sandbox (test) purchase never unlocks the
      // production Worker. Sandbox testing goes through the staging Worker.
      if (e.length !== 1 || e[0] !== 'production') {
        errors.push("revenuecat.environments: must be exactly ['production'] in production");
      }
      if (c.revenuecat.product_ids.length === 0) {
        errors.push('revenuecat.product_ids: must be non-empty in production');
      }
    }
    // RevenueCat v2 reports a subscription's `product_id` as its OWN id (`prod…`), never the store
    // identifier (`musclog_premium_monthly`, `…:monthly`). A store identifier here matches no
    // subscription, so every paid enroll fails with subscription_required: refuse it on cold start.
    if (workerEnv === 'production' || workerEnv === 'staging') {
      const notRcIds = c.revenuecat.product_ids.filter((id) => !REVENUECAT_PRODUCT_ID.test(id));
      if (notRcIds.length > 0) {
        errors.push(
          'revenuecat.product_ids: must be RevenueCat product ids (prod…), not store identifiers: ' +
            notRcIds.join(', ')
        );
      }
    }
  }

  if (workerEnv === 'production' || workerEnv === 'staging') {
    if (env.OPENROUTER_BASE_URL !== OFFICIAL_OPENROUTER_BASE_URL) {
      errors.push('OPENROUTER_BASE_URL: must be the official URL in ' + workerEnv);
    }
    if (env.REVENUECAT_BASE_URL !== OFFICIAL_REVENUECAT_BASE_URL) {
      errors.push('REVENUECAT_BASE_URL: must be the official URL in ' + workerEnv);
    }
  } else if (ENVIRONMENTS.includes(workerEnv)) {
    if (!isUrl(env.OPENROUTER_BASE_URL)) errors.push('OPENROUTER_BASE_URL: not a valid URL');
    if (!isUrl(env.REVENUECAT_BASE_URL)) errors.push('REVENUECAT_BASE_URL: not a valid URL');
  }

  if (errors.length > 0 || !parsed.success) return { ok: false, errors };
  return { ok: true, config: parsed.data };
}
