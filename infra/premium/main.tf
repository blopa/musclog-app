# Path B (docs/plans/musclog-premium.md section 5): wrangler uploads the Worker code and keeps
# its secrets; Terraform owns everything around the script. There is deliberately NO
# cloudflare_workers_script resource and NO secret resource of any kind, so no secret can
# reach the state. The resources below reference the script by name, so the first
# `wrangler deploy` comes before the first full apply (scripts/premium-deploy.sh does D1 first).

locals {
  is_production = var.environment == "production"

  # Must equal `name` of [env.production] / [env.staging] in services/premium-worker/wrangler.toml.
  worker_name = local.is_production ? "musclog-premium" : "musclog-premium-staging"
  # Must equal `database_name` of the same environment in wrangler.toml.
  d1_name = local.is_production ? "musclog-premium-db" : "musclog-premium-staging-db"
}

# No read_replication: the ledger's read-back after a write must hit the primary.
resource "cloudflare_d1_database" "db" {
  account_id = var.account_id
  name       = local.d1_name

  lifecycle {
    prevent_destroy = true
  }
}

# Production only. Never api.musclog.app (the live Barcode API); see variables.tf.
resource "cloudflare_workers_custom_domain" "worker" {
  count = local.is_production ? 1 : 0

  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.custom_hostname
  service    = local.worker_name
}

# Production: workers.dev off. Staging runs on workers.dev. Preview URLs are off in both
# (wrangler's `workers_dev = false` does not disable them).
resource "cloudflare_workers_script_subdomain" "worker" {
  account_id       = var.account_id
  script_name      = local.worker_name
  enabled          = !local.is_production
  previews_enabled = false
}

# The Worker dispatches on these exact strings: QUARTER_HOURLY_CRON and DAILY_CRON in
# services/premium-worker/src/app.ts. Free allows 5 cron triggers per account.
resource "cloudflare_workers_cron_trigger" "worker" {
  account_id  = var.account_id
  script_name = local.worker_name
  schedules = [
    { cron = "*/15 * * * *" },
    { cron = "30 0 * * *" },
  ]
}

# Alerts. The provider schema has no Workers-specific alert type (error rate, CPU, D1) and
# billing_usage_alert is for usage-based billing on paid plans, so only account-level types
# that are not tied to a paid add-on are used. NOT VERIFIED that either works on the Free
# plan with a real account (gate G1); if the apply is refused, delete the resource and rely
# on the smoke test and the breaker instead.
resource "cloudflare_notification_policy" "incident" {
  count = var.alert_email == "" ? 0 : 1

  account_id  = var.account_id
  name        = "${local.worker_name}: Cloudflare incidents"
  description = "Cloudflare platform incidents (Workers, D1 outages)."
  alert_type  = "incident_alert"
  enabled     = true

  mechanisms = {
    email = [{ id = var.alert_email }]
  }
}

# Certificate events for the custom domain. Production only; same Free-plan caveat as above.
resource "cloudflare_notification_policy" "certificate" {
  count = var.alert_email != "" && local.is_production ? 1 : 0

  account_id  = var.account_id
  name        = "${local.worker_name}: Universal SSL events"
  description = "Certificate issuance and renewal events for ${var.custom_hostname}."
  alert_type  = "universal_ssl_event_type"
  enabled     = true

  mechanisms = {
    email = [{ id = var.alert_email }]
  }
}
