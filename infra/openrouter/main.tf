# Intentionally empty until the live account has been read (docs/INFRASTRUCTURE.md, phase 2).
#
# Workflow: `scripts/infra.sh export` writes infra/snapshots/openrouter/*.json; add one `import`
# block per existing key/guardrail/workspace in imports.tf (git-ignored until reviewed), run
#   tofu plan -generate-config-out=generated.tf
# review it, move it into this file, and only commit when `tofu plan` reports "No changes".
# Never import by recreating: an openrouter_api_key resource must not be replaced, because the key
# value is shown only at creation and the Premium Worker / app bundle hold the live one.

# __generated__ by OpenTofu
# Please review these resources and move them into your main configuration files.

# __generated__ by OpenTofu from "default"
resource "openrouter_workspace" "default" {
  confirm_default_workspace_deletion  = null
  default_image_model                 = null
  default_provider_sort               = null
  default_text_model                  = null
  description                         = null
  disabled_server_tools               = null
  io_logging_api_key_ids              = null
  io_logging_sampling_rate            = 1
  is_data_discount_logging_enabled    = false
  is_observability_broadcast_enabled  = false
  is_observability_io_logging_enabled = false
  name                                = "Default Workspace"
  slug                                = "default"
}

# __generated__ by OpenTofu
resource "openrouter_api_key" "oc" {
  disabled              = false
  expires_at            = null
  external              = null
  include_byok_in_limit = false
  limit                 = null
  limit_reset           = null
  name                  = "OC"
  workspace_id          = "6f7976d8-2f26-55d8-a77a-ea0d45216d9e"
}

# __generated__ by OpenTofu
resource "openrouter_api_key" "premium_prod" {
  disabled              = false
  expires_at            = "2027-11-20T23:55:00Z"
  external              = null
  include_byok_in_limit = false
  limit                 = 10
  limit_reset           = "monthly"
  name                  = "musclog-premium-prod"
  workspace_id          = "6f7976d8-2f26-55d8-a77a-ea0d45216d9e"
}

# __generated__ by OpenTofu
resource "openrouter_api_key" "free_tier" {
  disabled              = false
  expires_at            = null
  external              = null
  include_byok_in_limit = false
  limit                 = 1
  limit_reset           = "daily"
  name                  = "musclog-free-tier"
  workspace_id          = "6f7976d8-2f26-55d8-a77a-ea0d45216d9e"
}

# The free tier's guardrail (AGENTS.md: "restricted by a guardrail: the free model only, Google AI
# Studio only, a daily budget"). The key ships inside the app bundle and is public, so this is the
# only real fence around it. allowed_* must stay equal to constants/gateway.ts. Free endpoints
# train on request data, hence enable_free_model_training (without it free-tier requests fail);
# zdr is deliberately NOT enforced (no free endpoint satisfies it).
resource "openrouter_guardrail" "free_tier" {
  name                          = "musclog-free-tier"
  description                   = "Free tier: one free model, Google AI Studio only, daily budget"
  workspace_id                  = openrouter_workspace.default.id
  allowed_models                = ["google/gemma-4-31b-it:free"]
  allowed_providers             = ["google-ai-studio"]
  enable_free_model_training    = true
  enable_free_model_publication = false
  limit_usd                     = 1
  reset_interval                = "daily"
}

resource "openrouter_guardrail_key_assignment" "free_tier" {
  guardrail_id = openrouter_guardrail.free_tier.id
  key_hash     = openrouter_api_key.free_tier.hash
}
