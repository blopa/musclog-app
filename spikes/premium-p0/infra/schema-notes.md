# Provider schema notes (cloudflare/cloudflare 5.28.1, OpenTofu 1.13.2)

Source: `tofu providers schema -json` after `tofu init`. Paths are attribute paths on the resource.

## cloudflare_workers_script
- `keep_bindings`: top-level, optional, `set(string)`. Description: "List of binding types to keep from previous_upload." Exposed, so the upload API field is reachable. Whether `["secret_text"]` really preserves a `wrangler secret put` value is NOT provable offline (see REPORT.md, G1 step 2).
- `bindings_inherit`: optional string, only value `"strict"` ("upload will fail if any `inherit` type bindings cannot be resolved ... Without this, unresolvable inherit bindings are silently dropped").
- `bindings`: optional+computed, nested list. Per item: `name` (required), `type` (required), plus type-specific attributes. Accepted `type` values (from the schema description): ai, ai_search, ai_search_namespace, messaging, analytics_engine, artifacts, assets, browser, d1, data_blob, dispatch_namespace, durable_object_namespace, hyperdrive, inherit, images, json, kv_namespace, media, mtls_certificate, plain_text, pipelines, k2, queue, ratelimit, r2_bucket, secret_text, send_email, service, text_blob, vectorize, version_metadata, secrets_store_secret, flagship, secret_key, workflow, wasm_module, vpc_service, vpc_network.
- `bindings[].text`: `sensitive = true` (it carries both `plain_text` and `secret_text` values). So plan output is redacted for plain_text too, but the value is still stored in state (encrypted by the encryption block). `bindings[].json`, `key_base64`, `key_jwk` (the last two sensitive) also exist.
- `d1` binding: `type = "d1"`, `name`, and `id` ("Identifier of the D1 database to bind to"); `database_id` also exists with the same description. The spike uses `id`.
- `ratelimit` binding: `type = "ratelimit"`, `name`, `namespace_id`, `simple { limit (required number), period (required number, seconds), mitigation_timeout (optional) }`. Present in the schema, but plan availability on Free is a docs question (see REPORT.md).
- Code stays out of state with `content_file` + `content_sha256` (`content_sha256`: "Must be provided when `content_file` is specified"). `main_module` names the module file.
- `observability.enabled` (required), `observability.head_sampling_rate`, `observability.logs.{enabled, invocation_logs (both required), head_sampling_rate, persist, destinations}`.
- `limits.cpu_ms`, `limits.subrequests`; `compatibility_date`, `compatibility_flags`.

## Secret-storing resources (all put the value in state)
- `cloudflare_workers_script` binding `type = "secret_text"` + `text` (sensitive): value in state, and drift bugs (provider issue #5892: placeholder sent back on update; fixed in 5.8.3 but regressions reported on 5.9/5.10; #1857 closed as not planned; #7222 open: secret value is plaintext in state, no write-only argument).
- `cloudflare_secrets_store_secret` (`value` required+sensitive, `store_id`, `scopes`): also stores the value in state (#7222). There is NO resource that sets a Worker secret without keeping its value in state.
- Conclusion: set secrets with `wrangler secret put` only; never declare `secret_text` or a secrets-store secret in Terraform.
- Other resources that exist: `cloudflare_worker`, `cloudflare_worker_version` (new versioned model, `bindings`, `deploy`), `cloudflare_workers_deployment`, `cloudflare_workers_route`, `cloudflare_rate_limit` (the zone WAF-era resource; not used).

## cloudflare_workers_custom_domain
Attributes: `account_id` (req), `hostname` (req: "Can be either the zone apex or a subdomain of the zone"), `service` (req: "Name of the Worker associated with the domain"), `zone_id` (opt+computed), `zone_name` (opt+computed), `environment` (opt+computed, "Worker environment associated with the domain"; leave unset, it is the legacy Workers-environments field), `id` (computed), `cert_id` (computed, "ID of the TLS certificate issued for the domain"). So Cloudflare issues the certificate (and per the docs the DNS record) as part of the attach; neither is a separate resource in our config. The `cert_id` output confirms a certificate exists.

## cloudflare_workers_script_subdomain
`account_id`, `script_name` (req), `enabled` (req, "Whether the Worker should be available on the workers.dev subdomain"), `previews_enabled` (opt+computed, "Whether the Worker's Preview URLs should be available on the workers.dev subdomain"). Both can be set false, which is what wrangler docs cannot do through Terraform.

## cloudflare_workers_cron_trigger
`account_id`, `script_name` (req), `schedules` (req list of `{ cron (req), created_on, modified_on }`).

## cloudflare_d1_database
`account_id`, `name` (req); optional `jurisdiction`, `primary_location_hint`, `read_replication { mode }` (opt+computed; "auto" creates replicas; leave unset: default stays), computed `id`/`uuid`, `file_size`, `num_tables`, `version`, `created_at`. No migrations: schema changes go through `wrangler d1 migrations apply`.
