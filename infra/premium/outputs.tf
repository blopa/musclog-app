output "d1_database_id" {
  value = cloudflare_d1_database.db.id
}

output "worker_name" {
  value = local.worker_name
}

output "d1_name" {
  value = local.d1_name
}

output "custom_hostname" {
  value = local.is_production ? var.custom_hostname : null
}
