resource "cloudflare_d1_database" "db" {
  account_id = var.account_id
  name       = "${var.worker_name}-db"

  lifecycle {
    prevent_destroy = true
  }
}

resource "cloudflare_workers_script" "worker" {
  account_id     = var.account_id
  script_name    = var.worker_name
  content_file   = "${path.module}/worker.js"
  content_sha256 = filesha256("${path.module}/worker.js")
  main_module    = "worker.js"
  # Path A candidate: keep wrangler-set secrets across uploads (needs real-account proof, see REPORT.md).
  keep_bindings      = ["secret_text"]
  compatibility_date = "2026-11-01"

  bindings = [
    {
      type = "d1"
      name = "DB"
      id   = cloudflare_d1_database.db.id
    },
    {
      type = "plain_text"
      name = "HOSTED_AI_ENABLED"
      text = "true"
    },
  ]
}

# workers.dev route off in production; previews off too.
resource "cloudflare_workers_script_subdomain" "worker" {
  account_id       = var.account_id
  script_name      = cloudflare_workers_script.worker.script_name
  enabled          = false
  previews_enabled = false
}

resource "cloudflare_workers_custom_domain" "worker" {
  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.custom_hostname
  service    = cloudflare_workers_script.worker.script_name
}

resource "cloudflare_workers_cron_trigger" "worker" {
  account_id  = var.account_id
  script_name = cloudflare_workers_script.worker.script_name
  schedules = [
    { cron = "*/10 * * * *" },
  ]
}
