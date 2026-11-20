# Musclog Premium: hosted AI through RevenueCat, Cloudflare Workers/D1 and OpenRouter (revision 3)

Status: P0 is done as far as it can be without accounts (section 16). **P1, P2 and the file-only part of P3 are built against mocks** (`services/premium-worker/`, `infra/premium/`, `scripts/premium-deploy.sh`, runbook `docs/PREMIUM_WORKER.md`); nothing is deployed or purchased and no real credentials exist. Decisions made while building them are in "Implementation decisions (P1/P2)" below.
Written for: the Musclog maintainer and the coding agents that will implement it phase by phase.
This file is `docs/plans/musclog-premium.md`. `AGENTS.md` discourages one-off plan files, so like the other active plans it is deleted (or folded into `docs/`) when the feature ships. The P0 evidence lives in `spikes/premium-p0/` and is linked from the sections it supports.

Legend: **[V]** means verified in official docs or live APIs on 2026-11-20 (links in section 3). **[A]** means an assumption, or not yet verified. Each [A] names the gate (G1–G11, section 15) that settles it. **No phase may start until the gates it depends on have passed.**

### What changed in revision 3

| Item                      | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions                 | Recorded in the new "Decisions (2026-11-20)" section below: spend share, subscriber cap, OpenRouter only, hostname, no automatic paid upgrades.                                                                                                                                                                                                                                                                                                             |
| Idempotent settlement fix | The revision 2 settle SQL double-charged on replay and its `MAX(0, …)` clamps hid the damage ([ledger spike](../../spikes/premium-p0/ledger/REPORT.md), test 1). Reserve is now 3 statements (`pending` → `held`), settle 2 (period first, guarded by `state = 'held'`), the sweep is guarded by `expires_at` and charges the row's own `reserved_u`, and `settle_token` is gone. Section 8.2 uses the spike's SQL verbatim. 20/20 tests pass on Miniflare. |
| Idempotency keys          | One key per **logical request**, created in `withLlmRetry` and sent as a per-request header, never in `defaultHeaders` ([idempotency spike](../../spikes/premium-p0/idempotency/REPORT.md)). The Worker sends `x-should-retry: false` on 402/403/409.                                                                                                                                                                                                       |
| Phase dependencies        | The G5/G6 benchmarks call OpenRouter directly, so they are P0 gates, not a phase after the proxy. The old P4 becomes a regression run through the staging proxy. G2/G9 need a client that can buy under the key-derived id, so a debug-only identity harness (P1a) is added.                                                                                                                                                                                |
| Financial accounting      | The budget now comes from `net_proceeds_u`: proceeds minus an estimate haircut, an FX haircut and RevenueCat's 1%, then times `SPEND_SHARE`. Examples at 15% **and** 30% Apple commission in section 14. Top-ups are at least $15 because OpenRouter charges a $0.80 minimum fee.                                                                                                                                                                           |
| Authentication            | Multi-device: up to 3 devices per subscription (App Store guideline 3.1.2(a)), replacing "one active device". Signed messages are domain-separated, nonces are server-issued and monotonic per device, the device key is `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, RevenueCat is never configured anonymously, and enrollment filters store, environment, ownership and product. Threat table in 6.1.                                                               |
| Cloudflare capacity       | Replaced with measured numbers: 6 D1 writes and about 22 reads per request, a `daily_full` admission flag, `GLOBAL_MAX_REQUESTS_PER_DAY` 9,900, a 15-minute cron and a 512 KB body cap. Terraform Path B is chosen.                                                                                                                                                                                                                                         |
| Domain                    | `api.musclog.app` is live (the Musclog Barcode API), so it cannot be used. The recommended hostname is `ai.musclog.app`, still unconfirmed.                                                                                                                                                                                                                                                                                                                 |

---

## Decisions (2026-11-20)

1. **`SPEND_SHARE` = 0.5** of **net** proceeds (definition in 8.1). Non-negotiable. It drives the per-user and the global limits.
2. **`MAX_SUBSCRIBERS` = 1,500.** Everything stays on Cloudflare Free.
3. **OpenRouter only.** Gemini is excluded because the ZDR-only rule requires it (section 7). Benchmark priorities, in order: structured-output reliability, tool calling, image-analysis quality, speed, cost.
4. **Production hostname.** You asked for `api.musclog.app`, but it is **live**: it serves the Musclog Barcode API that `hooks/useFoodProductDetails.ts:133` calls. Attaching a Worker there would at best fail and at worst send barcode traffic to Premium ([infra report](../../spikes/premium-p0/infra/REPORT.md), "Domain recommendation"). **Recommended: `ai.musclog.app`** (it does not resolve today). **Pending your confirmation**, so every `ai.musclog.app` in this plan is a placeholder (a Terraform variable). Staging runs on `workers.dev`; production has `workers.dev` and preview URLs disabled.
5. **No automatic paid upgrades.** Any recurring cost needs your explicit approval.
6. **No accounts.** A device-derived RevenueCat identity, with store-verified Restore.
7. **Free, BYOK and on-device AI stay exactly as they are.**

### Implementation decisions (P1/P2, 2026-11-20)

Questions the plan left open, settled with the maintainer (1–4) or by the orchestrator within the plan's rules (5–11). The sections they touch carry the same wording.

1. **Reconciliation is a cumulative delta** (8.3). OpenRouter's `usage_daily` is the current UTC day, so "yesterday's" figure does not exist at 00:30. The daily cron stores the key's cumulative `usage` in `meta.recon` (`{usage_u, at}`) and compares the next run's increase with Σ `settled_u` settled in between. Same 3% + $0.50 threshold; a negative delta (key replaced) re-baselines.
2. **Billing grace is config, default 0** (6.2): `period_end = expiration_date + revenuecat.grace_ms[store]`, 0 for both stores until G2 shows how grace appears in v2. A user in grace gets 403 until then (fail closed). Before any value above 1 h, the duplicate guard must truncate the previous period on renewal (a renewal paid during grace would otherwise overlap it).
3. **The feature is derived from the body** (7): an image part means `vision`, `response_format` means `structured`, anything else `chat`. `AI_CONFIG_JSON.features` holds `max_tokens`, `temperature_max` and `reasoning` for those three.
4. **Two columns the schema lacked** (9): `periods.rc_subscription_id` (re-verification calls `GET subscriptions/{id}`, which still works after an ownership move) and `reservations.body_hash` (8.2 step 2: a reused `Idempotency-Key` with another body returns 422). `RESERVE_INSERT` writes `:bh` and `RESERVE_READMIT` also requires `body_hash = :bh`; the ledger SQL is otherwise the spike's, verbatim.
5. **Signed messages** (6.1): `public_key` and `signature` are base64url; the hashed body of enroll and session is the empty byte string (every signed field is in the string, and `rc_id = H(public_key)` binds the key). Nonce: `n1.<ts>.<random>.<HMAC>`; token: `v1.<base64url {rc, exp}>.<HMAC>`, the two MACs domain-separated. `SESSION_HMAC_KEY_PREVIOUS` is accepted for verification during rotation.
6. **Caps** (8.1): `early_cap_u` and `daily_cap_u` are taken from `cap_u` after `MAX_CAP_U` is applied, so neither can exceed it. The table also carries `CHECK (net_proceeds_u <= proceeds_u)`.
7. **Two cron schedules** (5, 8.3): `*/15 * * * *` (sweep, `daily_full`, global spend-to-proceeds check) and `30 0 * * *` (prune, `accepting_new`, ZDR re-check, reconciliation). The ZDR re-check retries the public list 3 times; if all fail the breaker opens (`zdr_check_failed`), so an unverifiable privacy state never serves.
8. **Upstream outcomes not in the table** (8.2): a timeout before the response or a network error is charged `r` (unknown outcome, fail closed); an upstream 402 or 403 also opens the breaker (`upstream_402` / `upstream_403`); a 404 (no ZDR endpoint, G5) answers 503 `hosted_disabled` without opening it.
9. **Terraform bootstrap** (5, the open question): the deploy script applies `-target=cloudflare_d1_database.db` first, writes the D1 id into a git-ignored generated wrangler config, runs migrations and `wrangler deploy`, then the full apply.
10. **Tests inject the upstreams** (13): `@cloudflare/vitest-plugin` 1.8.5 no longer ships `fetchMock`, so RevenueCat and OpenRouter clients are interfaces passed through `createApp(makeDeps)`; tests run in workerd on a real Miniflare D1 with fakes.
11. **Production config ships disabled**: `HOSTED_AI_ENABLED = "false"` and an empty `product_ids`, which the validator rejects in production, so nothing can serve until RevenueCat products exist and the config is filled in.

---

## 1. Executive summary

Musclog stays free, and BYOK (bring your own API key) is untouched. Premium (€4.99/month) adds one thing: a `hosted` AI provider that needs no API key. One subscription works on up to 3 of the subscriber's devices.

```
 Musclog app (Expo)                          Cloudflare Workers Free                    Upstream
┌──────────────────────────────┐  HTTPS  ┌────────────────────────────────────┐
│ device P-256 key (SecureStore)│───────▶│ Worker musclog-premium              │      ┌────────────┐
│ RC appUserID = H(pubkey)      │ enroll  │  ai.musclog.app                     │─────▶│ RevenueCat │ v2 API: subscription,
│ react-native-purchases        │ session │  /v1/enroll  /v1/session            │      └────────────┘ transactions, proceeds
│ OpenAI SDK → baseURL=Worker   │ bearer  │  /v1/chat/completions (narrow proxy)│      ┌────────────┐
│   key = 1 h session token     │ +Idem-  │  /v1/usage /v1/config               │─────▶│ OpenRouter │ ZDR-only, max_price,
│   Idempotency-Key per request │  Key    │  cron (15 min): sweep, checks       │      └────────────┘ prepaid credits
└──────────────────────────────┘         │  D1: devices, periods, reservations,│
                                          │      meta (breaker, daily_full)      │
                                          └────────────────────────────────────┘
```

The core decisions:

1. **Hosted AI reuses the existing OpenAI-compatible client path.** The Worker is a narrow Chat Completions proxy, and the app only adds a provider entry.
2. **Identity: the RevenueCat user ID is a commitment to a device key, not a secret.** Enrollment checks `rc_id == H(pubkey)`, a domain-separated signature, a single-use server nonce, and that RevenueCat shows a store-verified subscription whose customer is that ID. Up to 3 devices per subscription; Premium status comes from the Worker.
3. **Budget: one ledger row per paid store transaction.** The cap is at most 50% of that payment's **net** proceeds, after the OpenRouter fee. It is never derived from the client and never from a guess.
4. **Accounting: per-request reservations, atomic and exactly-once.** Replays, retries, crashes and stale holds have defined outcomes, and unknown outcomes are charged at the reserved amount (fail closed).
5. **Global safety comes in layers:** prepaid OpenRouter credits with no auto top-up (the hard ceiling), a dedicated key with a monthly limit, a ledger-wide spend-to-proceeds check, daily reconciliation, a daily ZDR re-check, and a circuit breaker.
6. **Cloudflare Free only.** Measured cost is 6 D1 writes per request: about 42k writes/day (42% of the limit) at 1,500 subscribers on the mix profile. A `daily_full` flag stops admission before the limit, and nothing upgrades the plan. **10,000 subscribers cannot be served on Free.**

On whether every rule can be absolute: some risks cannot be eliminated, only bounded (section 12). The worst case per subscriber is one period's budget, and the worst case overall is the prepaid balance.

---

## 2. Existing codebase analysis

- **There is no backend, wrangler or Terraform config in the repo.** Today's free tier is Cloudflare AI Gateway (`services/GatewayService.ts`, `constants/gateway.ts`). It authenticates with a shared static token baked into the bundle (`EXPO_PUBLIC_MUSCLOG_GATEWAY_AUTH_TOKEN`), so it is not reusable as an entitlement system. Treat it as a separate security follow-up.
- **The reuse point is the OpenAI-compatible path.** Every AI function ends in `buildOpenAIClient(config)` (`utils/coachAI.ts:379-400`):
  - chat: `sendViaOpenAI` (`:1024`)
  - text: `:1400` and `:1553`
  - structured: `requestStructured` (`:1752`)
  - image: `generateWithImageStructured` (`:1971`, data-URL `image_url`)

  The `'openai'` `StructuredDialect` fits as is.

- **The app makes no tool or function calls.** Each "function" is a declaration converted to a strict `json_schema` response (`getSchemaFromFunctionDeclaration` `:1611`; `services/aiOnboardingTurn.ts:48`). The proxy will still allow and test `tools`, but no current flow depends on them.
- **Structured output is always `json_schema` with `strict: true`** (via `makeSchemaStrict`). Models and routing must support strict mode (`require_parameters: true`).
- **The provider tables that need a `hosted` member:**
  - `CoachAIProvider` and `PROVIDER_CONFIGS` (`coachAI.ts:310`, `:320`)
  - `AI_PROVIDER_KINDS` and `AI_PROVIDER_STRENGTH` (`constants/ai.ts:49`, `:64`)
  - `PROVIDER_PROBES` and `PROVIDER_PRIORITY` (`services/AiService.ts:99`, `:149`)
  - three hand-written copies in `context/SettingsContext.tsx` (`:592`, `:616`, `:651`)
  - `PROVIDER_LABELS` (`utils/aiErrors.ts:160`), `components/aiOnboarding/providerNames.ts`, `AISettingsModal.tsx`, `app/app/onboarding/ai-provider.tsx`, `AINotConfiguredModal.tsx`
- **Errors:**
  - `GatewayRateLimitError extends AiCreditsError` (`coachAI.ts:72`). Hosted errors follow that pattern.
  - `USER_KEY_PROVIDERS` (`aiErrors.ts:38`) must **not** include `hosted`. Otherwise a 401 from our Worker would read as "your key is wrong".
- **Consent:** `utils/aiConsent.ts` and the App Store 5.1.2(i) rule in `AGENTS.md` require a named consent per data recipient.
- **Purchases:** none exist yet (no IAP dependency, no billing permission). Native modules are already in use, so dev builds are the norm.
- **Reference infrastructure:** `godot-genesis-zero/rg/legacy-server/infra/` uses OpenTofu `~> 1.13` and provider `cloudflare/cloudflare = 5.28.1`. It uploads the Worker with `content_file` + `content_sha256`, turns workers.dev on or off with `cloudflare_workers_script_subdomain`, sets up a custom domain and billing notification, and uses OpenTofu state encryption (`TF_ENCRYPTION`). Tokens come from the environment. It has no CI deploy, no D1 and no secret bindings. Revision 3 reuses its style but not its script upload (Path B, section 5).

**Files to create or modify** (unchanged from revision 1 except where noted):

| Area          | Files                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend (new) | `services/premium-worker/{src,migrations,test}`, `infra/premium/*.tf`, `wrangler.toml`, `scripts/premium-deploy.sh`, `scripts/premium/` (seeded from the `spikes/premium-p0` harnesses)                                                                                                                                               |
| App provider  | `constants/ai.ts`, `utils/coachAI.ts` (`withLlmRetry` creates one `Idempotency-Key` per logical request, sent as a per-request header), `services/AiService.ts`, `context/SettingsContext.tsx`, `utils/aiErrors.ts`, `providerNames.ts`, `utils/aiOnboarding/classifyError.ts`, `utils/structuredChat.ts`, `hooks/useChatMessages.ts` |
| App (new)     | `services/hostedAi/{HostedAiService,deviceIdentity,session}.ts`, `services/premium/PremiumService.ts` (+ `.web.ts` stubs), `hooks/usePremium.ts`, `hooks/useHostedUsage.ts`, `components/modals/PremiumModal.tsx`, `components/settings/PremiumCard.tsx`                                                                              |
| Settings      | `constants/settings.ts`, `constants/settingDefinitions.ts` (`useHostedAi`), `SettingsService.ts`; `database/importDb.ts` and `database/seeders/prod.ts` force `useHostedAi` off on restore                                                                                                                                            |
| Config        | `package.json` (`react-native-purchases`, `@noble/curves`), `app.json`, `eas.json` (public RC keys), `.env.example`                                                                                                                                                                                                                   |
| i18n and docs | all 10 `lang/locales/*`; `docs/CURRENT_FEATURES.md`, `AGENTS.md` (Premium section), privacy page copy, `docs/GOOGLE_PLAY.md` / `docs/APP_STORE.md` (IAP setup)                                                                                                                                                                        |

---

## 3. Research findings

**Cloudflare [V]**

- **Workers Free** ([limits](https://developers.cloudflare.com/workers/platform/limits/)):
  - 100,000 requests/day.
  - **10 ms CPU per invocation.** Waiting on fetch or D1 does not count.
  - 128 MB memory, 50 subrequests, 5 cron triggers.
  - No wall-clock limit while the client stays connected; `waitUntil` gets ≤ 30 s.
  - Over the daily limit: **Error 1027** and no charge. CPU exceeded: Error 1102.
- **D1 Free** ([pricing](https://developers.cloudflare.com/d1/platform/pricing/), [limits](https://developers.cloudflare.com/d1/platform/limits/)):
  - 5 M rows read/day and **100 k rows written/day**. INSERT, UPDATE and DELETE each count per row, and an index on a written column adds a row.
  - 5 GB total storage, 500 MB per database, 10 databases.
  - 50 queries per invocation (a `batch()` counts as one).
  - Time Travel: 7 days.
  - Over a limit, queries fail until 00:00 UTC.
- **`batch()`** ([D1 API](https://developers.cloudflare.com/d1/worker-api/d1-database/)) is an all-or-nothing transaction: statements run sequentially and the batch rolls back on any failure.
- **Other Free limits** ([pricing](https://developers.cloudflare.com/workers/platform/pricing/)): Workers Logs 200 k events/day with 3-day retention; Logs pricing changes on 2026-12-01. KV allows 1 k writes/day. Durable Objects are SQLite-only.
- **Rate-limit binding** ([docs](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)): approximate, counted per location, period of 10 or 60 s. Free-plan availability is not stated [A, G3].
- **Terraform** ([IaC](https://developers.cloudflare.com/workers/platform/infrastructure-as-code)): provider 5.28.1 has `content_file` and `content_sha256` and exposes `keep_bindings`, `cloudflare_workers_script_subdomain` (`enabled`, `previews_enabled`), `cloudflare_workers_custom_domain` and `cloudflare_workers_cron_trigger` [V, offline `tofu validate`]. `secret_text` values are stored in state in plaintext (provider issue [#7222](https://github.com/cloudflare/terraform-provider-cloudflare/issues/7222), open) and have drift bugs ([#5892](https://github.com/cloudflare/terraform-provider-cloudflare/issues/5892)). Wrangler preserves secrets not listed in its file ([secrets](https://developers.cloudflare.com/workers/configuration/secrets/)); nothing official says a Terraform upload does. Terraform cannot apply D1 migrations, so they run through `wrangler d1 migrations apply`.
- **Custom domains** ([docs](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)): "You cannot create a Custom Domain on a hostname with an existing CNAME DNS record"; Cloudflare creates the DNS record and certificate. Universal SSL covers the apex and one subdomain level. Disabling `workers.dev` does not disable preview URLs ([docs](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)).

**RevenueCat [V]**

- **Pricing** ([pricing](https://www.revenuecat.com/pricing/)): free below $2.5K MTR (monthly tracked revenue, in USD before the store's cut), then 1% of all MTR. Whether MTR is VAT-inclusive is not documented, so the plan assumes it is. **Webhooks are included** in the single current plan ("Everything's Included"), but this design does not need them.
- **Custom App User IDs** ([identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers)): `Purchases.configure(..., appUserID:)` is supported. IDs should be ≤ 100 characters, are case-sensitive, and are blocked if they contain `/`. Anonymous IDs are regenerated on reinstall.
- **Restore** ([restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior)): the default is "Transfer to new App User ID". For **identified** IDs, the docs' example says "UserB would now have access to the subscription and it would be revoked from UserA". Only **anonymous** owners are aliased instead of transferred: the first purchase must happen under the key-derived ID, never anonymously. This is why we use identified, key-derived IDs. A separate sandbox restore behavior exists and must match production. How soon the old ID loses access is not documented [A, G2]. `syncPurchases` uses the same path.
- **`logIn`** ([identifying customers](https://www.revenuecat.com/docs/customers/identifying-customers)): from an identified ID to another ID, "No merge or purchase transfer occurs." Only anonymous IDs are merged.
- **API v2 permissions and limits** ([subscription](https://www.revenuecat.com/docs/api-v2/subscription) and neighbours): `GET customers/{c}/subscriptions`, `GET subscriptions/{sub}`, `GET subscriptions/{sub}/transactions` and the search `GET subscriptions?store_subscription_identifier=…` (any past or current Apple transaction ID or Play order ID) need only `customer_information:subscriptions:read`; the customer and its entitlements need `customer_information:customers:read`. Transfer, grant, restore and refund need `read_write`, which the Worker key must not have. Customer Information is limited to 480 requests/min per key. `Subscription` carries `id`, `customer_id`, `original_customer_id`, `gives_access`, `status`, `store` (including `promotional` and `test_store`), `environment`, `ownership` and `product_id`; Apple's original transaction ID is **not** exposed.
- **Sandbox renewal speed:** Apple monthly renews every 5 minutes (at most 12 a day), Google monthly every 5 minutes (at most 6 renewals). The Test Store exercises Worker logic only and must be rejected in production.
- **API v2 Subscription** ([subscription](https://www.revenuecat.com/docs/api-v2/subscription)):
  - fields: `starts_at` ("originally started"), `current_period_starts_at` / `current_period_ends_at`, `gives_access`, `status`, `store`, `product_id`, `original_customer_id`
  - `total_revenue_in_usd` {gross, commission, tax, **proceeds**}, which is probably cumulative
  - `store_subscription_identifier`: for Apple, the _latest_ transaction ID
- **Per payment:** `GET /projects/{p}/subscriptions/{sub}/transactions` returns `SubscriptionTransaction`s with `purchased_at`, `expiration_date` and `revenue_in_usd.proceeds` ("Net revenue after store commission/fees and taxes"), for App Store and Play Store.
- Whether the subscription and transaction IDs stay stable across transfer is **not documented** [A, G2].
- **Webhook events** ([event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields)): `price` (USD, negative for refunds), `tax_percentage`, `commission_percentage`, `TRANSFER` with `transferred_from`/`to`. Delivery is at-least-once, and RevenueCat recommends re-fetching the customer after an event. Optional for this design.
- **Expo** ([installation](https://www.revenuecat.com/docs/getting-started/installation/expo)): needs a dev build (Expo Go runs only in mock mode). Web requires RC Billing, so Premium is hidden on web.

**OpenRouter [V]**

- **Usage** ([accounting](https://openrouter.ai/docs/guides/administration/usage-accounting)): `usage.cost` comes on every response and cannot be turned off. `GET /api/v1/generation?id=` returns `total_cost` in USD. How soon a generation can be looked up is not documented [A, G5].
- **Routing** ([provider selection](https://openrouter.ai/docs/guides/routing/provider-selection)): `provider.max_price` is a **hard filter**. Also available: `require_parameters`, `data_collection: "deny"` and `zdr`.
- **ZDR** ([zdr](https://openrouter.ai/docs/guides/features/zdr)): `zdr: true` routes only to ZDR endpoints, _plus Safety Retention endpoints unless the account is set to **ZDR only**_. Self-serve accounts allow Safety Retention by default. **Since 2026-10-18, Google requires Safety Retention (it may keep flagged prompts up to 90 days), so Gemini is unavailable under ZDR only.** What happens when no ZDR endpoint exists is not documented [A, G5].
- **Keys** ([limits](https://openrouter.ai/docs/api-reference/limits), [get current key](https://openrouter.ai/docs/api-reference/api-keys/get-current-key)): `GET /api/v1/key` called with the inference key returns `limit`, `limit_remaining`, `limit_reset`, and `usage` / `usage_daily` / `usage_monthly` in USD. Per-key `limit_reset` can be daily, weekly or monthly.
- **Pricing** ([FAQ](https://openrouter.ai/docs/faq), [pricing](https://openrouter.ai/pricing)): "5.5% ($0.80 minimum) fee when you purchase credits", so a $5 purchase costs $5.80 and the fee is 5.5% only above about $14.5. The pricing page says "never on individual requests". Inference is billed at the provider's list price. Failed or fallback attempts are not billed.
- **Streaming usage** ([streaming](https://openrouter.ai/docs/api-reference/streaming)): every stream ends with an extra chunk carrying `usage`, sent just before `[DONE]`. Mid-stream failures arrive as HTTP 200 with a final `error` chunk. `X-Generation-Id` is on every response.
- **Public ZDR list** ([ZDR](https://openrouter.ai/docs/guides/features/zdr)): `GET https://openrouter.ai/api/v1/endpoints/zdr` is unauthenticated and carries a `safety_retention` flag per endpoint (1,050 endpoints on 2026-11-20). The per-model endpoints response has no ZDR field, so this list is the only source.
- **Errors** ([errors](https://openrouter.ai/docs/api-reference/errors)): 402 means insufficient credits; a per-key limit blocks with 403.
- **Reasoning** ([reasoning tokens](https://openrouter.ai/docs/use-cases/reasoning-tokens)): reasoning tokens are billed as output and count inside `max_tokens`.
- **Data collection** ([privacy](https://openrouter.ai/docs/guides/privacy/data-collection)): prompts are not stored by default.
- **Structured outputs** ([structured outputs](https://openrouter.ai/docs/features/structured-outputs)): strict `json_schema` support varies per endpoint.

**Stores [V]** (details in the [RevenueCat and store report](../../spikes/premium-p0/revenuecat/REPORT.md))

- **Apple, Schedule 2 v127 (2026-10-13):** commission 30%, 15% for renewals after one year of paid service; Small Business Program 15% (up to $1M prior-year proceeds, needs enrolment). Prices are "net of any and all taxes collected" and Apple remits VAT in the EU; bank FX differentials may be deducted. Refunds are at "Apple's sole discretion" and the developer reimburses the full price. **Family Sharing cannot be turned off once on.**
- **Apple guidelines:** 3.1.1 requires a restore mechanism; **3.1.2(a): "Subscriptions must work on all of the user's devices where the app is available"** (the reason for 3 devices per subscription); 3.1.2(c) requires a clear description, price, duration and Terms and Privacy links; 5.1.2(i) requires explicit consent before sharing with third-party AI.
- **Google Play:** from 2026-06-30, a 10% service fee plus a 5% billing fee (US, UK, EEA) is 15% for subscriptions, and 15% elsewhere. Google remits EU VAT. The refund window is not documented. RTDN is "strongly recommended" for price accuracy.

**Fud AI** (read its hosted-AI docs, ledger, migrations and wrangler.toml). Copied:

- a pull-model entitlement check cached in D1
- an atomic ledger
- refunds only when the upstream call failed
- stable error codes
- a body allowlist
- never echoing provider errors

Not copied:

- the RevenueCat ID as a per-request bearer; their README lists that as a residual risk
- action counts with no cost bound
- KV and Durable Objects

---

## 4. Cloudflare free-tier feasibility (measured)

Numbers come from the [ledger spike](../../spikes/premium-p0/ledger/REPORT.md) (D1 `meta.rows_written` / `rows_read` on Miniflare) and the [CPU spike](../../spikes/premium-p0/cpu/REPORT.md). Miniflare's counts are **not** production billing counts (section 12).

**Services:** Workers, D1 and one cron trigger. No KV, Durable Objects, Queues, R2 (needs a card) or Secrets Store. The rate-limit binding only if gate G3 shows it is available on Free.

**D1 rows per AI request (hot path):**

| Step                                                            | Writes | Reads        |
| --------------------------------------------------------------- | ------ | ------------ |
| Reserve batch (insert `pending`, update period, flip to `held`) | 3      | 8            |
| Read-back of the reservation                                    | 0      | 1            |
| Settle batch (update period, update reservation)                | 2      | 5            |
| Prune (daily scan of about 8 days of rows, amortized)           | 1      | about 8      |
| **Total**                                                       | **6**  | **about 22** |

A refused request (budget, `daily_full`) costs 0 writes and 3 to 4 reads.

**Other writes:**

- Session mint: 1 (the monotonic nonce timestamp, 6.1), about 4.5k/day at 1,500 subscribers.
- Enrollment: about 3 (device row plus its index), once per device.
- Period creation and its later prune: 3 + 3 per payment, about 0.2 per subscriber per day.
- Cron: writes only when it repairs something or `daily_full` flips.

**Projection at 1,500 subscribers, mix profile** (70% light at 2 requests/day, 25% average at 5, 5% heavy at 30: 6,225 requests/day):

|              | Per day                                                            | Share of Free limit   |
| ------------ | ------------------------------------------------------------------ | --------------------- |
| Rows written | 6,225 × 6 + 4.5k (sessions) + 0.3k (periods) ≈ **42k**             | **42%** of 100,000    |
| Rows read    | 137k (requests) + 288k (cron: 96 runs × 3,000 rows) ≈ **425k**     | **8.5%** of 5,000,000 |
| Storage      | 7.5 MB (reservations, 8 days) + 1 MB (periods, 60 days) ≈ **9 MB** | 2% of 500 MB          |

Workers requests: about 1.2 per AI request, far below 100,000/day.

| Usage profile (per subscriber per day) | Writes per day | Subscribers at 60% of 100k writes      |
| -------------------------------------- | -------------- | -------------------------------------- |
| Light: 2 requests                      | ~15            | ~3,900                                 |
| Average: 5 requests                    | ~33            | ~1,800                                 |
| Heavy: 30 requests                     | ~183           | ~330                                   |
| Mix                                    | ~28            | ~2,100                                 |
| Per-user ceiling: 60 requests          | ~363           | ~165 (every subscriber at the ceiling) |

**Staying strictly within Free:**

1. **`GLOBAL_MAX_REQUESTS_PER_DAY` = 9,900** (about 60% of the write limit, 40% headroom). The 15-minute cron sums today's `day_requests` over live periods and sets `meta.daily_full`; the reserve guard reads that flag (no extra write). Refused reserves write nothing. The mix profile uses 63% of the allowance. **Measured in P2** (`services/premium-worker/test/capacity.test.ts`): at the full 9,900 plus session mints (4.5k) and periods (0.3k) the writes are 64.2k/day, 64% rather than 60%, because 9,900 was sized before session writes were counted. Still under the limit; lowering it to about 9,200 would restore the 60% target (open for the maintainer).
2. **Per-user ceiling: 60 requests/day**, so one user can consume at most 0.6% of the global allowance.
3. **New sign-ups close** at `MAX_SUBSCRIBERS` 1,500: the daily cron counts active periods and writes `meta.accepting_new`; `/v1/config` then returns `accepting_new: false` and the app hides Subscribe. The gate applies _before_ purchase.
4. **Fail closed when a limit is hit anyway.** A D1 error means no reservation, so no upstream call and no spend. A Workers 1027 is handled the same way. Cloudflare Free never bills. **There is no payment method and no paid plan on the Cloudflare account**; P3 checks this.
5. **Cron every 15 minutes** (sweep, `daily_full`, global checks), scanning only periods with `period_end > now - 1 day`. Reservations are pruned after 7 days and periods after 60 days (monthly totals go to logs).
6. **Request body cap: 512 KB**, enforced before any D1 work. The CPU spike found a JPEG up to about 500 KB (a 0.67 MB body) comfortable (about 1 ms p50, 2 ms p99 in Node), 1 MB marginal and 2 MB unsafe, so G6 must pick an image setting inside the cap. G4 re-measures `cpuTime` on staging, because local timings are only a proxy.
7. **10,000 subscribers do not fit on Free**: about 280k writes/day at the mix profile, and `daily_full` would stop admission long before that. Growing past `MAX_SUBSCRIBERS` needs your explicit decision to move to Workers Paid ($5/month).

**What cannot be guaranteed on Free:**

- If most subscribers turned heavy at once, `daily_full` (or D1 itself) would stop everyone until 00:00 UTC. That costs nothing and BYOK keeps working, but it is a shared outage: one abuser group can shut out all subscribers for the rest of the day.
- **Admission can overshoot `GLOBAL_MAX_REQUESTS_PER_DAY` within one cron interval**: the flag counts settled requests only and updates every 15 minutes. At 9,900/day that is about 100 requests per interval on average, and a burst can be several times that. The 40% headroom covers it.
- An unauthenticated flood can exhaust the Workers request limit (the same kind of outage). Mitigations: reject before any D1 work, the rate-limit binding (if G3 passes), and an optional zone WAF rule on the custom domain (Free allows one rule).
- Refused requests are not free (3 to 4 reads each); 1M refused requests/day would exhaust the 5M read limit.

---

## 5. Terraform/OpenTofu design (Path B)

**Path B is chosen** ([infra report](../../spikes/premium-p0/infra/REPORT.md)): **wrangler deploys the code and keeps the secrets; Terraform owns everything around the script.** Official docs say wrangler preserves secrets not listed in the file, and nothing official says a Terraform upload does (`keep_bindings` exists in the provider schema, but its effect on secrets is unproven and the provider's `secret_text` handling has had regressions).

**Layout:** `infra/premium/{versions,variables,main,outputs}.tf` in the style of godot-genesis-zero, plus `wrangler.toml` for the script, its bindings (D1, plain-text vars) and `workers_dev = false`. Provider pinned to `= 5.28.1`. The same `.gitignore` applies: state, plans and `*.tfvars` are ignored; `.terraform.lock.hcl` and `*.tfvars.example` are committed. **State encryption is enforced** (`TF_ENCRYPTION` passphrase kept outside the repo).

**Terraform resources** (checked offline with `tofu init` and `validate` on provider 5.28.1):

- `cloudflare_d1_database` (with `prevent_destroy`)
- `cloudflare_workers_custom_domain` for the hostname variable (default `ai.musclog.app`, confirmed 2026-11-20)
- `cloudflare_workers_script_subdomain` with `enabled = false` and `previews_enabled = false` (wrangler's `workers_dev = false` does not disable preview URLs)
- `cloudflare_workers_cron_trigger` (`*/15 * * * *` and `30 0 * * *`; implementation decision 7)
- optional: `cloudflare_notification_policy` (`incident_alert`, and `universal_ssl_event_type` in production) when `alert_email` is set. The provider has no Workers-specific alert type, and whether these work on Free is unverified (G1)

The script resource itself is **not** in Terraform. The subdomain, cron and custom-domain resources reference the script by name, so **the first `wrangler deploy` comes before the first full `tofu apply`**. The D1 id reaches wrangler through a targeted first apply (implementation decision 9).

**Secrets never touch Terraform config or state.** `OPENROUTER_API_KEY`, `REVENUECAT_V2_SECRET_KEY` (read-only scopes) and `SESSION_HMAC_KEY` are set with `wrangler secret put` only. The provider stores `secret_text` values in state in plaintext (issue #7222, open), and no Terraform resource sets a Worker secret without keeping its value in state. `scripts/premium-deploy.sh` ends with `wrangler secret list` and fails if a required secret is missing.

**Environments:**

- Local: `wrangler dev`, with `.dev.vars` (gitignored), Miniflare D1 and mock upstream URLs.
- Staging and production: separate Worker and D1 pairs (`musclog-premium-staging` / `musclog-premium`). Staging uses `workers.dev`.
- API tokens: read-only for `plan`, a separate write token for `apply`, scoped to the one account and the one zone with the permissions listed in the infra report. Never in a tfvars, the repo or CI.

**Deploy script:** `npm ci && npm test` → bundle → `wrangler d1 migrations apply --remote` (additive, before code) → `wrangler deploy` → `tofu fmt -check && validate && plan` (read the plan) → `apply` → smoke test → print the version.

**CI (done 2026-11-20):** `.github/workflows/premium-checks.yml` has three jobs and runs only on changes to the Worker, `infra/premium`, the deploy script, its runbook or the workflow itself: the Worker's `npm ci`, Vitest and `tsc` (Node pinned to the exact version `eas.json` uses); `tofu init -backend=false`, `fmt -check` and `validate` (OpenTofu 1.13.2, inside `~> 1.13`); and `scripts/premium-deploy.sh staging|production --dry-run` plus `shellcheck`, with an empty environment. Actions are pinned by full commit SHA, `permissions: contents: read`, runs cancel when superseded, and no secret is referenced. No apply from CI: state is a local encrypted file, and remote state would need R2, which needs a card. `utils/__tests__/premiumChecksWorkflow.test.ts` fails if the workflow mentions apply, deploy (the script's own name aside), secrets, Cloudflare, OpenRouter or RevenueCat, an action is not SHA-pinned, or Node drifts from `eas.json`.

**Rollback:** code with `wrangler rollback` (the last 100 versions over 30 days are kept [V]); data with D1 Time Travel (7 days); kill switch `HOSTED_AI_ENABLED=false`.

**Cleanup:** `wrangler d1 export`; remove `prevent_destroy`, then `tofu destroy`; revoke the OpenRouter and RevenueCat keys by hand.

---

## 6. Identity and subscription design

### 6.1 Device-derived identity, multi-device

Evidence: [crypto spike](../../spikes/premium-p0/crypto/REPORT.md) (29/29 tests in Node and workerd) and [RevenueCat research](../../spikes/premium-p0/revenuecat/REPORT.md).

**Device key and `rc_id`**

1. The first time Premium is opened, the app generates a P-256 keypair with `@noble/curves` 2.4.0 (pure JS, no new native module). The private key goes to `expo-secure-store` with **`keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY` set explicitly**: the iOS default (`WHEN_UNLOCKED`) migrates through encrypted device backups and would clone the key onto a new phone. Android Auto Backup already excludes SecureStore preferences (the Android 12+ extraction-rules file is not yet read: open).
2. `rc_id = "mlg1_" + hex(sha256(uncompressed_pubkey))`, hashing the **65-byte uncompressed** key (`getPublicKey(sk, false)`; `keygen().publicKey` is the 33-byte compressed key and must not be hashed). 69 characters, under RevenueCat's 100.
3. **RevenueCat is never configured anonymously.** It is configured lazily, never at boot, as `Purchases.configure({ apiKey, appUserID: rc_id })` before any purchase or restore. An anonymous owner is aliased instead of transferred, which would break enrollment (A7 in the research).

**Signed messages.** Every signature covers one string, domain-separated and bound to a purpose, the ID, the nonce and the body:

```
musclog-premium-v1\n<purpose>\n<rc_id>\n<nonce>\n<sha256(body)>        purpose = enroll | session
```

noble 2.4.0 `p256.sign(msg, sk)` prehashes with SHA-256 by default, which is exactly what WebCrypto `ECDSA` + `SHA-256` verifies (a 64-byte `r||s`, no DER). Never hash by hand on top of that. The Worker **rejects high-S signatures** (WebCrypto accepts both encodings of a signature), so signatures are canonical and the nonce, not the signature, is the replay key.

**Nonce.** `GET /v1/challenge` returns a server-issued, timestamped HMAC nonce valid for 2 minutes. Session and enroll additionally require `nonce_ts > devices.last_nonce_ts` (monotonic per device, one write per session mint), so a nonce is **single use** without a nonce table.

**`POST /v1/enroll`**: `{ rc_id, public_key, nonce, signature }`. The Worker checks, in this order, and fails fast before any RevenueCat call:

1. `public_key` is 65 bytes and on the curve, and `rc_id === "mlg1_" + hex(sha256(public_key))`. Else 400 `id_key_mismatch`.
2. The nonce is valid, fresh and newer than `last_nonce_ts`; the signature verifies and is low-S. Else 401 `bad_signature`.
3. RevenueCat v2 `GET customers/{rc_id}/subscriptions`, keeping only subscriptions with `store ∈ {app_store, play_store}`, `environment = production` (sandbox only on staging), `ownership = purchased`, `gives_access`, and `product_id` in the allowlist. **The subscription's `customer_id` must equal `rc_id`.** None qualifying: 403 `subscription_required`. More than one: 503 (fail closed, never guess).
4. `GET subscriptions/{sub}/transactions` gives the transaction covering now, and `revenue_in_usd.proceeds` (403 `revenue_unverified` if missing). The Worker derives `lineage_key` and `payment_key` (6.2).
5. **At most `MAX_DEVICES` = 3 active devices per `lineage_key`.** Enrolling a fourth revokes the least recently used one (by `last_nonce_ts`) in the same batch. The device row is inserted, and the period row is created or reused.

**`POST /v1/session`**: a signed nonce returns a 1 h HMAC token `v1.{rc_id, exp}.mac`. **A device stays valid while its subscription gives access**, even after RevenueCat moves ownership of the subscription to another device's id (RevenueCat gives access to one customer at a time, but App Store guideline 3.1.2(a) requires subscriptions to work on all of the user's devices). When the cached entitlement is older than 6 h the Worker re-verifies the subscription; if RevenueCat is unreachable and the cache is older than 24 h, it denies. A revoked device gets 401 `unknown_device`. The device check also runs in the reserve SQL, so revoking a device kills its token early.

**The app shows Premium status from the Worker** (`/v1/session`, `/v1/usage`), not from local `CustomerInfo`, because after an ownership move RevenueCat shows the old device as not entitled.

**Adding a device** is: install, open Premium, tap Restore. The store-verified restore makes RevenueCat show the new key-derived ID as the subscription's current customer, and enroll (step 3) checks exactly that. The budget is per payment and shared by all devices.

**What survives without a login**

- **Reinstall on iOS:** the key is `THIS_DEVICE_ONLY`, so it usually survives a reinstall on the same phone. If not, treat it like Android.
- **Reinstall, or a new phone:** a new key means a new `rc_id`. Restore, then enroll as a new device. The same payment means the same ledger row, so usage continues. The old device row ages out through the 3-device LRU.
- **Lost key, or a stuck device:** "Reset Premium on this device" generates a new key and ID, then runs Restore and enroll.
- **iOS to Android:** not possible. The stores are separate, and the UI says so.
- **RevenueCat restore behavior** must stay "Transfer to new App User ID" in production and sandbox. Any other setting leaves the old ID holding access, so the `customer_id == rc_id` check fails closed.

**Attack table.** STOPS = the design prevents it. BOUNDED = it can happen, with the damage limited as stated. **OPEN = depends on RevenueCat or store behavior that the desk research could not establish; G2 settles it.**

| #   | Attack                                                                | Verdict                  | What bounds it / what remains                                                                                                                                                                                                                                                                                                                                                                       |
| --- | --------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stolen `rc_id` (not secret: visible in RevenueCat, logs, Sentry)      | STOPS                    | The Worker recomputes the hash itself and never accepts a request or issues a token on an ID alone. A mismatched ID is rejected before any signature check.                                                                                                                                                                                                                                         |
| 2   | Stolen session token                                                  | BOUNDED                  | Valid for at most 1 h, for that one device, spending only its period budget (in-flight and daily caps). The device status check in the reserve SQL revokes it early. Tokens stay out of logs and Sentry; the HMAC secret needs a rotation path.                                                                                                                                                     |
| 3   | Replayed enroll or session                                            | STOPS                    | Server-issued nonce, 2 min TTL, `nonce_ts > last_nonce_ts`, low-S only (so a second valid encoding of a signature does not help). Tested against server state in P1. Nonce minting is unauthenticated and rate-limited.                                                                                                                                                                             |
| 4   | Attacker calls RevenueCat with the public SDK key for a known `rc_id` | STOPS for the main paths | Docs: `logIn` from an identified ID causes no merge or transfer (A1); restore moves only the restorer's own store purchases (A2); the Worker key is read-only (A9); attribute writes (A6) and spam customers (A5) are never trusted and have no billing effect. **OPEN:** whether a known transaction id alone can restore (A4) and whether public-key probes expose tokens (A17), matrix steps 17. |
| 5   | Leaked store receipt or purchase token posted under an attacker's key | BOUNDED                  | A receipt is bearer proof of payment. The attacker restores it under a fresh `rc_id`, RevenueCat transfers access, and the attacker enrolls as one of the (up to 3) devices. The budget is per payment, so there is never a second budget. **OPEN:** what the stores require beyond the token, and how likely tokens are to leak.                                                                   |
| 6   | Key extraction through backup                                         | BOUNDED                  | iOS: `WHEN_UNLOCKED_THIS_DEVICE_ONLY`. Android: SecureStore prefs are excluded from Auto Backup. Root or malware reading JS memory still yields the key (SecureStore is non-exportable only at rest); the loss is one period budget. A Secure Enclave or Keystore key needs a native module the repo does not have.                                                                                 |
| 7   | RevenueCat restore-behavior setting changed                           | OPEN, fails closed       | The `customer_id == rc_id` check fails (enroll refused) rather than granting. Safe, but restores break until the setting is fixed. Matrix step 20 tests the variant.                                                                                                                                                                                                                                |
| 8   | Promotional or RevenueCat-granted entitlements                        | STOPS                    | The enroll filter needs `store ∈ {app_store, play_store}`, `ownership = purchased`, a known product and store revenue (`grant_entitlement` creates `store = promotional`, no product). **OPEN:** how offer codes appear in v2 (likely app_store with null or 0 revenue, so cap 0).                                                                                                                  |
| 9   | Key farming (free minting of keys)                                    | BOUNDED                  | Every enroll still needs a paid subscription, so there is no free budget. The cost is Worker and RevenueCat calls: fail fast before any RevenueCat call, and rate-limit enrollment.                                                                                                                                                                                                                 |
| 10  | Family Sharing, or one Apple ID on many phones                        | STOPS / BOUNDED          | Family Sharing cannot be turned off once on, so it is never enabled, and `ownership != purchased` is rejected. Several phones on one Apple ID are legitimate devices (up to 3) sharing one budget. **OPEN:** how long the old ID keeps access after a transfer (A13), which G2 measures.                                                                                                            |
| 11  | Anonymous first purchase                                              | STOPS                    | RevenueCat is never configured anonymously (A7).                                                                                                                                                                                                                                                                                                                                                    |
| 12  | Hermes performance of noble                                           | OPEN                     | Not measured on a device (G11); expect tens to hundreds of ms per signature, acceptable once per session.                                                                                                                                                                                                                                                                                           |

**The remaining attack is theft of the private key** (device compromise, out of scope). The loss is bounded by one period's budget.

### 6.2 Billing identity: payment-keyed budgets (no resets, no duplicates)

| Key           | Derived from                                                                                             | Used for                                                           |
| ------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `payment_key` | `sha256(store ‖ SubscriptionTransaction.id)`: the store's own transaction ID of the payment covering now | **the budget row**: one row per paid period                        |
| `lineage_key` | `sha256(store ‖ RevenueCat subscription.id)`                                                             | linking renewals, and the device set (up to 3) of one subscription |

- The budget follows **the payment**, not a customer, an RC ID or a device. Reinstall, Restore, a new `rc_id` or an ownership move all point at the same store transaction, so they read the same row. A renewal is a new transaction, so a new row and a new budget.
- `SubscriptionTransaction.id` is "the ID of the subscription transaction in the store" [V], so the payment key is stable by definition. Apple's original transaction ID is **not** exposed by v2, so `lineage_key` uses RevenueCat's `subscription.id`. **Open (G2):** whether that ID stays stable across renewal and ownership transfer. Fallback: the earliest transaction ID of the subscription, found through the search endpoint `GET subscriptions?store_subscription_identifier=…`. The Worker must also keep the RevenueCat subscription ID itself (a hash cannot be queried); the column is added in P1.
- **Source of truth:** `GET subscriptions/{sub}/transactions` gives the transaction covering `now`: its store ID, `purchased_at`, `expiration_date` and `revenue_in_usd`. The period window is `[purchased_at, expiration_date + grace_ms[store])`; `grace_ms` is config and 0 until G2 (implementation decision 2). The RevenueCat subscription ID is kept in `periods.rc_subscription_id`.
- **Duplicate guard, fail closed:** creating a period runs `INSERT ... WHERE NOT EXISTS (another active period of the same lineage_key whose window overlaps by more than 1 hour)`. A conflict returns 503 `identity_conflict` and a high-severity log line, and **no second budget is created**.
- **G2 must pass before any ledger code runs against real RevenueCat data.** If the keys are not stable, Premium does not launch.
- **Excluded, all fail closed:** promotional or RevenueCat-granted entitlements and anything without store revenue; Family Sharing (never enabled); free trials and introductory offers (not offered); the Test Store and sandbox on production.

---

## 7. OpenRouter integration and model choice

**Shape.** A narrow OpenAI-compatible proxy at `POST /v1/chat/completions`. The Worker rebuilds the upstream body from an allowlist:

- **Allowed:**
  - `messages`: system, user, assistant and tool roles; text parts; `image_url` **data URLs only**, so OpenRouter never fetches arbitrary URLs
  - `response_format`: json_schema only, ≤ 32 KB
  - `tools` (≤ 32), `tool_choice`, `parallel_tool_calls`
  - `stream`
  - `temperature` (clamped)
  - `max_tokens` (clamped per feature)
  - `stop` (≤ 4)
- **Forced by the Worker** (per feature, derived from the body: implementation decision 3):
  - `model`, from `AI_CONFIG_JSON`. The client never chooses.
  - `provider: { zdr: true, data_collection: "deny", require_parameters: true, allow_fallbacks: false, max_price: {prompt, completion, image} }`
  - `reasoning` effort per feature, bounded
  - `user` = an 8-byte hash prefix of the lineage key
- **Rejected:** plugins, web search, `models`/`route` arrays, unknown keys. The error carries a field path and never echoes content.
- **Body cap:** 512 KB, before any D1 work (section 4).

**Streaming.** OpenRouter ends every stream with an extra chunk that carries `usage` just before `[DONE]`; mid-stream failures arrive as HTTP 200 with a final chunk carrying `error` and `finish_reason: "error"`, and SSE comments such as `: OPENROUTER PROCESSING` must be ignored. The tail-buffer parser handles all three.

**The model is changeable remotely.** `AI_CONFIG_JSON` is a plain-text Worker variable. It holds the model, the pinned prices, the per-feature `max_tokens`, `vision_enabled`, the image limits and the financial constants (section 8). The Worker **refuses to serve** if the config fails schema validation on a cold start (fail closed).

**Privacy invariant. It is never relaxed to reach a cheaper model.**

- In the code: the config validator rejects any config without `zdr: true` and `data_collection: "deny"`. A unit test pins it. No runtime flag turns it off.
- At the account: the OpenRouter privacy setting is **"ZDR only"**, which also excludes Safety Retention endpoints. A model with no ZDR endpoint must fail, not fall back.
- **Daily ZDR re-check:** a daily cron reads the public `GET https://openrouter.ai/api/v1/endpoints/zdr` and confirms that the configured model still has an endpoint with `safety_retention: false` at or under the pinned prices. If not, the **breaker opens** (fail closed). This is also how a provider change (such as Google's) is caught.
- Planned CSAM screening of inference requests (2026-10-27) also covers ZDR traffic; the consent copy must say so.
- **Consequence [V]: Google Gemini is not eligible.** Google requires Safety Retention since 2026-10-18.
- Changing the invariant later would need all of these: your explicit decision, new consent copy with a stored consent version so every user re-consents, privacy policy and store label updates, and a changelog entry.

**Shortlist** (live ZDR list and `/models` on 2026-11-20, [bench report](../../spikes/premium-p0/bench/REPORT.md); USD per million tokens, prompt / completion). The filter (vision input, `structured_outputs` and `tools`, `status` 0, `safety_retention` false, not Google) leaves **108 models**; the plan's candidates are:

| Model                            | ZDR endpoint                                                                      | Price       | Verdict                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------- |
| `openai/gpt-6-luna`              | Azure                                                                             | 0.10 / 0.50 | **eligible**; reasoning supported                                                  |
| `mistralai/mistral-small-2603`   | mistral zdr, /eu, /us                                                             | 0.15 / 0.60 | **eligible**; an EU endpoint exists                                                |
| `qwen/qwen3-vl-30b-a3b-instruct` | deepinfra, siliconflow                                                            | 0.15 / 0.60 | **eligible**; 16k max completion (the workout plan needs about 3.5k); no reasoning |
| `openai/gpt-5-nano`              | Azure                                                                             | 0.05 / 0.40 | **eligible**; likely weakest on photos                                             |
| `anthropic/claude-haiku-5.5`     | only Google Vertex (excluded) and a Bedrock endpoint without `structured_outputs` | n/a         | **not eligible** under ZDR only                                                    |
| `qwen/qwen3.8-flash`             | none listed                                                                       | n/a         | **not eligible**                                                                   |
| `google/gemini-3.5-flash-lite`   | Safety Retention only                                                             | n/a         | **not eligible** (reference: the current free-tier model)                          |

Decide before P2: ZDR is a retention promise, not a jurisdiction (several cheap endpoints run in other regions; the consent copy and privacy policy must name the provider actually pinned), and `flex` and `priority` are tiers of one endpoint with different prices, so `max_price` is pinned to the tier you intend.

**Benchmark** (`spikes/premium-p0/bench`, direct to OpenRouter, manual, never in CI; a **P0 gate**, G5 and G6). Priorities, in order: **(1) structured-output reliability, (2) tool calling, (3) image-analysis quality, (4) speed, (5) cost.**

- **Fixtures:** the app's real schemas and prompts: a meal photo, a label photo, two `trackMeal` texts, the workout plan, three coach chats (pt/en/es) and two tool round trips; plus the G6 photo set.
- **Measured per model:** strict-schema validity, macro accuracy against gold, refusal or empty rate, HTTP error rate, p50/p95 latency, time to first token with `--stream`, `usage.cost` and tokens. With 3 repetitions 99% is not measurable, so survivors run 10.
- **Pass bar:** ≥ 99% schema validity, macro accuracy within 5 points of the reference model, p95 under 15 s. The cheapest passing model becomes the default and the runner-up the fallback.
- Nutrition5k (CC BY 4.0, plated cafeteria meals at 640×480) cannot decide resolution above 640 px or the packaged, label and dim-light cases: those need about 20 of your own photos (`bench/fetch-dataset.md`).
- A live run costs about $2 to $4; a $5 key with `--max-usd` is enough (section 16).

---

## 8. Usage accounting, budgets and financial safety

### 8.1 The financial invariant

> For every paid period, the most Musclog can spend on inference, OpenRouter fee included, is at most `SPEND_SHARE` (0.5) of **that payment's net proceeds**.
>
> The other half covers refunds and chargebacks, exchange-rate moves, cost-estimation error, infrastructure and margin.

```
proceeds_u     = RevenueCat revenue_in_usd.proceeds     # after VAT/tax and store commission; RevenueCat estimates both
net_proceeds_u = proceeds_u × (1 − ESTIMATE_HAIRCUT 0.03)      # tax and commission are estimates
                           × (1 − FX_HAIRCUT 0.05)             # USD at transaction time vs the later EUR payout
                 − RC_FEE_RATE 0.01 × gross_u × 1.27           # RevenueCat 1%, always deducted, VAT-inclusive basis assumed
                 − INFRA_PER_PERIOD_U                          # 0 on Free; config, so a paid plan is charged to proceeds first
spendable_u    = floor(net_proceeds_u × SPEND_SHARE)           # total OpenRouter cost, fee included
cap_u          = floor(spendable_u / OPENROUTER_FEE 1.055)     # model spend, which is what usage.cost reports
early_cap_u    = floor(cap_u × EARLY_SHARE 0.25)               # first 3 days of a lineage's first paid period (refund-prone window)
daily_cap_u    = floor(cap_u × DAILY_SHARE 0.4)                # against a stolen token or a runaway loop
cap_u          = min(cap_u, MAX_CAP_U)                         # MAX_CAP_U defaults to 2,000,000 ($2.00)
```

- Amounts are integer micro-USD. RevenueCat reports proceeds in USD at transaction time.
- RevenueCat is free below $2.5K MTR and then takes 1% of all MTR. The formula deducts it **always**, even below the threshold, so crossing it changes nothing. Whether MTR is VAT-inclusive is not documented, so the plan assumes it is (`× 1.27`).
- Costs that are not tied to one subscriber (Apple Developer Program $99/year, Google Play $25 once) are business costs, listed in section 14.

**Worked examples** (€4.99, 21% VAT, 1 EUR ≈ 1.16 USD, so gross excluding VAT ≈ $4.79; the figures are estimates):

|                                                  | Apple 15% (Small Business Program, or a renewal after year one) | Apple 30% (year one, no Program) |
| ------------------------------------------------ | --------------------------------------------------------------- | -------------------------------- |
| Proceeds                                         | ≈ $4.07                                                         | ≈ $3.35                          |
| After haircuts (× 0.97 × 0.95), minus RevenueCat | ≈ **$3.69** net                                                 | ≈ **$3.03** net                  |
| `spendable` (50%)                                | ≈ $1.85                                                         | ≈ $1.51                          |
| `cap` (model spend, ÷ 1.055)                     | ≈ **$1.75**                                                     | ≈ **$1.44**                      |
| Early cap (25%)                                  | ≈ $0.44                                                         | ≈ $0.36                          |

Apple's commission is 30% in year one unless the Small Business Program applies (enrolment is not yet confirmed); because the cap follows proceeds, a higher commission lowers the cap by itself. Google Play charges 15% (10% service fee plus 5% billing) on subscriptions.

**Fail-closed inputs:**

- If `gross` or `proceeds` is missing, null, zero or negative, the cap is 0 (403 `revenue_unverified`). A transaction listed without revenue is retried at the next session.
- G9 must show that proceeds appear within minutes of a purchase or renewal. If they are often late, the fallback is `PROCEEDS_FLOOR_U`, **assuming 30% Apple commission until Small Business Program enrolment is confirmed and 27% VAT: about €2.65 equivalent** (€4.99 / 1.27 × 0.70, minus 1% of €4.99, × 0.98), with availability limited to storefronts at or above it. Until proceeds arrive, the first 3 days use the early cap computed from the floor.
- **The database enforces it too.** Period rows store `net_proceeds_u` and carry `CHECK (cap_u * 1055 <= net_proceeds_u * 500)`. There are no `MAX(0, …)` clamps anywhere: a bug must surface as a failed batch, not be hidden.
- **OpenRouter fee:** 5.5% on credit purchases, **with a $0.80 minimum** [V]. The factor 1.055 holds only while top-ups are large enough that the minimum does not dominate, so **every top-up is at least $15** (the fee stays 5.5% above about $14.5). The runbook enforces it, and 1.055 is also used in the global check.

### 8.2 Per-request reservation, atomic and exactly-once

The SQL below is `spikes/premium-p0/ledger/ledger.ts`, copied exactly (20/20 tests on Miniflare, [ledger report](../../spikes/premium-p0/ledger/REPORT.md)). A D1 `batch()` is one transaction.

1. **Bound the request.**
   - Input: `ceil(text_utf8_bytes / 2) + images × IMAGE_TOKENS_MAX + (schema + tools bytes) / 2`. This is deliberately pessimistic.
   - Output: the clamped `max_tokens`, with reasoning included.
   - `r = (in × p_prompt + out × p_completion) × PRICE_SLACK (1.1) + per-request fees`, using the **pinned** prices. `max_price` is set to the same prices, so routing cannot exceed them.
   - `IMAGE_TOKENS_MAX` comes from G6. Until it does, hosted vision is off.
2. **Idempotency key (per logical request).** The app creates one `Idempotency-Key` (a UUID) for each logical request, at the top of `withLlmRetry` (section 11). Every attempt of that request, `withLlmRetry`'s own and the OpenAI SDK's internal ones, reuses it. It is `req_id`. A request without the header gets 400. Bound to the allowlisted body hash (stored in `reservations.body_hash`), a reused key with a different body returns 422 instead of replaying someone else's answer.
3. **Reserve: one `batch()` of three statements.** `GUARDS` is shared by the insert and the re-admission:

```sql
-- GUARDS
NOT EXISTS (SELECT 1 FROM meta WHERE key = 'breaker' AND value = 'open')
AND COALESCE((SELECT value FROM meta WHERE key = 'daily_full'), '0') = '0'
AND EXISTS (SELECT 1 FROM devices d WHERE d.rc_id = :rc AND d.status = 'active')
AND EXISTS (SELECT 1 FROM periods p WHERE p.payment_key = :pk AND p.status = 'active'
      AND :now >= p.period_start AND :now < p.period_end
      AND p.spent_u + p.reserved_u + :r <= CASE WHEN :now < p.early_until THEN p.early_cap_u ELSE p.cap_u END
      AND (CASE WHEN p.day = :day THEN p.day_spent_u ELSE 0 END) + p.reserved_u + :r <= p.daily_cap_u
      AND (CASE WHEN p.day = :day THEN p.day_requests ELSE 0 END) < :max_requests_per_day
      AND p.inflight < :max_inflight)

-- 1. RESERVE_INSERT (body_hash added in P1, implementation decision 4)
INSERT OR IGNORE INTO reservations
  (payment_key, req_id, body_hash, reserved_u, state, hold_token, created_at, expires_at)
  SELECT :pk, :id, :bh, :r, 'pending', :hold, :now, :exp WHERE ${GUARDS}

-- 2. RESERVE_PERIOD
UPDATE periods SET
    reserved_u = reserved_u + (SELECT reserved_u FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'pending'),
    inflight = inflight + 1, last_activity_at = :now
  WHERE payment_key = :pk
    AND EXISTS (SELECT 1 FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'pending')

-- 3. RESERVE_HOLD
UPDATE reservations SET state = 'held'
  WHERE payment_key = :pk AND req_id = :id AND state = 'pending'
```

The `pending` state makes statement 2 fire exactly once: a replayed batch finds no `pending` row. For a request whose earlier attempt was `refunded`, statement 1 is replaced by:

```sql
-- RESERVE_READMIT
UPDATE reservations SET state = 'pending', hold_token = :hold, reserved_u = :r,
  created_at = :now, expires_at = :exp, settled_u = NULL, settled_at = NULL
  WHERE payment_key = :pk AND req_id = :id AND state = 'refunded' AND body_hash = :bh AND ${GUARDS}
```

`:hold` is a fresh random token per attempt and `:exp` is `:now + 120000`. After the batch the Worker reads the reservation row. **Admitted only when `hold_token = :hold AND state = 'held'`** (`isAdmitted`), so a replay after settlement is never admitted:

| Reservation row after the batch                                 | Result                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Own token, `held`                                               | admitted                                                                                                                                                                                                                                                                                                                                                                           |
| Other token (or own token still `pending`), `held` or `pending` | 409 `in_progress` with `Retry-After`; no second upstream call                                                                                                                                                                                                                                                                                                                      |
| `settled` or `expired`                                          | 409 `already_processed`; no charge, no upstream call                                                                                                                                                                                                                                                                                                                               |
| `refunded`                                                      | re-admitted by `RESERVE_READMIT` (10 concurrent re-admits admit exactly one)                                                                                                                                                                                                                                                                                                       |
| No row                                                          | diagnosed in order: breaker open → 503 `hosted_disabled`; `daily_full` → 503 `daily_full`; no active device → 401 `unknown_device`; no or expired period → re-verify with RevenueCat and create the next period (one retry), else 403; cap reached → 402 `budget_exhausted` with `resets_at`; daily cap or `max_requests_per_day` → 402 `daily_limit`; `max_inflight` → 429 `busy` |

4. **Call upstream**, with an idle timeout of 30 s on streams and 55 s otherwise. If the client disconnects, the upstream call is aborted.
5. **Settle: one `batch()` of two statements, period first**, in `ctx.waitUntil` so a disconnect cannot cancel it. Both are guarded by `state = 'held'`, so a replay changes nothing (settle replayed 6× charged once):

```sql
-- SETTLE_PERIOD
UPDATE periods SET
    spent_u = spent_u + :a,
    reserved_u = reserved_u - (SELECT reserved_u FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'held'),
    inflight = inflight - 1,
    day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + :a,
    day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1,
    day = :day
  WHERE payment_key = :pk
    AND EXISTS (SELECT 1 FROM reservations WHERE payment_key = :pk AND req_id = :id AND state = 'held')

-- SETTLE_RES
UPDATE reservations SET state = :final, settled_u = :a, settled_at = :now
  WHERE payment_key = :pk AND req_id = :id AND state = 'held'
```

**Outcome table** (`:final` / `:a`; a refund is settled with `:a` = 0):

| Outcome                                                            | `:final`   | `:a` (charged)                                                                                                                                                      |
| ------------------------------------------------------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success                                                            | `settled`  | `usage.cost` (from the final SSE chunk via a 2 KB tail buffer, or from the body)                                                                                    |
| Upstream HTTP error before any token (OpenRouter does not bill it) | `refunded` | 0                                                                                                                                                                   |
| Timeout, `length`, empty or refused output                         | `settled`  | `usage.cost` if known, otherwise `r`                                                                                                                                |
| Stream cut, so no usage arrived                                    | `settled`  | `total_cost` from `generation?id=` (≤ 3 tries in `waitUntil`), otherwise `r`                                                                                        |
| **Actual cost > `r`**                                              | `settled`  | the full actual cost: an _overrun_. It may push `spent_u` past `cap_u` (the next reserve is refused), is counted in `meta`, and 3 overruns in 24 h open the breaker |

**Crashes and stale holds.** A held row past `expires_at` still counts in `reserved_u`, so it keeps blocking budget (fail closed). The 15-minute cron reads periods with `period_end > now - 1 day AND reserved_u > 0 AND last_activity_at < now - 5 min`, then each such period's `held` reservations that are past `expires_at`, and runs the sweep batch. It charges the row's **own** `reserved_u` and is guarded by `state = 'held' AND expires_at < :now`, so it cannot race a late settle, and it cannot expire a refunded hold that was re-admitted since:

```sql
-- HELD_EXPIRED
payment_key = :pk AND req_id = :id AND state = 'held' AND expires_at < :now

-- SWEEP_PERIOD
UPDATE periods SET
    spent_u = spent_u + (SELECT reserved_u FROM reservations WHERE ${HELD_EXPIRED}),
    reserved_u = reserved_u - (SELECT reserved_u FROM reservations WHERE ${HELD_EXPIRED}),
    inflight = inflight - 1,
    day_spent_u = (CASE WHEN day = :day THEN day_spent_u ELSE 0 END) + (SELECT reserved_u FROM reservations WHERE ${HELD_EXPIRED}),
    day_requests = (CASE WHEN day = :day THEN day_requests ELSE 0 END) + 1,
    day = :day
  WHERE payment_key = :pk AND EXISTS (SELECT 1 FROM reservations WHERE ${HELD_EXPIRED})

-- SWEEP_RES
UPDATE reservations SET state = 'expired', settled_u = reserved_u, settled_at = :now
  WHERE ${HELD_EXPIRED}
```

**`daily_full`** (cron, one statement; writes only when the value changes, 2 writes per flip):

```sql
INSERT INTO meta (key, value)
  SELECT 'daily_full', CASE WHEN COALESCE(SUM(CASE WHEN day = ?1 THEN day_requests ELSE 0 END), 0) >= ?2 THEN '1' ELSE '0' END
  FROM periods WHERE period_end > ?3
ON CONFLICT(key) DO UPDATE SET value = excluded.value WHERE value != excluded.value
```

(`?1` = today's day key, `?2` = `GLOBAL_MAX_REQUESTS_PER_DAY`, `?3` = `now - 1 day`.)

**Prune** (daily): reservations that are `settled`, `refunded` or `expired` with `settled_at` older than 7 days; periods with `period_end` older than 60 days.

**Retries, in summary:**

- A retry with the same key can never be charged twice.
- A new request (new key) is charged.
- The rare lost response (the first attempt settled but the reply never arrived) shows "That answer was lost, please send again". It is a new, charged request.
- `max_inflight = 2` limits how much client retries can pile up; the Worker sends `x-should-retry: false` on 402, 403 and 409 so the OpenAI SDK does not retry them (it retries 409 by default).

### 8.3 Global limits and reconciliation

| Layer                                                       | How                                                                                                                                                                                                                    | Kind                                             | Reaction                                                                           |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Prepaid OpenRouter credits, **no auto top-up**              | You top up by hand, **at least $15 each time**, to at most `SPEND_SHARE × expected net proceeds` for the month                                                                                                         | **hard** (upstream)                              | OpenRouter returns 402: the breaker opens, the app shows "temporarily unavailable" |
| Dedicated inference key `limit` with `limit_reset: monthly` | Set by hand to ≈ the monthly top-up                                                                                                                                                                                    | hard                                             | Same (a key limit returns 403)                                                     |
| `daily_full`                                                | Cron (15 min): today's `Σ day_requests` over live periods ≥ `GLOBAL_MAX_REQUESTS_PER_DAY` (9,900)                                                                                                                      | admission stop (≤ 15 min lag, overshoot bounded) | 503 `daily_full` until the next UTC day                                            |
| Ledger spend-to-proceeds                                    | Cron: `Σ(spent+reserved)` over current periods ≤ `GLOBAL_SHARE` (0.55) × `Σ net_proceeds` of non-revoked periods, with the 1.055 fee applied. A refunded period's proceeds count as 0                                  | breaker (≤ 15 min lag)                           | `meta.breaker = open`                                                              |
| ZDR re-check                                                | Daily cron: the configured model still has a non-`safety_retention` ZDR endpoint at or under the pinned prices (public list)                                                                                           | breaker                                          | Open (fail closed)                                                                 |
| Daily reconciliation                                        | Cron at 00:30 UTC: the increase of OpenRouter `GET /api/v1/key` cumulative `usage` since the last run vs `Σ settled_u` settled in that window (implementation decision 1). A gap above 3% + $0.50 means unmetered cost | breaker + log                                    | Open; investigate                                                                  |
| Overruns                                                    | 3 in 24 h                                                                                                                                                                                                              | breaker                                          | Open                                                                               |
| Per-user                                                    | `max_requests_per_day` 60, `max_inflight` 2, `daily_cap_u`, early cap                                                                                                                                                  | admission                                        | 402 / 429                                                                          |
| Breaker reset                                               | Manual: `wrangler d1 execute ... UPDATE meta` (runbook)                                                                                                                                                                | n/a                                              | n/a                                                                                |

### 8.4 Refunds, chargebacks, exchange rates and unexpected costs

- **Refunds and chargebacks.** Apple decides refunds at its sole discretion and the developer reimburses the full price, whatever the commission. The early cap limits what a new subscriber can spend before most refunds happen (about $0.44 at the 15% example). Re-verification at session mint (≤ 6 h, plus the 1 h token) marks a refunded period `revoked`; the global check counts a revoked period's proceeds as zero. The loss per refund is bounded by what was spent before revocation, at most one period's cap, and the refund itself is lost revenue.
- **Exchange rates.** Costs and net proceeds are both USD; the 5% FX haircut covers the later EUR payout (Apple's bank FX differential is at least 2%).
- **Price changes and unexpected costs.** Pinned prices plus `max_price` make a price rise **fail closed**. Reservations include per-request fees. Cloudflare cannot bill (Free, no card).

### 8.5 Can the ceiling be absolute?

- **Per period, against what we know: yes.** Admission is atomic, and the guard compares spent + reserved + new against the cap before any spend.
- **Absolute in money terms: no.** The exceptions:
  1. A provider bills more than our pessimistic bound. It is caught as an overrun, bounded per request, and trips the breaker.
  2. OpenRouter reports cost wrongly. Daily reconciliation catches it.
  3. A refund or chargeback arrives after the spend.
  4. Proceeds are later restated, or RevenueCat's tax and commission estimates are off by more than the 3% haircut.
  5. A RevenueCat or store bug grants access without payment. It has no proceeds, so the cap is 0, except for a proceeds figure that is reported and later reversed.
- **What is absolute:** total loss ≤ the prepaid balance, which is why top-ups are manual and sized to the month.

### 8.6 Exhaustion UX

- A 402 includes `{ used_pct, resets_at }`, and every response carries `X-Musclog-Budget-Remaining-Pct`.
- The app shows "This period's Premium AI allowance is used up. It renews on {date}. Musclog keeps working, and you can use your own key or the free tier." with a one-tap switch. `daily_full` shows a separate "Premium AI is at capacity until tomorrow (UTC)" message.
- **There is no silent fallback to another provider**, because the data recipients differ.
- A warning appears at 80%.

---

## 9. D1 schema (`0001_init.sql`)

**Built:** `services/premium-worker/migrations/0001_init.sql` is the schema below with every revision 3 change listed after it, plus `periods.rc_subscription_id`, `reservations.body_hash` and `CHECK (net_proceeds_u <= proceeds_u)` (implementation decisions 4 and 6). The spike's schema, which the ledger tests first ran against:

```sql
CREATE TABLE devices (
  rc_id        TEXT PRIMARY KEY,
  public_key   BLOB NOT NULL,
  lineage_key  TEXT NOT NULL,
  status       TEXT NOT NULL CHECK (status IN ('active','revoked')),
  verified_at  INTEGER NOT NULL,
  created_at   INTEGER NOT NULL
);
CREATE UNIQUE INDEX devices_one_active ON devices(lineage_key) WHERE status = 'active';

CREATE TABLE periods (
  payment_key   TEXT PRIMARY KEY,
  lineage_key   TEXT NOT NULL,
  store         TEXT NOT NULL CHECK (store IN ('app_store','play_store')),
  period_start  INTEGER NOT NULL,  period_end INTEGER NOT NULL,
  proceeds_u    INTEGER NOT NULL CHECK (proceeds_u > 0),
  cap_u         INTEGER NOT NULL,  early_cap_u INTEGER NOT NULL,  early_until INTEGER NOT NULL,
  daily_cap_u   INTEGER NOT NULL,
  spent_u       INTEGER NOT NULL DEFAULT 0,  reserved_u INTEGER NOT NULL DEFAULT 0 CHECK (reserved_u >= 0),
  inflight      INTEGER NOT NULL DEFAULT 0 CHECK (inflight >= 0),
  day TEXT NOT NULL DEFAULT '',  day_spent_u INTEGER NOT NULL DEFAULT 0,  day_requests INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  last_activity_at INTEGER NOT NULL DEFAULT 0,
  created_at    INTEGER NOT NULL,
  CHECK (cap_u * 1055 <= proceeds_u * 500)
) WITHOUT ROWID;
CREATE INDEX periods_lineage ON periods(lineage_key);
CREATE INDEX periods_end ON periods(period_end);   -- lets cron and prune touch only live/old periods

CREATE TABLE reservations (
  payment_key TEXT NOT NULL,  req_id TEXT NOT NULL,
  reserved_u  INTEGER NOT NULL,  settled_u INTEGER,
  state       TEXT NOT NULL CHECK (state IN ('pending','held','settled','refunded','expired')),
  hold_token  TEXT NOT NULL,
  created_at  INTEGER NOT NULL,  expires_at INTEGER NOT NULL,  settled_at INTEGER,
  PRIMARY KEY (payment_key, req_id)
) WITHOUT ROWID;

CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

**Revision 3 changes the spike's schema does not yet have** (decided here, written in P1; the ledger tests do not depend on them):

- `periods`: add `net_proceeds_u INTEGER NOT NULL CHECK (net_proceeds_u > 0)` and make the check `CHECK (cap_u * 1055 <= net_proceeds_u * 500)`; `proceeds_u` stays as the recorded RevenueCat figure.
- `devices` (up to 3 per subscription): **drop the `devices_one_active` unique index**; add `last_nonce_ts INTEGER NOT NULL DEFAULT 0` (monotonic nonce, also the LRU order); the limit of 3 is enforced in the enroll batch. Open: the column that keeps the RevenueCat subscription ID for re-verification (6.2).
- `meta` keys: `breaker`, `daily_full`, `accepting_new`, overrun counters.

**What is stored and pruned:**

- No prompts, responses, images, IPs or store receipts are stored.
- Reservations are pruned after 7 days (amounts only), periods after 60 days. Monthly totals go to logs.
- Migrations are additive only.
- The `CHECK` constants follow the config (SPEND_SHARE 0.5 → 500, fee 1.055 → 1055); a config change needs a new migration.
- Size, measured: about 121 B per reservation row and 336 B per period row with both secondary indexes; plan on 150 B and 350 B.

---

## 10. Backend API contracts

All errors use `{ error: { code, message, retry_after?, resets_at? } }`. Upstream bodies are never echoed or logged. **409, 402 and 403 responses carry `x-should-retry: false`.**

| Endpoint                    | Auth                                                           | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /v1/config`            | none                                                           | `{ enabled, accepting_new, vision_enabled, image: {maxPx, maxBytes, quality}, minAppVersion }`                                                                                                                                                                                                                                                                                                                                                               |
| `GET /v1/challenge`         | none                                                           | `{ nonce }`: a server-issued, timestamped HMAC, valid for 2 min                                                                                                                                                                                                                                                                                                                                                                                              |
| `POST /v1/enroll`           | proof of key                                                   | `{ rc_id, public_key, nonce, signature }` → `{ session_token, expires_at, period: {used_pct, resets_at}, devices: {count, max} }`. Errors: 400 `id_key_mismatch`, 401 `bad_signature` / `stale_nonce`, 403 `subscription_required` (nothing qualifying: wrong store, environment, ownership or product, or `customer_id != rc_id`) / `revenue_unverified`, 503 `identity_conflict` / `entitlement_unavailable` (also: more than one qualifying subscription) |
| `POST /v1/session`          | device signature                                               | `{ rc_id, nonce, signature }` → the same token. 401 `unknown_device` (revoked or evicted), 401 `stale_nonce`                                                                                                                                                                                                                                                                                                                                                 |
| `POST /v1/chat/completions` | Bearer session token + `Idempotency-Key` (per logical request) | the OpenAI subset → JSON or SSE. 400, 401, 402 `budget_exhausted` / `daily_limit`, 403, 409 `in_progress` / `already_processed`, 413, 422 (key reused with another body), 429 `busy`, 502, 503 `hosted_disabled` / `daily_full`, 504                                                                                                                                                                                                                         |
| `GET /v1/usage`             | Bearer                                                         | `{ used_pct, resets_at, status: 'active' \| 'exhausted' \| 'revoked', devices: {count, max} }`: a percentage only, never money. **This, with `/v1/session`, is the app's source of Premium status.**                                                                                                                                                                                                                                                         |

**Logging.** Structured events only: `{route, status, code, latency_ms, lineage_prefix, model, tokens, cost_u, overrun}`. Never logged: content, tokens, keys, `rc_id`s or IPs. Sampling is 0.1, apart from error and overrun lines.

---

## 11. Mobile integration

1. **Dependencies:**
   - Add `react-native-purchases` with `npx expo install`, then `npm run prebuild` and a dev-client rebuild. Add `@noble/curves` (it brings `@noble/hashes` 2.x import paths; check for duplicates with the transitive 1.8.0).
   - On web, Premium is hidden through `.web.ts` stubs, which keeps `platformModuleParity` passing.
   - Environment variables per EAS profile: `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` and `EXPO_PUBLIC_HOSTED_AI_BASE_URL`, all public values.
2. **Identity:** never call `Purchases.configure` anonymously or at boot; configure lazily with `appUserID = rc_id`. The key is stored with `keychainAccessible: WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and the signed message is the domain-separated string in 6.1 (`randomUUID` and hashing from `expo-crypto`).
3. **Provider:**
   - Add `hosted` to every table listed in section 2. It goes **first** in priority when selected.
   - The probe returns `{ provider: 'hosted', baseUrl, apiKey: <session token>, model: 'musclog-hosted' }`. It returns null when the setting is off, enrollment is missing, or the platform is web.
   - **Idempotency key.** `withLlmRetry` creates `idempotencyKey = randomUUID()` once, before its loop, when the provider is `hosted`, and passes it to the attempt callback as a third argument (`request(signal, touch, { idempotencyKey })`; existing callbacks ignore it). The six OpenAI call sites pass it as a per-request option, `create(payload, { signal, headers: { 'Idempotency-Key': key } })`, through one helper. **It is never in `defaultHeaders`**, which `buildOpenAIClient` fills only with the static `X-Musclog-Client`. SDK-internal retries reuse the request options, and `withLlmRetry` attempts share the variable, so one logical request uses one key. Separate logical requests get separate keys with no extra code: the repair retry in `runOnboardingTurn`, each `estimateMissingIngredients` call in `trackMealWithThinking`, and every user resend.
   - `HostedAiService` keeps the token cached and refreshes it 5 min before expiry. On 401 `unknown_device` it reports "removed from this subscription" and never re-enrolls silently. It never runs at module scope or at boot.
4. **Errors:**
   - New `HostedBudgetError extends AiCreditsError` for 402, `HostedSubscriptionError` for 403, `HostedUnavailableError` for 5xx, 1027 and `daily_full`, and `HostedBusyError` for 409 `in_progress` and 429. The Worker's `x-should-retry: false` stops the SDK from retrying 409, so `withLlmRetry` owns the backoff.
   - `already_processed` maps to a specific "please resend" message.
   - These errors are kept out of Sentry. `classifyError` gets recovery actions: renew, restore, or switch to BYOK.
5. **Premium status** comes from `/v1/session` and `/v1/usage`, never from local `CustomerInfo` (after an ownership move RevenueCat shows the old device as not entitled).
6. **Images:** the app resizes and compresses to the `/v1/config` values that G6 selects, inside the 512 KB body cap. The resize applies to the hosted path only, so BYOK is unchanged.
7. **UI:**
   - `PremiumCard` in AI settings.
   - `PremiumModal`: a one-sentence benefit, the store price string, Subscribe (hidden when `accepting_new` is false), **Restore purchases**, the renewal and cancellation disclosures, Terms and Privacy links, "One subscription works on up to 3 of your devices", and "iOS and Android subscriptions are separate".
   - A usage bar, a devices line (`count` of `max`), Manage subscription, and "Reset Premium on this device".
   - A consent `ConfirmationModal` that names OpenRouter and states ZDR, with its consent version stored.
   - States to cover: loading, offline, purchase cancelled or pending, restore found nothing, device removed (LRU), exhausted, at capacity today, unavailable.
   - The Premium row in `AINotConfiguredModal` and `ai-provider.tsx`. Premium never blocks any existing feature.
8. **Restore and import:** `useHostedAi` is forced off when a backup is restored. The key stays in SecureStore, outside backups and exports.
9. **Stores:**
   - Apple: a subscription group with Family Sharing OFF (it cannot be turned off once on), no offer codes or introductory offer, review notes, 3.1.2 disclosures (including how the subscription works on all of the user's devices, 3.1.2(a)), a Restore button, updated privacy labels, and the App Store guard run.
   - Google: a base plan, Play Billing (the RC SDK adds the `BILLING` permission; re-run prebuild), the Data safety form, license testers, and RevenueCat's service account and RTDN.
   - Listing text in every locale follows the existing rules and scripts. Publishing stays manual.
10. **i18n:** every key in 10 locales, with flat plural keys. Then `generate-lang`, `check-translations` and `check-locale-consistency`.

---

## 12. Security, privacy and residual risks

**Handled:**

- Stolen RevenueCat IDs and replayed requests (6.1)
- No secret in the app (only public values ship)
- Session theft (limited to 1 h and one device)
- Sharing (3 devices per subscription, one budget per payment)
- SSRF (no URL images)
- Proxy abuse (the allowlist, clamped `max_tokens`, no plugins or search, 512 KB cap)
- Content-free logs
- No secrets in Terraform state
- Health data and photos only through ZDR-only routing, with named consent and a daily re-check
- Duplicate budgets (6.2 guard) and double charges (8.2)
- Financial invariant (section 8)

**Residual risks** (cannot be fully eliminated; each is bounded and has a monitor):

| Risk                                                                                                                                                                        | Bound or mitigation                                                                                                                                      | Monitor                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Device compromise steals the private key                                                                                                                                    | One period's cap; the user can reset                                                                                                                     | n/a                                  |
| Refunds or chargebacks after spend                                                                                                                                          | Early cap ≈ $0.44 (≈ $0.36 at 30% commission); refunds are at Apple's discretion and the developer reimburses the full price, so the revenue is lost too | refund count in the global check     |
| Apple commission is 30% in year one without the Small Business Program                                                                                                      | Caps follow net proceeds automatically; section 14 shows both                                                                                            | G7                                   |
| Provider bills more than our bound, or OpenRouter cost is wrong                                                                                                             | Overrun accounting; daily reconciliation; prepaid balance                                                                                                | overrun log; reconciliation breaker  |
| Proceeds missing or restated by RevenueCat                                                                                                                                  | Cap 0 when missing; haircuts; floor fallback only after G9                                                                                               | `revenue_unverified` rate            |
| **Billing identity not stable (G2 fails), or Apple's lineage ID is not verified** (v2 does not expose the original transaction ID; `subscription.id` stability is unproven) | **No launch**; fallback is the earliest transaction ID                                                                                                   | G2                                   |
| RevenueCat restore-behavior setting changed                                                                                                                                 | Enrollment fails closed (`subscription_required`)                                                                                                        | enroll error rate                    |
| **App Review reads 3.1.2(a) differently** (the 3-device model must satisfy "must work on all of the user's devices")                                                        | Wording drafted and tested in TestFlight review; a device limit may be questioned                                                                        | G7                                   |
| Free-tier outage (D1 or request limit, or a flood)                                                                                                                          | Fail closed, no cost; sign-ups close at `MAX_SUBSCRIBERS`                                                                                                | 1027 and D1 error counts             |
| **`daily_full` shuts everyone out until 00:00 UTC** if the global allowance is consumed (a bounded group of heavy users, or an abuser)                                      | Per-user ceiling 60/day; margin; BYOK keeps working                                                                                                      | `daily_full` flips                   |
| **Miniflare differs from production D1** (billing counts for index writes and scans, concurrency, batch limits are unverified; sweep and flag read figures could double)    | 40% headroom; re-run the ledger tests against staging D1 (G10)                                                                                           | measured rows per request on staging |
| Admission overshoots `GLOBAL_MAX_REQUESTS_PER_DAY` within one cron interval                                                                                                 | 40% headroom                                                                                                                                             | n/a                                  |
| Client timeout retry is billed twice                                                                                                                                        | Same-key retries are not; resends are; in-flight limit 2                                                                                                 | n/a                                  |
| ZDR pool too small or expensive, or a provider drops ZDR                                                                                                                    | Daily re-check opens the breaker; privacy is never relaxed                                                                                               | G5, daily check                      |
| Cross-store moves are impossible without accounts                                                                                                                           | Stated in the UI                                                                                                                                         | n/a                                  |
| Store review rejection                                                                                                                                                      | G7 drafts                                                                                                                                                | n/a                                  |
| Vendor changes (pricing, APIs, Logs repricing on 2026-12-01)                                                                                                                | Pinned config; gates re-run before launch                                                                                                                | n/a                                  |
| Single OpenRouter account                                                                                                                                                   | Dedicated limited key, prepaid, kill switch                                                                                                              | n/a                                  |

---

## 13. Testing strategy (with requirement mapping)

**Setup.** The Worker uses Vitest with the Workers pool (`@cloudflare/vitest-plugin` 1.8.5, which replaces the deprecated `vitest-pool-workers`): a real Miniflare D1, and injected fake RevenueCat and OpenRouter clients (the plugin no longer ships `fetchMock`; implementation decision 10), so tests use no network and no credits. App tests use Jest. Manual sandbox checklists cover the stores. Only the benchmarks spend credits, and they are manual.

**The P0 spikes are the seeds of these tests**: `spikes/premium-p0/ledger` (20 tests: reserve, settle, sweep, `daily_full`, CHECKs), `crypto` (29 tests in Node and workerd), `idempotency` (the 12 tests of its section 5) and `cpu` (the body-size harness). P1 moves them into the Worker's test suite instead of rewriting them.

| Requirement              | Automated tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Acceptance criterion                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **1 Auth**               | Mismatched `rc_id`/key gives 400. A stolen `rc_id` with the attacker's key gives 400. The right key and wrong signature give 401. A high-S signature is rejected. The signature for `enroll` replayed as `session` is rejected (the purpose is in the signed string). A nonce older than 2 min, or not newer than `last_nonce_ts`, is rejected (single use). A forged or expired token gives 401. **Multi-device:** the 4th enrollment revokes the least recently used device; a device stays valid after RevenueCat moves ownership; a revoked device gets 401 `unknown_device`. **Enroll filters:** `customer_id != rc_id`, `store = promotional`/`test_store`, sandbox environment on production, `ownership != purchased`, an unknown `product_id`, and more than one qualifying subscription are each refused                                                                                                                       | No test path lets a party without the private key or a store-verified purchase obtain a session                   |
| **2 Accounting**         | 100 parallel reserves on a nearly-full period never exceed the cap (exactly 37 of 100 admitted at cap 3,750 and r = 100). The same `Idempotency-Key` ×N gives exactly one charge. `in_progress` and `already_processed`. Re-admission after a refund admits exactly one of 10 concurrent attempts. **Idempotent settlement replay:** the reserve batch replayed 5× and the settle batch 6× change the period once; the revision 2 double-charge reproduction stays as a regression test. **Sweep race:** the sweep racing 20 settles charges each reservation once; a late settle after a sweep, and a second sweep, are no-ops; a stale sweep leaves a re-admitted refunded hold untouched. A crash after reserve leaves the sweep to charge `r` once. `isAdmitted` truth table. **`daily_full`:** admitted below the global max, refused at it with zero writes, reopened the next day. A D1 failure on reserve makes no upstream call | `spent + reserved ≤ cap` after every test; every reservation reaches exactly one final state                      |
| **3 Billing identity**   | The same payment seen from two `rc_id`s gives one period row. A renewal gives a new row with a new budget. An overlapping duplicate period gives 503 `identity_conflict` with no row. Reinstall plus restore (simulated) continues the same row. Manual G2 matrix on both stores (section 15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | G2 matrix all green; zero duplicate rows in staging                                                               |
| **4 Images**             | Resize pipeline output within `/v1/config` limits and the 512 KB body cap; more than the allowed images gives 400; `IMAGE_TOKENS_MAX` bound holds for every G6 fixture (overrun test)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | G6 report shows accuracy non-inferior to full resolution at the chosen setting                                    |
| **5 Free tier**          | A load test counts D1 rows written per request from the D1 result `meta` (6 on average) and rows read (about 22). A projection test at `MAX_SUBSCRIBERS` with the mix profile stays at or below 60% of the limits. `accepting_new` flips at the threshold. A D1 daily-limit error simulation gives 503 with no upstream call                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | CI fails on a write-count regression; the staging account has no paid plan or card; G10 re-run against staging D1 |
| **6 Privacy**            | The config validator rejects a missing or false `zdr` or `data_collection` (the Worker refuses to serve). Every upstream body carries both (assert on the mocked request). URL images are rejected. Logs never contain content (log capture test). The daily ZDR re-check opens the breaker when the model's only ZDR endpoint becomes `safety_retention`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | G5 probe: a non-ZDR model gives an error, not a response; account setting "ZDR only" verified                     |
| **7 Financial**          | **Fee-formula property test over random gross, proceeds and commission, with Apple at 15% and at 30% commission:** `cap_u × 1055 ≤ net_proceeds_u × 500`, `net_proceeds_u ≤ proceeds_u`, and a worked-example table pinned (≈ $1.75 and ≈ $1.44). The database `CHECK` rejects a violating row. Missing or negative proceeds give cap 0 (403). The early cap applies in the first 3 days of the first period only. A refund (re-verify shows revoked) stops spending. The global check, reconciliation drift, an OpenRouter 402 and 3 overruns each open the breaker. Breaker open means no upstream calls                                                                                                                                                                                                                                                                                                                               | Staging dry run: a simulated month at 120% load never spends more than the caps; breaker trips verified           |
| **8 Client idempotency** | With a mocked `fetch` through a real `OpenAI` client: one logical request that fails twice with 503 then succeeds carries the **same** `Idempotency-Key` on every HTTP attempt (`withLlmRetry` retries, a timeout retry and SDK-internal retries, with differing `X-Stainless-Retry-Count`); two sequential logical calls carry **different** keys; the six call sites (`sendViaOpenAI`, `generateText`, `generateTextWithHistory`, `requestStructured`, `generateWithImageStructured`, `streamOpenAiText`) all send the header; `trackMealWithThinking` with two meals shows 3 distinct keys; `runOnboardingTurn` with a malformed first reply shows 2; non-hosted providers send no header; a 409 with `x-should-retry: false` triggers no SDK retry; `defaultHeaders` never contains the key (source guard)                                                                                                                           | Header present on every hosted request; no key reuse across logical requests                                      |

**App tests (Jest):**

- deviceIdentity: deterministic `rc_id` from the 65-byte key, signatures that verify against the Worker's WebCrypto vectors (the crypto spike's vector file)
- HostedAiService token cache and refresh, with nothing called at boot; Premium status read from the Worker
- probe priority, and consistency across the three `SettingsContext` copies
- error mapping
- `useHostedAi` forced off on import
- BYOK, free tier, on-device and local resolution unchanged with Premium off (regression)

---

## 14. Estimated monthly economics

Recomputed with the revision 3 formula (8.1).

**Assumptions [A until G7/G9]:**

- €4.99 including 21% VAT, 1 EUR ≈ 1.16 USD, so gross excluding VAT ≈ $4.79.
- Store commission **15%** (Small Business Program or Google Play) or **30%** (Apple, year one, no Program).
- "Net proceeds" is after the 3% estimate haircut, the 5% FX haircut and RevenueCat's 1% (section 8.1).
- OpenRouter fee 5.5%. Average model cost $0.45 per subscriber per month (a placeholder until the P4 regression measures it), which is €0.41 with the fee.
- Per-subscriber cap (model spend): **$1.75 at 15%, $1.44 at 30%**. With the fee that is at most €1.59 and €1.31.
- Net proceeds per subscriber: **€3.18 at 15%, €2.61 at 30%**.

| Subscribers | Net proceeds (15% / 30%) | **Margin, average use** (15% / 30%) | **Margin, all at cap** (15% / 30%) | Cloudflare  | Fits Free?                                                                                                                                                              |
| ----------- | ------------------------ | ----------------------------------- | ---------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 10          | €32 / €26                | **€28 / €22**                       | **€16 / €13**                      | €0          | yes                                                                                                                                                                     |
| 100         | €318 / €261              | **€277 / €220**                     | **€159 / €131**                    | €0          | yes                                                                                                                                                                     |
| 1,000       | €3,182 / €2,611          | **€2,773 / €2,202**                 | **€1,591 / €1,306**                | €0          | yes (about 28k writes/day)                                                                                                                                              |
| 10,000      | €31,819 / €26,112        | **€27,727 / €22,019**               | **€15,910 / €13,056**              | not on Free | **no.** About 280k writes/day, and `daily_full` stops admission far earlier. Needs your decision to move to Workers Paid ($5/month). Sign-ups close at 1,500 until then |

- **Margin** means net proceeds minus OpenRouter spend including its fee. It is before refunds, income tax and support time.
- **Per subscriber:** about €2.77 at average use (15%) or €2.20 (30%). At the cap, at least €1.59 or €1.31, guaranteed by the invariant.
- **Refunds at 3%** cost about €0.10 of net proceeds per subscriber plus up to the early cap. Margin stays positive in every row.
- **Business costs, not per subscriber:** Apple Developer Program $99/year and Google Play $25 once (already paid for Musclog); RevenueCat is $0 below $2.5K MTR (its 1% is deducted in the formula regardless); Cloudflare $0.
- **Not included:** income tax and support time. Apple's commission falling from 30% to 15% (Small Business Program, or after year one) raises caps automatically.

---

## 15. Gates, phases and acceptance

### Gates (all manual verification; nothing ships until its gate passes)

| Gate                        | Verifies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Pass                                                                                                                                                                                                                                  | If it fails                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **G1** Terraform            | On a real account: the Path B resources apply (custom domain, DNS and certificate appear), `tofu plan` is empty after apply, workers.dev and previews are off, the apex and other DNS records are unchanged                                                                                                                                                                                                                                                                                                                                                                                                | The proof steps in the infra report pass                                                                                                                                                                                              | Adjust the layout; Path B already avoids the secret question                                  |
| **G2** Billing identity     | Sandbox, both stores, the 20-step matrix of the [RevenueCat report](../../spikes/premium-p0/revenuecat/REPORT.md): purchase, 3 renewals, reinstall + Restore under a new key-derived id (and `syncPurchases`), transfer to a second device and back, cancel and resubscribe, billing grace, refund, cache invalidation; the traps (anonymous purchase then `logIn`, public-key probes, promotional and offer codes, Test Store, the "Transfer if no active subscriptions" variant). Records `customer_id`, `subscription.id`, `store`, `environment`, `ownership`, `gives_access`, transaction ids, timing | `subscription.id` is stable across renewals and transfers (else the earliest-transaction fallback), `SubscriptionTransaction.id` identifies each payment, the old id loses access (and how fast), and the open rows of 6.1 are closed | **Premium does not launch.** Record the findings and pick a store-direct design in a new plan |
| **G3** Rate limit           | The `ratelimit` binding deploys on a Free account                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | It works                                                                                                                                                                                                                              | Budget, in-flight and global caps only                                                        |
| **G4** CPU                  | p99 CPU < 8 ms at the chosen image size, with streaming, from `cpuTime` on staging                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Measured on staging                                                                                                                                                                                                                   | Lower the body cap                                                                            |
| **G5** OpenRouter           | The key-only probes in the bench report: what a model with no ZDR endpoint returns, "ZDR only" set, generation lookup delay, auto top-up default, behavior at zero balance, `max_price` on the chosen tier                                                                                                                                                                                                                                                                                                                                                                                                 | All measured                                                                                                                                                                                                                          | Wait for eligible models; never relax ZDR                                                     |
| **G6** Images               | 40+ real photos (plated, mixed, packaged, labels, dim light, restaurant) with gold macros; long edges 512/768/1024/1280/1568 × JPEG quality 60/75/85 per candidate model                                                                                                                                                                                                                                                                                                                                                                                                                                   | Smallest setting whose kcal and macro error is within 2 points of full resolution, inside the 512 KB cap; labels stay legible; `IMAGE_TOKENS_MAX` = max observed × 1.25                                                               | Pick the next larger setting; vision stays off until it passes                                |
| **G7** Stores and fees      | Apple Small Business Program enrolment, refund windows, Play refund window, VAT table, App Review of the 3.1.2(a) wording and 5.1.2(i) consent                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Confirmed in official pages; TestFlight and closed testing accepted                                                                                                                                                                   | Recompute section 14; adjust copy                                                             |
| **G8** Client retries       | Per-request idempotency key analysis (done) and its tests                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Tests in P6 pass                                                                                                                                                                                                                      | Pass the key through the config per logical call                                              |
| **G9** Proceeds             | `revenue_in_usd.proceeds` is present within minutes of a sandbox purchase and renewal, per transaction                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Present ≥ 99% within 10 min                                                                                                                                                                                                           | Floor fallback with restricted storefronts (8.1), or cap 0 until present                      |
| **G10** Ledger exactly-once | The ledger tests on staging D1 (Miniflare is not production)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | 20/20 on staging; measured rows per request within the plan                                                                                                                                                                           | Re-derive section 4                                                                           |
| **G11** Device-key crypto   | Hermes timing of keygen and sign on a mid-range Android; `BigInt` and `getRandomValues` available; the Android 12+ extraction rules                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Sign in an acceptable time (once per session)                                                                                                                                                                                         | Reconsider the library or use a native key                                                    |

### Phases

| Phase                                                                            | Needs                         | Work                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Accept                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** Gates and accounts                                                        | n/a                           | Offline gates done (section 16). **G5 and G6 live runs call OpenRouter directly** (the benchmark harness, not the proxy) and need your key. Accounts: OpenRouter ("ZDR only", auto top-up off, a $5 limited key), RevenueCat project, store products (no trial, no Family Sharing, no offer codes), Cloudflare Free account with no card                                                                                                                                                                                                                                                                                                                                                                         | Every gate result written into section 16                                                                                                                                                                      |
| **P1** Worker core                                                               | P0 sign-off                   | Scaffold, migrations, `/challenge` `/enroll` `/session` `/config` `/usage`, period creation, duplicate guard, the ledger SQL and tests moved from the spikes. **Against mocks**; runs in parallel with P1a                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Rows 1, 3 (mocked) and 7 of the test table green                                                                                                                                                               |
| **P1a** Identity harness                                                         | P0 sign-off                   | A test route `app/app/test/premium-harness`, built (2026-11-20): the RevenueCat SDK and the device key (`utils/premium/deviceKeyCrypto.ts`, `services/premium/deviceKeyStore.ts`, the modules P5 reuses), no Premium UI. Reachable only in a build made with `EXPO_PUBLIC_PREMIUM_HARNESS=1` (the `premium-harness` EAS profile, extends `production`; internal and TestFlight uploads only), never in `production` and never on web. Opened by deep link `com.werules.logger://app/test/premium-harness`. **It exists so G2, G9 and the G11 timing can run**: a client that can buy under the key-derived id. Procedure: `docs/PREMIUM_WORKER.md` → Running G2 and G9; recorder: `scripts/premium-record-g2.js` | G2 and G9 matrices executed on both stores                                                                                                                                                                     |
| **P2** Proxy and accounting                                                      | P1, **G2, G9**, G4, G5, G6    | Allowlist, reserve/settle, idempotency, sweep, reconciliation, `daily_full`, ZDR re-check, breaker, capacity flag. Anything that writes the ledger against real RevenueCat data                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Rows 2, 4, 5 and 6 green; a simulated 120% month stays within caps                                                                                                                                             |
| **P3** Infrastructure                                                            | P1, G1, G3 (parallel with P2) | `infra/premium`, `wrangler.toml`, deploy script (first `wrangler deploy`, then `tofu apply`), staging, secrets procedure, CI checks, runbook (breaker reset, kill switch, top-up of at least $15, rollback)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Clean-machine staging apply and teardown; rollback rehearsed; account has no paid plan                                                                                                                         |
| **P4** Regression                                                                | P2, P3                        | **Re-run the same benchmark through the staging proxy** and compare with the P0 direct results: the proxy must not change outputs or cost                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Reports committed; section 14 updated with measured cost                                                                                                                                                       |
| **P5** App purchase and identity (offline part built 2026-11-20, see section 16) | P1, P1a, P3, G2               | Device key and `rc_id`, RevenueCat, enroll, restore, devices, "Reset Premium", `.web` stubs, settings, import guards                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sandbox on both platforms: purchase, enroll, a second device, reinstall + restore keeps the same budget; the stolen-ID manual test fails                                                                       |
| **P6** App provider and UI                                                       | P5, P2, P4                    | Provider tables, errors, per-request idempotency header (G8), image resize, Premium UI, consent, i18n, docs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Photo, chat, structured and label flows work on staging; exhaustion, device-removed, capacity and unavailable states shown; BYOK and free-tier regression green; typecheck, ESLint and translation checks pass |
| **P7** Launch                                                                    | all, **G2, G9, G10, G11**     | Production apply, real products, store submissions (manual), `MAX_SUBSCRIBERS = 1500`, first top-up of at least $15 and within the sizing rule                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | One real purchase per store completes a photo analysis; reconciliation shows a gap under 3% after 3 days                                                                                                       |
| **P8** Optional, later                                                           | data                          | RevenueCat webhook (faster refund and transfer handling; webhooks are free on the current plan), attestation, WAF rule, Workers Paid decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | n/a                                                                                                                                                                                                            |

**Order:** P0 → (P1 ∥ P1a) → G2/G9 → (P2 ∥ P3) → P4 → P5 → P6 → P7.

### End-to-end verification

1. Worker: `npm test`, with no network. `tofu validate`.
2. Staging smoke test against a mock OpenRouter, then one real call.
3. Dev build: sandbox purchase, enroll, coach and photo. Lower the staging proceeds share to hit the cap and see the exhaustion UI, then switch to BYOK.
4. Sandbox: reinstall, restore, enroll a second device, check `/v1/usage` continues. Enroll with a copied `rc_id` from another device; it must fail.
5. Repo checks: `npm run typecheck`, `npm run lint:eslint`, `npx prettier --check` on changed files, the translation checks, the touched Jest suites, then `git status --short`.

**Orchestration (`AGENTS.md`).**

- **Kept by the orchestrator:** the identity and budget design, the SQL review, gate decisions, integration and validation.
- **Delegated to `worker`:** the Worker and its tests, Terraform and the deploy script, UI components, the benchmark harnesses.
- **Delegated to `worker-lite`:** locale keys, `.web` stubs and provider-table edits.

**Decisions still open for you:**

1. The hostname: confirm `ai.musclog.app` (section 16 checklist).
2. Apple Small Business Program enrolment (changes section 14).
3. Whether to move to Workers Paid when sign-ups close (nothing does it automatically).
4. Provider jurisdiction among the ZDR endpoints (section 7).

---

## 16. P0 status (2026-11-20)

All P0 evidence is in `spikes/premium-p0/`. Nothing used an account, a credential or a paid call.

| Gate                          | Status                                                 | Evidence                                                                 | What is left                                                                                                                                                                                                                                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1 Terraform                  | PASSED offline                                         | `spikes/premium-p0/infra` (tofu init + validate, provider 5.28.1 schema) | Path B chosen (wrangler uploads code, keeps secrets); real-account proof steps in `infra/REPORT.md`                                                                                                                                                                                                                                                                  |
| G2 Billing identity           | BLOCKED (accounts; harness built)                      | `revenuecat/REPORT.md`: desk research + 20-step matrix                   | Run the matrix on both stores with the harness and the recorder (needs the accounts)                                                                                                                                                                                                                                                                                 |
| G3 Rate-limit binding on Free | BLOCKED (needs account)                                | not stated in docs                                                       | One deploy to a Free account; fallback = budget, in-flight and global caps                                                                                                                                                                                                                                                                                           |
| G4 CPU                        | PASSED (Node + local workerd proxy)                    | `spikes/premium-p0/cpu`                                                  | Body cap 512 KB; re-measure `cpuTime` on staging                                                                                                                                                                                                                                                                                                                     |
| G5 OpenRouter                 | PARTIAL                                                | `bench/REPORT.md`: ZDR list public, shortlist, fees, streaming usage     | Key-only probes listed in `bench/REPORT.md`                                                                                                                                                                                                                                                                                                                          |
| G6 Images                     | BLOCKED (needs key + photos)                           | harness + dry run + Nutrition5k sample                                   | Live run ≈ $2–4; about 20 maintainer photos                                                                                                                                                                                                                                                                                                                          |
| G7 Stores and fees            | PARTIAL                                                | Apple Schedule 2, Play fee pages, guidelines                             | Small Business Program enrolment, refund windows, App Review of the 3.1.2(a) wording                                                                                                                                                                                                                                                                                 |
| G8 Client retries             | PASSED (analysis)                                      | `idempotency/REPORT.md`                                                  | Tests belong to P6                                                                                                                                                                                                                                                                                                                                                   |
| G9 Proceeds                   | BLOCKED (accounts; harness built)                      | v2 fields verified; timing undocumented                                  | Matrix step 1                                                                                                                                                                                                                                                                                                                                                        |
| G10 Ledger exactly-once       | PASSED on Miniflare (20/20)                            | `spikes/premium-p0/ledger`                                               | Re-run against staging D1                                                                                                                                                                                                                                                                                                                                            |
| G11 Device-key crypto         | PARTIAL (Node + workerd 29/29; Android rules verified) | `spikes/premium-p0/crypto`                                               | Hermes timing, `BigInt` and `getRandomValues` from the harness G11 panel on a RELEASE build of a mid-range Android. The Android 12+ extraction rules are done: the generated manifest references expo-secure-store's rules, which exclude the `SecureStore` prefs from cloud backup and device transfer (`utils/premium/__tests__/androidSecureStoreBackup.test.ts`) |

**Your checklist** (exact and minimal):

1. **Hostname:** confirm `ai.musclog.app` (`api.musclog.app` is the live barcode API and cannot be used).
2. **Cloudflare dashboard:** Billing shows no payment method and no Workers Paid subscription; create two account API tokens (read-only for plan, write for apply) with the permissions in `spikes/premium-p0/infra/REPORT.md`; confirm no DNS record exists for the chosen hostname.
3. **OpenRouter:** create the account; Settings → Privacy: "ZDR only" (Safety Retention excluded), logging and training opt-ins off; confirm auto top-up is off; buy $5 of credits for the P0 benchmarks ($5.80 with the $0.80 minimum fee; production top-ups are at least $15 so the fee stays 5.5%); create a key with a $5 limit; run the live benchmark yourself (`npm --prefix spikes/premium-p0/bench run live -- --max-usd 4`, key only in the environment, never pasted in chat).
4. **Photos:** about 20 of your own food photos (packaged, labels, dim light, restaurant, mixed plates) with known macros, per `spikes/premium-p0/bench/fetch-dataset.md`.
5. **RevenueCat** (when you reach P1a): a project with the iOS and Android apps, restore behavior "Transfer to new App User ID" in production and sandbox, server-to-server "track new purchases" off, a v2 key with only `customer_information:subscriptions:read` and `customer_information:customers:read`.
6. **App Store Connect:** Paid Apps Agreement, tax and banking; enrol in the Small Business Program; a subscription group with one monthly product at €4.99, Family Sharing OFF (irreversible), no introductory offer, no offer codes; sandbox testers.
7. **Google Play Console:** payments profile; a monthly subscription base plan (needs a billing-enabled build on a testing track first, which is P1a); license testers; a Google Cloud service account for RevenueCat with the Play Developer API; the RTDN topic.

**Costs.** P0 cash: about $5.80 OpenRouter (one benchmark run, only when you buy it). Cloudflare $0, RevenueCat $0. Store fees: Apple Developer Program $99/year and Google Play $25 once (already paid for Musclog). Per-subscriber economics are in section 14.

**Maintainer answers (2026-11-20).**

- Hostname `ai.musclog.app` is **confirmed**.
- Cloudflare stays on the Free plan, with no payment method. The two API tokens will be created later. Until then P3 is limited to files and `tofu validate`, with no plan or apply.
- There is no OpenRouter account yet, so G5's key probes and the G6 live run wait for it. Item 3 is the documented procedure.
- The roughly 20 photos are for the G6 image benchmark only. Nutrition5k covers plated meals at 640 px; it has no packaged foods, labels, dim light or higher resolutions. G6 cannot pass without them, and hosted vision stays off until it does.
- There is no RevenueCat account yet, so P1a and G2/G9 wait for it.
- Store products can be scripted with the existing CLIs: `asc subscriptions setup` (App Store) and `gplay subscriptions` / `baseplans` (Play), dry-run first and run only on an explicit request (AGENTS.md publishing rules). Still manual:
  - Paid Apps Agreement, tax and banking
  - Small Business Program enrolment
  - Play payments profile
  - the first billing-enabled build on a Play testing track
  - the Google Cloud service account for RevenueCat
- Store copy currently says "no subscription" in places: `android/play/metadata/en-US/full_description.txt`, `ios/appstore/metadata/version/2.16.10/*.json` and `lang/locales/en-us/onboarding.json`. It must be updated in all locales when Premium ships (P6/P7), and the App Store guard's known entry `APPLE-3.1.2-MISLEADING-PRICING` in `docs/APP_STORE.md` revisited.

**P1, P2 and P3 (files) status, 2026-11-20:** built against mocks. `npm --prefix services/premium-worker test` runs every P1/P2 row of the section 13 table offline (how to run it: `docs/PREMIUM_WORKER.md`); `tofu validate` passes on `infra/premium`. Still needed before P2 counts as accepted: G2, G9, G4, G5 and G6 (real accounts), and the G10 re-run on staging D1. The CI workflow `premium-checks.yml` (section 5) is written (checks only; its steps pass locally in a clean copy under Node 26.10.0: 312/312 Worker tests, `tsc`, `tofu fmt`/`validate`, both dry runs; `shellcheck` and the first run on GitHub are still to be seen).

**P1a status, 2026-11-20:** built (see section 15 and `docs/PREMIUM_WORKER.md` → Running G2 and G9). `react-native-purchases` (11.x) is now linked into every build; the native projects needed no change (BILLING arrives through the library's manifest merge), but the Play Data safety form and App Store privacy labels must name the RevenueCat SDK before a production release that includes it. The key module generates with `@noble/curves` 2.4.0, which needs a **48-byte** seed. Unverified v2 field names in the recorder: `active_entitlements.items[]`, the `--search` list shape, `effective_expiration_date`.

**P5 (offline part) status, 2026-11-20:** the app side is built against mocks, with no Premium UI (that is P6): `utils/premium/{premiumState,premiumFlows,hostedClient}.ts`, `services/premium/{premiumService,premiumLocalState}.ts` (+ `.web`), `SETTINGS.useHostedAi` and the backup guards. Decisions the plan left open: (1) **No device list or remove-device endpoint exists in section 10**; P5 shows `{count, max}` from enroll, session and usage, handles 401 `unknown_device` as "removed from this subscription", and relies on the 4th-enroll LRU eviction. A remove-other-device call needs its own signed-auth design (any device of a lineage could otherwise evict the others): open, not planned. (2) **"Reset Premium"** clears local state, makes a new key and, if the SDK was configured in this run, calls `Purchases.logIn(newRcId)` (identified to identified, A1: no merge or transfer). **Unverified until G2 step 16/3**; fallback is to require an app restart after a reset. (3) **Enroll right after a purchase or restore retries** only 403 `subscription_required` and 503 `entitlement_unavailable`, at 2, 4 and 8 s with a new nonce each time. (4) **The session token is memory-only**, refreshed 5 minutes before expiry; the device-local record (enrolled `rc_id`, `removed`, last usage) is excluded from backups. (5) **`use_hosted_ai` is excluded from export and skipped on restore** (11 item 8); a restore wipes the settings table, so it lands on the default (off), while the device key and the enrollment record survive it. (6) The `Worker` test `services/premium-worker/test/appClient.test.ts` runs the app's real client against the real handlers (enroll, session, replayed nonce, high-S, 4th device, retry, same payment keeps one period row). Still needing accounts: the sandbox rows of P5's acceptance (purchase, second device, reinstall + restore, stolen-ID test).

**P6 (offline part) status, 2026-11-20:** the app side of section 11 items 3, 4, 6, 7 and 10 is built against mocks and stays unreachable: one build flag `EXPO_PUBLIC_PREMIUM_UI === '1'` (default off, no profile sets it) hides the card, modal, provider probe and settings rows. Built: `hosted` in every provider table (first in priority; the probe never falls through silently when the session cannot be minted), the per-request `Idempotency-Key` through one helper (section 13 row 8 tests in `utils/__tests__/hostedIdempotency.test.ts`), `Hosted*Error` classes and recovery actions, hosted image resize, `PremiumCard`/`PremiumModal` with the consent naming OpenRouter and ZDR, and copy in ten locales. Decisions: (1) `useHostedAi` is turned on only after enrollment and consent, and off again on removed or revoked; (2) `unknown_device` on a chat request reads "removed from this subscription" and never re-enrolls; (3) a 401 with another code is a transient unavailable (the token is re-minted next request); (4) consent is versioned (`PREMIUM_CONSENT_VERSION`) and never restored from a backup. Still needed: a device check that `expo-image-manipulator` accepts a `data:` URI, the G6 limits (hosted vision stays off until then), real store prices, G7 wording, and P7 (flag on, store copy, listings).

**P6 verification and deferred items (2026-11-20):** verified offline: typecheck, ESLint (0 errors), prettier, translation and locale checks, the new Jest suites plus `platformModuleParity`, `deslopGuards`, `iconOnlyTouchables`, `loggyPlacement`, `appLockCoverage`, and the Worker's 320/320. `expo-image-manipulator`'s own typings document that `uri` may be "a base64 data URI", so `utils/hostedImage.ts` passes one; **deferred (needs a device):** run the resize on a release build on Android and iOS, and if a data URI is refused write the base64 to a cache file first. **Deferred (needs accounts or a decision):** (1) real store price strings and a purchase, cancel, pending and restore pass in sandbox (`getMonthlyPriceString` is tested against a mock only); (2) the Restore button is shown only when not subscribed or removed (an active subscriber has nothing to restore); App Review on 3.1.2 may want it always visible, decide at G7; (3) choosing Premium in `ai-provider.tsx` opens the modal and does not auto-select it or set `skipMusclogApi` (the switch is turned on after consent); (4) component render tests: done in the P6 closing paragraph below (`*.dom.test.tsx` in the `jsdom` project); (5) the G6 image limits (hosted vision stays off until then); (6) `Purchases.logIn` after "Reset Premium" (G2); (7) App Store privacy labels and the Data safety form must name RevenueCat, and the store copy that says "no subscription" must change (P7); (8) a manual pass of every Premium state on a dev build with `EXPO_PUBLIC_PREMIUM_UI=1` and a mocked Worker.

**Deferred, decided 2026-11-20 (maintainer):** (1) **a remove-other-device endpoint** (and a device list beyond `{count, max}`): not planned for launch; it needs a signed-auth design first (any device of a lineage could otherwise evict the others), and the 4th-enroll eviction is the only removal until then. (2) **Wording of the "removed from this subscription" state** is a P6 copy decision (and part of the G7 App Review wording on 3.1.2(a)). (3) **`Purchases.logIn(newRcId)` after "Reset Premium"** stays unverified until G2; the fallback is requiring an app restart after a reset. (4) The restore-guard test `database/__tests__/importDbHostedAi.test.ts` has not been run against an unguarded `importDb.ts`; do that once (revert the one `continue`, see it fail, restore it) when next touching the file.

**What you run next:** (1) the accounts and products in the checklist above (RevenueCat first; then the App Store Connect subscription and the Play base plan); (2) build the harness: `eas build --profile premium-harness` per platform, uploaded to TestFlight or a Play internal testing track only, with `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` set in EAS (public SDK keys); (3) run the G2 and G9 matrices with the harness and `scripts/premium-record-g2.js`, pasting the harness log and the recorder output into the matrix; (4) G11 timing from the harness on a release build.

**Next:** G2, G3, G5, G6, G9 and the G11 device run wait for the accounts above.

**P6 closing (2026-11-20, offline):** (1) **Render tests exist now.** `jest.config.js`'s `jsdom` project also matches `components/**/__tests__/*.dom.test.tsx` (react-native-web + `@testing-library/react`, the way the hook tests already work; never put a test under `app/`, where files are routes). `PremiumModal.dom.test.tsx` (every notice, consent before the switch turns on, Subscribe iff `canSubscribe`, Restore iff `canRestore`, disclosures, Terms and Privacy links), `PremiumCard.dom.test.tsx`, `PremiumUsageBar.dom.test.tsx` and `PremiumEntryPoints.dom.test.tsx` (the Premium rows in `AINotConfiguredModal` and `ai-provider.tsx` render nothing with the flag off). ESLint ignores `*.dom.test.tsx`; the files are checked by prettier and Jest only. (2) **State walk** (jsdom plus a read of `premiumUiState.ts`, all ten locales; a dev build with a mocked Worker is still deferred). Findings, all decided and fixed in the same change: **(a) `revoked`** now offers Subscribe (when the Worker accepts new subscribers) and Restore, like not-subscribed; **(b) `entitlement_unavailable`** has its own `confirming` notice ("still being confirmed, try again in a minute") instead of "nothing found" (`restore_nothing` stays for `restore_failed` and `subscription_required`; the modal cannot tell a purchase from a restore, so a purchase that ends in `subscription_required` still reads "nothing found": revisit with the real sandbox behaviour at G2); **(c) one message, not two:** `PremiumUsageBar` no longer carries `usage.nearLimit` or `usage.full` (keys removed from all locales), the notice says it, and an `active` status at 100% or more now shows the `exhausted` notice; **(d)** the Premium row's subtitle may use two lines (`SettingsCard.subtitleLines`); **(e)** `TextButton`'s label shrinks (`flexShrink: 1`) so a long German or Dutch link wraps instead of overflowing; **(f)** the switch in `exhausted` stays usable to turn hosted AI off (never on), which is what plan section 11 meant; **(g)** the `removed` notice in all ten locales now says a restore on a fourth device removes the oldest, and the Russian "(до 3 ваших)" phrasing is fixed. Left as is: `aiOnboarding.recovery.hostedSubscription.description` still says "renew the subscription" (the action is Restore or Subscribe; low, reword with the rest of the P7 copy pass); the consent claim "nothing is stored or used for training" must be re-checked against what the Worker and OpenRouter keep (counts only; ZDR) before P7, and the 24-hour renewal sentence is App Store wording (check the Play text). Also: `components/modals/PremiumModal.tsx` was missing from the layout audit's `MODAL_COVERAGE` (`tests/layoutAudit/routes.ts`, a failing `routes.test.ts` since P6); it is now listed as unaudited with the reason (hidden behind the build flag), and **a modals-fixture button for the Premium states joins that table when the P7 flag is turned on** (then run `npm run layout:audit`). Fixed: English "enrolment" to "enrollment" in `premium.resetBody`. Placeholders and keys match in all ten locales.

**P7 preparation checklist (list only; nothing below is applied, store text needs the maintainer):**

- **Decide first:** (1) does "Nothing locked away" stay (core free, only AI paid)? (2) is a device-derived `rc_id` plus a Worker record an "account" under 5.1.1(v)? (3) the "up to 3 devices" wording against 3.1.2(a), and the review note; (4) separate privacy text for the free tier (Gateway, Gemini) and Premium (Worker, OpenRouter); (5) price copy uses the store string (`{{price}}`), never a hard-coded EUR 4.99.
- **A. Store copy that says "no subscription" or "no paywall":** Play `android/play/metadata/<locale>/full_description.txt` line 1 and the later "with no subscription" paragraph (lines 6 to 9) and the "free option" line (about 37 to 39) in all ten locales; Play `short_description.txt` in en-US, es-ES, fr-FR, pl-PL, pt-BR, ru-RU ("No account or paywall", "Sin cuenta ni suscripción", "Sans compte ni abo", …; de, it, nl, tr keep theirs); title files are clean and title and short never say "free". App Store `ios/appstore/metadata/version/2.16.10/*.json` (ten files): `description` (line 2) in every locale, `promotionalText` (en-US line 5, and line 3 in the others) in nine; add a Premium paragraph with the 3.1.2(c) disclosures (price, duration, renewal, cancel, Terms and Privacy links), never naming Android or Google Play; screenshots untouched.
- **B. In-app copy** (`lang/locales/*/`): `onboarding.json` ("100% Free, 100% yours", "No accounts, no cloud, no subscriptions", the Musclog AI "Free" badge, `dataSharingBody` needs the Premium consent text), `aiOnboarding.json` ("No account or key. A daily limit applies."), `settings.json` free-tier section (cross-reference Premium), `whatsNew.json` and `comeback.json` ("free Musclog AI", re-check when Premium is announced). No hard-coded claim exists in `app/`, `components/`, `services/` or `utils/`.
- **C. Website** (`website.json`, `websiteAlternativesPages.json`, `websiteRoutes.json`): privacy ("no accounts and no cloud sync", the free-AI exception, provider list, "sent through Cloudflare AI Gateway … Gemini", service providers (add RevenueCat, OpenRouter, Cloudflare Workers and D1), retention (Worker ledger, RevenueCat), "no account to delete", the security list, "never sent to our servers"); Terms has no subscription section (price, monthly renewal, store billing, cancellation and refunds, three devices, daily allowance); FAQ lacks "Is there a subscription?"; Alternatives says "nothing is locked behind a subscription" and "There is no paid tier"; edit the `websiteRoutes.json` blurbs and regenerate `llms.txt`, never hand-edit it.
- **D. Docs:** `README.md` (free-tier paragraph, "No account" line), `docs/CURRENT_FEATURES.md` (add a Premium section), `docs/GOOGLE_PLAY.md` (positioning, Data safety, a production rule beside the harness one), `docs/APP_STORE.md` (privacy labels, the Terms link, a production rule), this plan (the store-copy list at the P6 deferred paragraph names only three locales; it must cover all twenty files).
- **E. App Store guard:** `APPLE-3.1.2-MISLEADING-PRICING` is not in `scripts/appstore-guard-known.json`; it exists only as the decision at `docs/APP_STORE.md` line 197 ("false positive … no subscription"), so delete that decision once the copy changes, and fix any real pricing finding rather than add a known entry. Known entries whose reason turns false or stale: `BOTH-SUBSCRIPTION-HARD-CANCEL` ("no subscription, purchase or membership"), `APPLE-5.1.1-NO-ACCOUNT-DELETION` (no server profile; depends on decision 2), `APPLE-2.1-STAGING-BACKEND` (add the Premium base URL).
- **F. Data safety, privacy labels, manifests:** `app.json` `ios.privacyManifests` gains Purchase History (not linked, no tracking, app functionality) and a decision on Device ID (`rc_id`); confirm Other User Content covers the Premium payload; regenerate with `npm run prebuild:ios` and keep `iosPrivacyConfig.test.ts` green; Play Data safety adds financial info (purchase history), device or other IDs and the processors (RevenueCat, Cloudflare, OpenRouter) and the AI section names the Premium route; confirm `com.android.vending.BILLING` in the merged manifest; add the public `EXPO_PUBLIC_REVENUECAT_{IOS,ANDROID}_KEY` and `EXPO_PUBLIC_HOSTED_AI_BASE_URL` to the production profile only (the `premium-harness` profile stays out of production tracks), set the Worker's `HOSTED_AI_ENABLED` and product ids to match the store products, add a Terms and a subscription-management URL to `constants/projectLinks.json`.
- **G. IAP setup** (the maintainer; see the accounts checklist above): RevenueCat project, restore behaviour "Transfer to new App User ID", v2 key by `wrangler secret put`; Apple Paid Apps Agreement, Small Business Program, one monthly product (EUR 4.99), Family Sharing off, no offers, sandbox testers, review notes on 3.1.2(a), Restore location and the free tier; Google payments profile, monthly base plan from a billing-enabled internal-track build (the harness), license testers, a service account for RevenueCat and the RTDN topic; `gplay` and `asc` dry runs only until asked.
