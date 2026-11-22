variable "account_id" {
  type        = string
  description = "Cloudflare account id (not a secret)."
}

variable "zone_id" {
  type        = string
  description = "Zone id of musclog.app. The zone and every existing record stay unmanaged."
}

variable "environment" {
  type        = string
  description = "staging or production. One encrypted local state per environment (tofu workspace)."

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "environment must be \"staging\" or \"production\"."
  }
}

variable "custom_hostname" {
  type        = string
  default     = "ai.musclog.app"
  description = "Production hostname of the Worker (confirmed by the maintainer). NEVER api.musclog.app: it is the live Barcode API."

  validation {
    condition     = var.custom_hostname != "api.musclog.app"
    error_message = "api.musclog.app is the live Barcode API and must never point at the premium Worker."
  }
}

variable "alert_email" {
  type        = string
  default     = ""
  description = "Email for Cloudflare notification policies. Empty disables them."
}
