// AI_CONFIG_JSON: the plain-text Worker variable that holds everything changeable without a
// code deploy (plan section 7). It is validated on every cold start; an invalid config makes
// the Worker refuse to serve (fail closed). The shape below is the single definition: the zod
// schema in `parseConfig` must accept exactly this type and nothing more (unknown keys are
// rejected, not ignored).

export type WorkerEnvironment = 'production' | 'staging' | 'local' | 'test';
export type Store = 'app_store' | 'play_store';
export type RcEnvironment = 'production' | 'sandbox';
export type Feature = 'chat' | 'structured' | 'vision';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface FeatureLimits {
  /** Clamp for the client's `max_tokens` (reasoning tokens count inside it). */
  max_tokens: number;
  /** Upper bound for `temperature`; the client value is clamped to [0, temperature_max]. */
  temperature_max: number;
  /** `reasoning.effort` forced on the upstream body, or null to send no `reasoning`. */
  reasoning: ReasoningEffort | null;
}

export interface AiConfig {
  version: 1;
  /** OpenRouter model id; the client never chooses it. */
  model: string;
  /**
   * Pinned prices. USD per 1M tokens equals micro-USD per token, so these are used directly
   * as micro-USD per token in the reservation bound. `image_per_image` is USD per image.
   */
  prices: {
    prompt_per_mtok: number;
    completion_per_mtok: number;
    image_per_image: number;
    /** Flat per-request fee in micro-USD added to every reservation bound. */
    request_fee_u: number;
  };
  /**
   * Forced on every upstream body as `provider`. The four literal fields are the privacy
   * invariant (plan section 7) and the validator rejects any other value. `only` optionally
   * pins provider tags (the jurisdiction decision); the ZDR re-check honours it.
   */
  provider: {
    zdr: true;
    data_collection: 'deny';
    require_parameters: true;
    allow_fallbacks: false;
    only?: string[];
  };
  features: Record<Feature, FeatureLimits>;
  /**
   * Photos through Musclog Iron. On requires `image.tokens_max` > 0. It is on since 2026-11-23 with an
   * estimated `tokens_max`; the measured value is the pending G6 benchmark (`docs/PHOTO_BENCHMARK.md`).
   */
  vision_enabled: boolean;
  image: {
    max_px: number;
    max_bytes: number;
    quality: number;
    max_images: number;
    /**
   * IMAGE_TOKENS_MAX (plan 8.2 step 1): the worst case, in tokens, one image can add to a request,
   * used only to bound the reservation. Must be > 0 when vision_enabled.
   */
    tokens_max: number;
  };
  /** Plan 8.1. The schema CHECK hard-codes 500 and 1055, so spend_share <= 0.5 and openrouter_fee >= 1.055. */
  finance: {
    spend_share: number;
    estimate_haircut: number;
    fx_haircut: number;
    rc_fee_rate: number;
    rc_fee_vat_factor: number;
    infra_per_period_u: number;
    openrouter_fee: number;
    early_share: number;
    early_days: number;
    daily_share: number;
    max_cap_u: number;
    global_share: number;
    price_slack: number;
  };
  limits: {
    max_requests_per_day: number;
    max_inflight: number;
    global_max_requests_per_day: number;
    max_subscribers: number;
    max_devices: number;
    body_max_bytes: number;
    max_messages: number;
    max_tools: number;
    max_stop: number;
    response_format_max_bytes: number;
  };
  revenuecat: {
    project_id: string;
    /** RevenueCat v2 `product_id`s that qualify. */
    product_ids: string[];
    /** Production must be exactly ['production']; sandbox is accepted only off production. */
    environments: RcEnvironment[];
    /**
     * Billing grace added to a transaction's expiration_date to form period_end. 0 until G2
     * shows how grace appears in RevenueCat v2. Values above 1 h need the duplicate-period
     * guard to truncate the previous period on renewal first (plan 6.2, open).
     */
    grace_ms: Record<Store, number>;
  };
  reconciliation: {
    /** A gap above tolerance_share × ledger + tolerance_u (micro-USD) opens the breaker. */
    tolerance_share: number;
    tolerance_u: number;
  };
  breaker: {
    /** Overruns within 24 h that open the breaker. */
    overruns_24h: number;
  };
  min_app_version: string;
}

export const SCHEMA_SPEND_SHARE_PERMILLE = 500; // CHECK (cap_u * 1055 <= net_proceeds_u * 500)
export const SCHEMA_OPENROUTER_FEE_PERMILLE = 1055;

export const OFFICIAL_OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const OFFICIAL_REVENUECAT_BASE_URL = 'https://api.revenuecat.com/v2';

export type ConfigResult = { ok: true; config: AiConfig } | { ok: false; errors: string[] };
