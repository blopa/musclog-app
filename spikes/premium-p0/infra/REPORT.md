# P0 / G1: OpenTofu feasibility and Cloudflare research

No account, no credentials, no plan/apply was used. Spike: `versions.tf`, `variables.tf`, `main.tf`, `worker.js` in this folder.

## G1 verdict: PASSED LOCALLY, two items need a real account

Passed offline:
- OpenTofu v1.13.2 with provider `cloudflare/cloudflare` = 5.28.1 and enforced AES-GCM state/plan encryption (PBKDF2 passphrase from `TF_ENCRYPTION`, dummy value used) runs `tofu init` and `tofu validate` with "Success! The configuration is valid".
- All six resources exist with the attributes plan section 5 needs: `cloudflare_d1_database`, `cloudflare_workers_script` (`content_file` + `content_sha256`, `d1` and `plain_text` bindings, `keep_bindings`), `cloudflare_workers_script_subdomain` (`enabled = false`, `previews_enabled = false`), `cloudflare_workers_custom_domain`, `cloudflare_workers_cron_trigger`. Exact paths: `schema-notes.md`.
- `keep_bindings` IS exposed (top-level `set(string)` on `cloudflare_workers_script`), and a `ratelimit` binding type exists.
- Zone and existing records stay unmanaged: no `cloudflare_zone` resource, only `zone_id` as a variable.

Only provable with a real account (exact steps, all on a throwaway Worker name, never on the production one):
1. Fresh account, no card: create the Worker through `tofu apply` with an API token (permissions below). Confirm the custom domain attaches, the DNS record and certificate appear, and `https://<host>/` answers.
2. Secret survival (decides Path A or B): `wrangler secret put TEST_SECRET`; change `worker.js`; `tofu apply` (with `keep_bindings = ["secret_text"]`); run `wrangler secret list`. If `TEST_SECRET` is gone, or `tofu plan` shows a secret diff, Path A is dead. Repeat once with `keep_bindings` removed to see the baseline.
3. `tofu plan` after apply must be empty (no drift from the computed `bindings` list and `plain_text` values).
4. Confirm the workers.dev URL returns an error after apply, and that preview URLs are off.
5. Confirm the apex/other records of musclog.app are unchanged in the DNS dashboard before/after.

## Path recommendation: B (Terraform for D1, cron, domain, subdomain; `wrangler deploy` uploads code)
Reasons:
- Official docs say wrangler keeps secrets ("Secrets not included in the file are preserved from the previous version"), while nothing official says a Terraform upload does. The only `keep_bindings` references I found are in a different tool's issues (alchemy #2757/#2800) with conflicting reports, and the provider's own `secret_text` handling has had regressions (#5892; v5.9/5.10 reports).
- Path A is acceptable only if step 2 above passes on the real provider version. Even then, `bindings` is optional+computed and `text` is sensitive, so drift handling is the risk.
- Under B, keep Terraform's `cloudflare_workers_script` out of the config entirely (Terraform cannot own a script wrangler uploads without fighting it); the `custom_domain`, `subdomain` and `cron` resources reference the script by name only. Caveat: the subdomain/cron resources need the script to exist, so the first `wrangler deploy` precedes the first `apply`. Wrangler's own `workers_dev = false` also disables workers.dev on deploy, but the docs say that disabling it does not disable Version/Preview/Deployment URLs, so keep the Terraform subdomain resource for `previews_enabled = false` (or turn previews off in wrangler config too).

## Domain recommendation
- `api.musclog.app` cannot be used: it is live and serves the Musclog Barcode API that shipped app versions call (`hooks/useFoodProductDetails.ts:133`). Docs: "You cannot create a Custom Domain on a hostname with an existing CNAME DNS record"; for other record types the docs are silent (behavior unverified), and attaching would at best fail and at worst redirect barcode traffic to the Premium Worker.
- Recommend `ai.musclog.app` (fresh, does not resolve today, one level under the apex). `premium.musclog.app` and `hosted.musclog.app` are equally fine; `ai` is the shortest and is the variable default. This stays a placeholder until the owner decides.
- Route-based sharing of `api.musclog.app` (a Workers route on a path) is deliberately not recommended: it would put the Premium Worker in front of the live API's traffic.

## Fee-free checklist for the domain
- Hostname is a single level under the zone (Universal SSL: "covers the apex and one level of subdomain only"; available on Free).
- No existing CNAME (or any record) for the hostname: check `dig ai.musclog.app` and the DNS dashboard.
- Custom Domains: docs state "Cloudflare will create DNS records and issue necessary certificates on your behalf" and "no separate Advanced Certificate Manager subscription is required". The pages I fetched give no price and no plan restriction, and only list a 100-per-zone limit; I found no official statement that Free zones are excluded, but also no explicit "free" sentence: verify in step 1 of the real-account proof.
- Do not enable Advanced Certificate Manager, Total TLS or any paid add-on.
- Zone WAF rate limiting on Free: 1 rule, IP characteristic only, 10 s period, 10 s timeout, the action is the one mitigation action; fine as an optional guard, not needed.
- Leave the zone plan on Free; never click upgrade prompts.

## Cited docs (quotes are verbatim from the fetched pages)
a. Custom Domains, https://developers.cloudflare.com/workers/configuration/routing/custom-domains/: "Cloudflare will create DNS records and issue necessary certificates on your behalf."; "You cannot create a Custom Domain on a hostname with an existing CNAME DNS record or on a zone you do not own."; "Universal SSL covers the apex and one level of subdomain only."; "An incoming request must exactly match the domain or subdomain your Custom Domain is registered to" (wildcards unsupported, so no effect on the apex or sibling hostnames). Cost and plan availability: not stated on the page.
b. workers.dev, https://developers.cloudflare.com/workers/configuration/routing/workers-dev/: "All Workers are assigned a `workers.dev` route when they are created or renamed."; `workers_dev = false` disables it on redeploy; "Disabling your `workers.dev` route does not disable" Version, Preview or Deployment URLs; the dashboard disable is undone if "the `workers.dev` route will be re-enabled the next time you deploy your Worker with Wrangler". Terraform is not mentioned there; the provider schema exposes `enabled` and `previews_enabled`.
c. Rate-limit binding, https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/: period "Must be either 10 or 60"; "Rate limits are approximate and apply separately in each Cloudflare location."; needs Wrangler 4.36.0+. Plan availability (Free) is NOT stated: gate G3 stays open and needs the real-account test (add a `ratelimit` binding, deploy on Free, see whether it is accepted).
d. WAF rate limiting, https://developers.cloudflare.com/waf/rate-limiting-rules/: Free plan: rules "1"; counting characteristics "IP"; counting period and mitigation timeout "10 s"; fields "Path, Verified Bot".
e. Billing, https://developers.cloudflare.com/workers/platform/pricing/: "By default, users have access to the Workers Free plan."; Paid has "a minimum charge of $5 USD per month for an account". The page does not say whether a card is needed; cloudflare.com/products/workers/ markets "no credit card required" (secondary evidence). D1 pricing page: "Upgrading to the Workers Paid plan will remove these limits". Nothing I found describes an automatic upgrade; upgrade is an explicit action. To confirm no card: Dashboard > Account Home > Billing > Payment Methods must be empty and Billing > Subscriptions must list no Workers Paid; this is not documented as a single official page, so it is a manual check. R2 is avoided because it needs a card (plan section 4).
f. Universal SSL, https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/: "free, unshared, publicly trusted SSL certificates", Free column "Yes"; full setup covers "your root domain" and "first-level subdomains", so `ai.musclog.app` is covered.
g. D1 free, https://developers.cloudflare.com/d1/platform/pricing/: Free limits 5 million rows read/day, 100,000 rows written/day, 5 GB, 10 databases; at the limit "you will not be able to run queries against D1" (no charge). Cron Triggers, https://developers.cloudflare.com/workers/platform/limits/: "Number of Cron Triggers per account": Free 5, Paid 1,000.
h. Secrets/keep_bindings: https://developers.cloudflare.com/workers/configuration/secrets/ says wrangler-handled "Secrets not included in the file are preserved from the previous version" and "wrangler secret put creates a new version of the Worker and deploys it immediately" (wrangler path only). IaC page, https://developers.cloudflare.com/workers/platform/infrastructure-as-code/: `secret_text` "The secret value (will be encrypted)" and `content_file` keeps code out of state; it does not mention `keep_bindings`. Provider issues: https://github.com/cloudflare/terraform-provider-cloudflare/issues/5892 (secret_text replaced on every deploy; fixed 5.8.3, regressions reported later), /issues/7222 (secret values stored plaintext in state, open), /issues/1857 (ignore_changes failed, not planned). No provider issue found for `keep_bindings` itself.

## Minimal API token permissions (Account-owned or user token, for later; not created now)
Scope the token to the one account and the one zone `musclog.app`, with no Zone DNS Edit and no zone-level settings.
- plan (read-only token): Account > Workers Scripts: Read; Account > D1: Read; Workers Custom Domains is covered by Workers Scripts and Zone > Workers Routes: Read on the zone; Account Settings: Read (for workers.dev subdomain). Verify empirically: the first `tofu plan` names any 403.
- apply (separate write token): Account > Workers Scripts: Edit; Account > D1: Edit; Zone > Workers Routes: Edit on musclog.app (custom domain attach); Account Settings: Read. If the attach returns 403 on the DNS record, the missing permission is Zone > DNS: Edit limited to the single zone; add it only after seeing that exact error, and review the plan to make sure no existing record appears.
- Never put either token in a tfvars, a repo or CI; pass via `CLOUDFLARE_API_TOKEN` from the environment. No token needs Billing, Secrets Store or Account API Tokens permissions.
