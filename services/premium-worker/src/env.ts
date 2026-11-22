// Bindings and variables of the Worker. Secrets (marked) are set with `wrangler secret put`
// only and never appear in wrangler.toml, Terraform config or state (plan section 5).
export interface Env {
  DB: D1Database;
  /** 'production' | 'staging' | 'local' | 'test'. Production tightens config validation. */
  WORKER_ENV: string;
  /** Kill switch: anything but 'true' disables hosted AI (503 hosted_disabled). */
  HOSTED_AI_ENABLED: string;
  /** See src/config.ts. */
  AI_CONFIG_JSON: string;
  /** Upstream base URLs. Production must use the official ones; local may point at mocks. */
  OPENROUTER_BASE_URL: string;
  REVENUECAT_BASE_URL: string;
  /** Secret. OpenRouter inference key (dedicated, limited, prepaid). */
  OPENROUTER_API_KEY: string;
  /** Secret. RevenueCat v2 key with only customer_information:subscriptions:read and customers:read. */
  REVENUECAT_V2_SECRET_KEY: string;
  /** Secret. HMAC key for nonces and session tokens (at least 32 bytes). */
  SESSION_HMAC_KEY: string;
  /** Secret, optional. The previous HMAC key, accepted for verification only during rotation. */
  SESSION_HMAC_KEY_PREVIOUS?: string;
  /** Sentry DSN (not a secret). Unset in local and test: the SDK stays off. See src/sentry.ts. */
  SENTRY_DSN?: string;
  /** Rate-limit binding (wrangler.toml `ratelimits`). Required in production and staging (src/limiter.ts); optional in local and test. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}
