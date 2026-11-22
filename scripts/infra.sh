#!/usr/bin/env bash
# One entry point for the RevenueCat / OpenRouter infrastructure (docs/INFRASTRUCTURE.md).
#   scripts/infra.sh status|validate|plan|apply|export|report [args]
# Never prints a secret. `apply` is a dry run unless you pass --yes.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OR_DIR="$ROOT/infra/openrouter"
cmd="${1:-}"; shift || true

have() { [[ -n "${!1:-}" ]] && echo "set" || echo "MISSING"; }
tf() { (cd "$OR_DIR" && tofu "$@"); }

case "$cmd" in
  status)
    echo "OPENROUTER_MANAGEMENT_KEY: $(have OPENROUTER_MANAGEMENT_KEY)"
    echo "REVENUECAT_INFRA_KEY:      $(have REVENUECAT_INFRA_KEY)"
    echo "REVENUECAT_PROJECT_ID:     $(have REVENUECAT_PROJECT_ID)"
    echo "TF_ENCRYPTION:             $(have TF_ENCRYPTION)"
    ;;
  validate)
    node -e "for (const n of ['entitlements','offerings','products']) { const f='$ROOT/infra/revenuecat/config/'+n+'.json'; const j=JSON.parse(require('fs').readFileSync(f,'utf8')); if(!Array.isArray(j.items)) throw new Error(f+': items must be an array'); } console.log('revenuecat config: ok')"
    tf init -backend=false -input=false >/dev/null
    tf validate
    ;;
  plan)
    node "$ROOT/scripts/infra/revenuecat.js" plan "$@" || [[ $? -eq 3 ]]   # 3 = drift, not failure
    tf init -input=false >/dev/null
    tf plan -input=false -lock-timeout=30s
    ;;
  apply)
    node "$ROOT/scripts/infra/revenuecat.js" apply "$@"
    echo "OpenRouter: run 'cd infra/openrouter && tofu apply' yourself after reading the plan (never automated)."
    ;;
  export)
    node "$ROOT/scripts/infra/revenuecat.js" export "$@"
    node "$ROOT/scripts/infra/openrouter.js" export "$@"
    ;;
  report)
    node "$ROOT/scripts/infra/revenuecat.js" report --json "$@"
    node "$ROOT/scripts/infra/openrouter.js" report --json "$@"
    ;;
  *)
    echo "usage: $0 status|validate|plan|apply|export|report" >&2
    exit 2
    ;;
esac
