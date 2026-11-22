terraform {
  required_version = "~> 1.13"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "= 5.28.1"
    }
  }

  # State and plans are encrypted. Only the method is configured here; the key provider
  # (named "main", PBKDF2 passphrase) comes from the TF_ENCRYPTION environment variable,
  # so the passphrase is never in the repository.
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

# The token comes from the environment: CLOUDFLARE_API_TOKEN.
provider "cloudflare" {}
