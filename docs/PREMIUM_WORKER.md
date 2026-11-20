# Musclog Premium Worker runbook

Operating guide for `services/premium-worker/` (the hosted-AI backend). Design: `docs/plans/musclog-premium.md` (revision 3). **Every command below that touches Cloudflare, OpenRouter or RevenueCat is not yet verified against a real account (gate G1).** No account or credential exists yet; the first real run is also the test of this document.

## What it is

A Cloudflare Worker (Free plan, D1 database, two cron triggers) that checks a RevenueCat subscription, keeps a spend ledger and proxies requests to OpenRouter. It is a separate npm package, not part of the app: `tsconfig.json`, ESLint, the Metro `blockList`, the Jest ignore patterns and `.easignore` all list `services/premium-worker`; `infra/` is excluded from `tsconfig.json` and EAS uploads.

## Tests and local development

- Tests (offline; OpenRouter and RevenueCat are injected fakes): `npm --prefix services/premium-worker install && npm --prefix services/premium-worker test`.
- Local dev: `cd services/premium-worker`, copy `.dev.vars.example` to `.dev.vars` (git-ignored; dummy secrets), then `npx wrangler dev --env local`. `[env.local]` in `wrangler.toml` points the upstream URLs at local mocks (`127.0.0.1:8788`, `:8789`) and declares the crons so `--test-scheduled` works.

## Environments

| Environment | Worker name               | URL                                             | RevenueCat | Database                     |
| ----------- | ------------------------- | ----------------------------------------------- | ---------- | ---------------------------- |
| staging     | `musclog-premium-staging` | workers.dev (previews off)                      | sandbox    | `musclog-premium-staging-db` |
| production  | `musclog-premium`         | `ai.musclog.app` (workers.dev and previews off) | production | `musclog-premium-db`         |

`api.musclog.app` is the live Barcode API and is never used (a Terraform validation refuses it). The names in `infra/premium/main.tf` (`locals`) must equal `name` and `database_name` in `wrangler.toml`.

## Secrets

Set only with wrangler, never in `wrangler.toml`, Terraform, the repo or CI. Names (`src/env.ts`):

```bash
cd services/premium-worker
npx wrangler secret put OPENROUTER_API_KEY --env <env>
npx wrangler secret put REVENUECAT_V2_SECRET_KEY --env <env>
npx wrangler secret put SESSION_HMAC_KEY --env <env>   # at least 32 random bytes
```

Rotating `SESSION_HMAC_KEY` (the Worker accepts the previous key for verification only): put the OLD value into `SESSION_HMAC_KEY_PREVIOUS`, put the NEW value into `SESSION_HMAC_KEY`, wait one hour (token lifetime), then `npx wrangler secret delete SESSION_HMAC_KEY_PREVIOUS --env <env>`.

## First deploy and deploys

`scripts/premium-deploy.sh <staging|production> [--dry-run]` (needs `CLOUDFLARE_API_TOKEN` and `TF_ENCRYPTION` in the environment, `infra/premium/terraform.tfvars` copied from the `.example`, and for staging `PREMIUM_STAGING_URL`). Use `--dry-run` first: it prints every command and needs no credential or variables file (it reports what a real run would stop on). Stages:

1. Package `ci`, tests, typecheck; `tofu init`, workspace per environment (one encrypted local state each), `fmt -check`, `validate`.
2. **D1 first**: plan and apply only `cloudflare_d1_database.db` (you type `yes` after reading the plan). Wrangler needs the D1 id and Terraform creates it.
3. The script writes `services/premium-worker/.wrangler/deploy-<env>.toml` (git-ignored) from `wrangler.toml` with that environment's `database_id`, then `d1 migrations apply` (additive, before the code) and `wrangler deploy`.
4. Full plan and apply: custom domain (production), workers.dev and previews off, the two crons (`*/15 * * * *`, `30 0 * * *`, the strings in `src/app.ts`), optional alerts (`alert_email`).
5. Checks that the three secrets exist (names only), smoke-tests `GET /v1/config`, prints `wrangler deployments list`.

Both Terraform plans are shown before anything is applied. The state is local and encrypted (`TF_ENCRYPTION`, passphrase kept outside the repo). There is no CI apply: `.github/workflows/premium-checks.yml` only runs the Worker's tests and types, `tofu init -backend=false`/`fmt -check`/`validate`, `shellcheck` and both `--dry-run`s, with no secret. The D1 database has `prevent_destroy`.

## Configuration and the kill switch

`AI_CONFIG_JSON` (plain text in each `[env.*.vars]`) is validated on cold start; an invalid config serves nothing. The ZDR invariant (`provider.zdr = true`, `data_collection = "deny"`) cannot be relaxed. Change it in `wrangler.toml`, run the tests, then deploy.

Kill switch: set `HOSTED_AI_ENABLED = "false"` in the environment's `[vars]` and deploy (anything but `"true"` disables hosted AI with `503 hosted_disabled`). Both environments ship with it `"false"`: enable deliberately.

## The breaker

`meta.breaker` is `open` or `closed`; `meta.breaker_reason` says why. While open, requests are refused. `meta.daily_full` resets itself the next UTC day (cron); `accepting_new` is recomputed by cron.

| Reason             | Meaning                                                | Check before resetting                                 |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------ |
| `global_spend`     | ledger spend exceeded `global_share` of net proceeds   | the ledger rows; refunds; is `finance` still right     |
| `zdr_unavailable`  | the daily check found no ZDR endpoint at pinned prices | OpenRouter model page; change model or prices first    |
| `zdr_check_failed` | the ZDR check itself failed                            | OpenRouter reachable? Re-run the cron before resetting |
| `reconciliation`   | OpenRouter `usage_daily` differs from the ledger       | unmetered cost: find it, do not just reset             |
| `overruns`         | 3 settlements above their reservation in 24 h          | prices in config vs OpenRouter; `meta.overruns`        |
| `upstream_402`     | OpenRouter out of credit                               | top up first (below)                                   |
| `upstream_403`     | key limit reached or key revoked                       | key limit and key status in OpenRouter                 |

Read: `npx wrangler d1 execute musclog-premium-db --remote --env production --command "SELECT key, value FROM meta"`. Reset only after the cause is understood:

```bash
npx wrangler d1 execute musclog-premium-db --remote --env production --command "UPDATE meta SET value = 'closed' WHERE key = 'breaker'"
```

## OpenRouter funding

Prepaid credits, **auto top-up off**. Every top-up is at least $15 (the fee has a $0.80 minimum) and at most `spend_share` (0.5) times the month's expected net proceeds. The inference key has a `limit` with monthly reset, set by hand to about the monthly top-up. OpenRouter answers 402 when credits end and 403 at the key limit; both open the breaker.

## RevenueCat

The v2 secret key gets only `customer_information:subscriptions:read` and `customer_information:customers:read`. Restore behaviour stays "Transfer to new App User ID" in production and sandbox; any other setting breaks enrollment (the Worker fails closed).

## Running G2 and G9

The matrix is `spikes/premium-p0/revenuecat/REPORT.md` (steps 1-20); the harness is the client and `scripts/premium-record-g2.js` is the recorder. Nothing here is verified against real accounts yet: the first run is also the test of this section.

**Build the harness.** In EAS set `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (the SDK public keys; `EXPO_PUBLIC_HOSTED_AI_BASE_URL` too only to exercise a staging Worker). Then `eas build --profile premium-harness -p ios|android`. The profile extends `production` and sets `EXPO_PUBLIC_PREMIUM_HARNESS=1`; no other profile may. Upload to TestFlight or a Play **internal testing** track only (Play needs a billing-enabled build there before the base plan can exist). Install through the store with a sandbox tester (App Store Connect sandbox account, or a Play license tester).

**Open the screen.** There is no link in the app. Android: `adb shell am start -a android.intent.action.VIEW -d "com.werules.logger://app/test/premium-harness"`. iOS: type `com.werules.logger://app/test/premium-harness` in Safari on the device. A build without the flag redirects to Home; web shows a stub.

**The screen.** Identity (rc_id with Copy, public key, creation time, storage, and the id RevenueCat is configured with, with a MISMATCH warning); RevenueCat actions: Configure RevenueCat, Fetch offerings, Buy monthly, Restore, syncPurchases, logIn to this id (paste any id: trap 16), getCustomerInfo dump, Reset key; optional Hosted Worker buttons (Challenge, Enroll, Session; status and error code only, the token is redacted); G11 crypto timing; the Log. Opening the screen never creates a key: tap Create key. **Always Configure RevenueCat before Buy, Restore or syncPurchases** (it configures with `appUserID = rc_id`, never anonymously; purchases refuse otherwise). Reset key makes a new rc_id but RevenueCat stays configured under the old one until you restart the app and Configure again (or logIn): this is step 3's "new key-derived id". Every action is one log entry (wall-clock time, duration, raw SDK result incl. `transactionIdentifier`, entitlements, `originalAppUserId`); **Copy log as JSON** and paste it into the matrix next to the recorder output.

**Record each step.** With a v2 key that has only `customer_information:subscriptions:read` and `customer_information:customers:read`, kept in the shell (never in a file or chat):

```bash
export REVENUECAT_V2_SECRET_KEY=...   # read-only key
export REVENUECAT_PROJECT_ID=proj...
node scripts/premium-record-g2.js mlg1_<64 hex>                       # customer, subscriptions, transactions, proceeds present or not, age
node scripts/premium-record-g2.js mlg1_<64 hex> --search <store_subscription_identifier>   # step 4: a past id returns the current owner
node scripts/premium-record-g2.js <pasted id> --any-id --json         # trap 16
```

It only issues GET requests. G9 is the "proceeds present" line per transaction and its age: re-run every minute after the purchase and after each renewal until it flips. Three field names are assumptions (`active_entitlements.items[]`, the search list shape, `effective_expiration_date`): if a real response differs, fix `scripts/premium-record-g2.js` and its fixtures.

**G11.** In the same build tap Run crypto timing (30 runs; 100 for the p95) and copy the log. Only a release build counts (a dev build is 10-100x slower). The screen also reports `BigInt` and `crypto.getRandomValues`. The Android 12+ extraction rules are checked at build time by `utils/premium/__tests__/androidSecureStoreBackup.test.ts`.

**Afterwards:** write the matrix results into plan section 16, delete the sandbox customers' notes you do not need, rotate nothing (the harness holds no secret), and never promote a `premium-harness` build to production.

## The app client's contract test

`services/premium-worker/test/appClient.test.ts` imports the app's own pure client (`utils/premium/premiumFlows.ts`, `premiumState.ts`, `hostedClient.ts`, `deviceKeyCrypto.ts`) and runs it against the real handlers in Miniflare, so the signed string, the response shapes and the retry rules cannot drift apart. Those app files must keep relative imports only (the `@/` alias does not exist in the Worker package) and compile under its `noUncheckedIndexedAccess`.

## The app side (P6, hidden)

The app's provider, errors, image resize and Premium UI exist but are invisible: they need a build made with `EXPO_PUBLIC_PREMIUM_UI=1`, which no EAS profile sets until P7. See the "Premium provider, errors and UI" bullet in `AGENTS.md`. A client request carries `Idempotency-Key` (one per logical request) and the Worker's `x-should-retry: false` answers are retried only by the app's own backoff.

## Rollback

- Code: `cd services/premium-worker && npx wrangler rollback --env <env>`.
- Data: D1 Time Travel keeps 7 days: `npx wrangler d1 time-travel info musclog-premium-db --env production`, then `... restore --timestamp <ISO time>`.
- Anything urgent: the kill switch first.

## Cleanup (end of the experiment)

Export D1 (`npx wrangler d1 export musclog-premium-db --remote --output backup.sql`), remove `prevent_destroy` from `infra/premium/main.tf`, `tofu destroy` in each workspace, delete the Worker, revoke the OpenRouter, RevenueCat and Cloudflare keys.

## Never

- Workers Paid, or any payment method on the Cloudflare account.
- A secret in Terraform, its state, `wrangler.toml` or the repository.
- `tofu apply` from CI, or an apply without reading the plan.
- `api.musclog.app` for this Worker.
- Relaxing ZDR or `data_collection`.
