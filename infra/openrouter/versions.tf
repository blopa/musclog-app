terraform {
  required_version = "~> 1.13"

  required_providers {
    openrouter = {
      source  = "OpenRouterTeam/openrouter"
      version = "~> 0.3"
    }
  }

  # Same convention as infra/premium: state and plans are encrypted, the passphrase comes from
  # the TF_ENCRYPTION environment variable (key provider "main"), never from the repository.
  encryption {
    method "aes_gcm" "main" {
      keys = key_provider.pbkdf2.main
    }
    state {
      method   = method.aes_gcm.main
      enforced = true
    }
    plan {
      method   = method.aes_gcm.main
      enforced = true
    }
  }
}

# The management key comes from OPENROUTER_MANAGEMENT_KEY. It is NOT the Premium Worker's
# inference key and NOT the free tier's key in the app bundle.
provider "openrouter" {}
