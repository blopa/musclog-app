# Infrastructure runbook: RevenueCat and OpenRouter

What is managed as code, how to change it, and what still lives only in a dashboard. Cloudflare (D1, domain, crons, the Worker) is separate: `docs/PREMIUM_WORKER.md`.

## What is managed where

| Area                                                                | Source of truth                                                             | Change with                                  |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------- |
| OpenRouter workspace, API keys (settings, never values), guardrails | `infra/openrouter/main.tf` (OpenTofu, `OpenRouterTeam/openrouter` `~> 0.3`) | `tofu plan` / `tofu apply`, by hand          |
| RevenueCat entitlements, offerings, packages                        | `infra/revenuecat/config/{entitlements,offerings}.json`                     | `scripts/infra.sh plan` / `apply --yes`      |
| RevenueCat products and prices                                      | The stores (`scripts/play.sh` / gplay, `scripts/appstore.sh`)               | Never from here; only exported for reference |
| Key **values**, Worker secrets                                      | `wrangler secret put`, dashboards                                           | Never from here                              |
| Cloudflare                                                          | `infra/premium`                                                             | `scripts/premium-deploy.sh`                  |

Still dashboard-only (no API or provider support found): RevenueCat paywalls, store credentials, restore behaviour (must stay "Transfer to new App User ID", see `docs/PREMIUM_WORKER.md`), webhooks if ever needed; OpenRouter account-level settings (ZDR, "allow free endpoints that train on request data", auto top-up). The workspace default guardrail is not managed (it is unconfigured; the free tier has its own guardrail instead).

## Setup (once per machine)

Credentials live in `~/keys/musclog-infra.env` (mode 600, backed up with the other keys, never in the repo or the Expo `.env`, which could reach the bundle):

```
OPENROUTER_MANAGEMENT_KEY=...   # a management key; cannot spend credits
REVENUECAT_INFRA_KEY=...        # v2 secret key, NOT the Premium Worker's; config read/write, no customer permissions
REVENUECAT_PROJECT_ID=proj...
TF_ENCRYPTION='key_provider "pbkdf2" "main" { passphrase = "..." }'
```

`scripts/infra-init-passphrase.sh` fills the passphrase with a random one (idempotent, prints nothing). Load before use: `set -a; source ~/keys/musclog-infra.env; set +a`, then `scripts/infra.sh status` must show all four as set. The OpenTofu state (`infra/openrouter/terraform.tfstate`) is local, encrypted and git-ignored; losing the passphrase loses nothing permanent, because the state only mirrors OpenRouter and can be rebuilt with `import` blocks.

## Commands

`scripts/infra.sh <command>`: it never prints a secret, never deletes, and `apply` is a dry run without `--yes`.

| Command    | Does                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`   | Which credentials are set (names only).                                                                                                           |
| `validate` | Parses the RevenueCat config; `tofu validate` for OpenRouter.                                                                                     |
| `plan`     | RevenueCat drift (entitlements, offerings, missing packages), then `tofu plan`.                                                                   |
| `apply`    | RevenueCat only: creates and updates by `lookup_key`; a change to a price-like field needs `--allow-pricing`. OpenRouter is `tofu apply` by hand. |
| `export`   | Sanitized live snapshots into `infra/snapshots/` (secrets redacted, personal fields dropped). Never edits desired files.                          |
| `report`   | JSON summary: OpenRouter credits and per-key usage, keys expiring within 60 days, RevenueCat metrics overview. No customer data.                  |

## Routine changes

- **Rename an entitlement or offering, or add one / a package:** edit the JSON in `infra/revenuecat/config/`, `scripts/infra.sh plan`, then `apply` (dry run), then `apply --yes`. An offering becomes current only after its package is attached. Items that exist live but not in the file are reported as `unmanaged` and left alone.
- **Change a key limit, the free-tier guardrail or the workspace:** edit `infra/openrouter/main.tf`, `tofu plan`, read it, `tofu apply`. **Any replace or destroy line means stop**: an `openrouter_api_key` must never be replaced (the value is shown only at creation, and the Worker and the app bundle hold the live ones). `allowed_models` / `allowed_providers` of the free-tier guardrail must equal `constants/gateway.ts`; after changing either, send one free-tier coach message.
- **Bring an existing OpenRouter resource under management:** add an `import { to = …  id = … }` block (key id = its `hash` from `infra/snapshots/openrouter/keys.json`, guardrail = uuid, workspace = slug), `tofu plan -generate-config-out=generated.tf`, review it for secrets, move it into `main.tf`, delete `imports.tf`/`generated.tf`, commit only when the plan says "No changes".
- **Rotate or add a key:** create it in the dashboard (the value is shown once), put it where it belongs (`wrangler secret put`, or the app's EAS variable), then import it. Never revoke the old one before the new one is live.
- **Prices and subscription periods:** change them in the stores, then check `scripts/infra.sh export` shows the synced product. Never add products or prices to the RevenueCat config.

## Drift and recovery

- `scripts/infra.sh plan` reports drift: RevenueCat exits through a JSON `drift` field, OpenTofu through its plan. Decide each time whether the file or the dashboard is right; an export never overwrites the desired files.
- A failed `apply` is safe to run again (create and update are keyed by `lookup_key`).
- Snapshots (`infra/snapshots/`) are records, not desired state. Review the diff of a fresh `export` before committing it.

## Monitoring

`scripts/infra.sh report` is the operational summary. Key expiry is the one thing nothing else warns about: `musclog-premium-prod` expires **2027-11-20**, after which the Premium Worker gets 403 (`upstream_403` in the breaker table of `docs/PREMIUM_WORKER.md`). Create its replacement and `wrangler secret put` it before then. Subscription history over time is not available from the API (only the current overview); keep exports or add a webhook if it is ever needed.

## Rules

Never rotate, revoke, delete or recreate a production key. Never create or edit a RevenueCat product or price from this tooling. Never run `apply --yes` or `tofu apply` without reading the plan first. The infra RevenueCat key is not the Premium Worker's, and no management key ever goes into the app bundle.
