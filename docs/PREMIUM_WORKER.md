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

## Production EAS variables and links (checklist; no real value is in the repo)

Set by the maintainer in EAS (`eas env:create`, environment `production`, visibility plain text or sensitive; all are PUBLIC SDK values or URLs, never a secret). The `premium-harness` profile must not inherit the production-only ones in a way that sends it to a production track; it needs the two SDK keys and the base URL only to run G2/G9.

| Variable                             | Value                                                   | Read by                                                      | Notes                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY`     | RevenueCat public SDK key, Apple app (`appl_...`)       | `services/premium/premiumService.ts`, `revenueCatHarness.ts` | Not the v2 secret key.                                                                                                                    |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat public SDK key, Google app (`goog_...`)      | same                                                         | Not the v2 secret key.                                                                                                                    |
| `EXPO_PUBLIC_HOSTED_AI_BASE_URL`     | `https://ai.musclog.app` (staging: the workers.dev URL) | `services/premium/premiumService.ts`                         | Never `api.musclog.app`.                                                                                                                  |
| `EXPO_PUBLIC_PREMIUM_UI`             | `1` only on the release that ships Premium              | `utils/premium/premiumUiFlag.ts`                             | Default off; `premiumUiFlag.test.ts` forbids it in `eas.json`, `app.json`, `package.json`, so set it as an EAS environment variable only. |
| `EXPO_PUBLIC_PREMIUM_HARNESS`        | `1` only through the `premium-harness` profile          | `utils/premium/harnessGuard.ts`                              | Never in production.                                                                                                                      |

Worker side (in `wrangler.toml`, then deploy; not EAS): `revenuecat.project_id`, `revenuecat.product_ids` (the store product ids as RevenueCat reports them), `revenuecat.environments` (`["sandbox"]` staging, `["production"]` production), `HOSTED_AI_ENABLED = "true"` only when intended, and `min_app_version` equal to the first app version that ships Premium.

**Links.** The Terms, Privacy and subscription-management URLs are NOT in `constants/projectLinks.json` (the plan's P7 checklist said they would be): they are constants in `utils/premium/premiumLinks.ts` (`PREMIUM_TERMS_URL` and `PREMIUM_PRIVACY_URL` are the website's `/en/terms` and `/en/privacy`; `MANAGE_SUBSCRIPTION_URLS` are Apple's and Google's own subscription pages). Nothing to set; on deploy day only check that the two website pages are live and carry the Premium sections.

## First deploy day (top to bottom)

For a maintainer who has the accounts. Each step names the doc section that has the commands; tick them in order and stop at the first failure. Nothing here has run against a real account, so the first run also tests this list. Agents never run the account steps.

1. **Accounts and products (no code).** Cloudflare Free account with `musclog.app` on it, no payment method (see Never). OpenRouter account, prepaid credits (at least $15, auto top-up off), a limited inference key. RevenueCat project with iOS and Android apps, restore behaviour "Transfer to new App User ID", a read-only v2 key (see RevenueCat). Apple: Paid Apps Agreement, Small Business Program, monthly product, Family Sharing off, no offers, sandbox testers. Google: payments profile, billing-enabled build on an internal track first (the harness build), monthly base plan, license testers, RevenueCat service account, RTDN topic. The store text and privacy answers to enter are in `docs/GOOGLE_PLAY.md` and `docs/APP_STORE.md` (Premium sections).
2. **Staging Worker.** Fill `infra/premium/terraform.tfvars`, `scripts/premium-deploy.sh staging --dry-run`, then the real run (First deploy and deploys). Put the three secrets (Secrets). Set `revenuecat.project_id` and `product_ids` to the sandbox values, `HOSTED_AI_ENABLED = "true"` for staging only, redeploy, and check `GET /v1/config`.
3. **Harness build and G2/G9.** Set the SDK keys and staging base URL in EAS, build `premium-harness` for Android (Play internal track) and iOS (TestFlight), run Running G2 and G9 step by step with the recorder, copy each log into plan section 16. Run G11 (crypto timing) on a release build in the same session.
4. **BILLING on a built APK.** On the first billing-enabled Android build: `aapt dump permissions <apk>` must list `com.android.vending.BILLING` (plan section 16, "P7 native-side proposal"). Play cannot create the base plan without it.
5. **iOS manifest on a Mac.** `npm run prebuild:ios`, read the merged privacy manifest for the RevenueCat SDK, compare with `app.json` `ios.privacyManifests`, then undo the prebuild noise: `git ls-files -d android ios | xargs git checkout --` and discard regenerated `ios/` churn (AGENTS.md, prebuild rule). Then `scripts/release-ios.sh check`.
6. **Sandbox purchase tests on the real wording.** On a build with `EXPO_PUBLIC_PREMIUM_UI=1` (a TestFlight and a Play internal build, not production): subscribe, enroll, send a chat and a photo, see usage move, cancel, restore on a second device, reset Premium and restore again, hit the allowance end (exhausted state), and the removed state (Retention section: delete a `devices` row to simulate). Check the consent text names OpenRouter and ZDR and that a free-tier or own-key user is never silently moved to hosted.
7. **Native-speaker review.** Ask a speaker for each of de, es, fr, it, nl, pl, pt-BR, ru, tr to read `lang/locales/<locale>/premium.json`, `aiOnboarding.json` recovery strings, the website privacy and Terms Premium sections, the Play and App Store Premium paragraph, with attention to "store account", the device wording (devices share one allowance; no number) and the retention wording (7 days, 60 days, identifier kept until removal on request). Machine translation is the current text.
8. **Store entries.** Enter the Data safety and App Privacy answers and review notes drafted in the store docs; subscriptions in both consoles must match the product ids in `AI_CONFIG_JSON`. Never run `play.sh up`, `release-android.sh upload --track production` or `release-ios.sh testflight|submit` unless that conversation asks for it; `plan`, `check`, `validate` and `--dry-run` are fine.
9. **Production Worker.** `scripts/premium-deploy.sh production --dry-run`, then real; production secrets and `revenuecat.environments = ["production"]`; first OpenRouter top-up follows the funding rule and `MAX_SUBSCRIBERS` (`limits.max_subscribers`, 1500) stays; keep `HOSTED_AI_ENABLED = "false"` until the app release is approved, then enable it and check the breaker row (The breaker).
10. **Release.** Ship the app with `EXPO_PUBLIC_PREMIUM_UI=1` as an EAS variable, publish the listing text with Premium, submit for review with the notes, watch the breaker and ledger for a week, then record the result in plan section 16 (G10, G11). Rollback is in Rollback (kill switch first).

Open (not part of this list): an authenticated delete-device endpoint and a remove-other-device call stay an open design (plan section 16); build it only if the maintainer asks.

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

## Retention and removing a device identifier on request

The Worker has no delete route (routes are challenge, config, enroll, session, usage, chat). What it keeps, and for how long (the nightly cron calls `prune` in `src/ledger.ts`):

| Data                                                        | Kept                                                                                                                                                      |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request fingerprints and their ledger rows (`reservations`) | 7 days after the request settled, was refunded or expired (`PRUNE_MS`)                                                                                    |
| Usage counts per billing period (`periods`)                 | 60 days after the period ends (`PERIOD_PRUNE_MS`)                                                                                                         |
| Device identifier and public key (`devices`)                | Until removed on request: **no cron deletes it** (a 26th enroll evicts the least recently used device of a subscription, as `revoked`, but keeps its row) |
| Message or photo content                                    | Never stored                                                                                                                                              |

**The privacy page promises "contact Us by email and We remove the identifier".** That is this manual operation (maintainer only, an authenticated Cloudflare call, so never from an agent): the person sends the identifier shown by the app's Premium screen (`rc_id`); then

```bash
cd services/premium-worker
npx wrangler d1 execute musclog-premium-db --remote --env production \
  --command "DELETE FROM devices WHERE rc_id = '<rc_id>'"
```

Reservations and periods carry no `rc_id` (they are keyed by the payment key), so nothing else names the device; they leave on the schedule above. Deleting the row also signs that install out (its next session call answers `unknown_device`, the app shows the removed state and never re-enrolls silently). Answer the email within a month and keep no copy of the identifier afterwards. An authenticated delete-device endpoint stays an open design (plan section 16).

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
