variable "account_id" {
  type        = string
  description = "Cloudflare account id (not a secret)."
}

variable "zone_id" {
  type        = string
  description = "Zone id of musclog.app. The zone and every existing record stay unmanaged."
}

variable "custom_hostname" {
  type        = string
  default     = "ai.musclog.app"
  description = "PLACEHOLDER pending the owner's decision. Never api.musclog.app (live Barcode API)."
}

variable "worker_name" {
  type    = string
  default = "musclog-premium-p0"
}
