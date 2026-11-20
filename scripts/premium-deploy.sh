#!/usr/bin/env bash
# Deploys the Musclog Premium Worker (docs/PREMIUM_WORKER.md, plan section 5, Path B).
#
#   scripts/premium-deploy.sh <staging|production> [--dry-run]
#
# Needs CLOUDFLARE_API_TOKEN and TF_ENCRYPTION in the environment (never from a file in the
# repo; neither is ever printed; --dry-run needs neither). PREMIUM_STAGING_URL is the staging workers.dev URL for the
# smoke test. NOT YET RUN against a real account (gate G1).
set -euo pipefail

ENVIRONMENT="${1:-}"
DRY_RUN=0
[[ "${2:-}" == "--dry-run" ]] && DRY_RUN=1

case "$ENVIRONMENT" in
  staging | production) ;;
  *)
    echo "usage: $0 <staging|production> [--dry-run]" >&2
    exit 2
    ;;
esac
if [[ $# -gt 2 || ( $# -eq 2 && "$DRY_RUN" -eq 0 ) ]]; then
  echo "usage: $0 <staging|production> [--dry-run]" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT/services/premium-worker"
TF_DIR="$ROOT/infra/premium"
GENERATED="$WORKER_DIR/.wrangler/deploy-$ENVIRONMENT.toml"
PLACEHOLDER="00000000-0000-0000-0000-000000000000"
REQUIRED_SECRETS=(OPENROUTER_API_KEY REVENUECAT_V2_SECRET_KEY SESSION_HMAC_KEY)

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

confirm() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would ask: $1 (type yes)"
    return 0
  fi
  local answer
  read -r -p "$1 (type yes to continue): " answer
  [[ "$answer" == "yes" ]] || { echo "aborted" >&2; exit 1; }
}

wrangler() { run npx --prefix "$WORKER_DIR" wrangler "$@"; }
tofu_() { run tofu -chdir="$TF_DIR" "$@"; }

# 0. Preconditions (values are only tested for presence, never printed).
for tool in node npx tofu; do
  command -v "$tool" > /dev/null || { echo "missing tool: $tool" >&2; exit 1; }
done
# A dry run only reports a missing credential or variables file (it needs none, which is what
# lets CI run it with an empty environment); a real run stops.
precondition() { # <ok: 0|1> <message>
  [[ "$1" -eq 0 ]] && return 0
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] a real run would stop: $2"
  else
    echo "$2" >&2
    exit 1
  fi
}
precondition "$([[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] && echo 0 || echo 1)" "CLOUDFLARE_API_TOKEN is not set"
precondition "$([[ -n "${TF_ENCRYPTION:-}" ]] && echo 0 || echo 1)" "TF_ENCRYPTION is not set"
precondition "$([[ -f "$TF_DIR/terraform.tfvars" ]] && echo 0 || echo 1)" "create infra/premium/terraform.tfvars from terraform.tfvars.example"

# 1. Package checks.
run npm --prefix "$WORKER_DIR" ci
run npm --prefix "$WORKER_DIR" test
run npm --prefix "$WORKER_DIR" run typecheck

# 2. Terraform setup: one encrypted local state per environment.
tofu_ init -input=false
tofu_ workspace select -or-create "$ENVIRONMENT"
tofu_ fmt -check
tofu_ validate

# 3. Stage 1: D1 only (wrangler needs its id before the first deploy).
PLAN1="$TMP_DIR/stage1.tfplan"
tofu_ plan -input=false -target=cloudflare_d1_database.db -var "environment=$ENVIRONMENT" -out "$PLAN1"
tofu_ show "$PLAN1"
confirm "Apply stage 1 (D1 database only) for $ENVIRONMENT?"
tofu_ apply -input=false "$PLAN1"

# 4. Generated wrangler config with the real D1 id. It lives in the git-ignored .wrangler/
#    directory, so `main` and `migrations_dir` are rewritten relative to it.
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would read: tofu output -raw d1_database_id"
  D1_ID="<d1-id>"
else
  D1_ID="$(tofu -chdir="$TF_DIR" output -raw d1_database_id)"
  [[ -n "$D1_ID" ]] || { echo "empty d1_database_id" >&2; exit 1; }
  mkdir -p "$WORKER_DIR/.wrangler"
  ENV_NAME="$ENVIRONMENT" D1_ID="$D1_ID" PLACEHOLDER="$PLACEHOLDER" \
    SRC="$WORKER_DIR/wrangler.toml" OUT="$GENERATED" node -e '
      const fs = require("fs");
      const e = process.env;
      let section = "";
      const lines = fs.readFileSync(e.SRC, "utf8").split("\n").map((line) => {
        const m = line.match(/^\[([^\]]+)\]/);
        if (m) section = m[1];
        if (section === `env.${e.ENV_NAME}`) line = line.split(e.PLACEHOLDER).join(e.D1_ID);
        return line
          .replace(/^main = "src\//, "main = \"../src/")
          .split("migrations_dir = \"migrations\"").join("migrations_dir = \"../migrations\"");
      });
      const out = lines.join("\n");
      // Fail if the chosen environment still holds the placeholder (others keep theirs).
      const block = out.split(/^\[/m).find((b) => b.startsWith(`env.${e.ENV_NAME}]`)) || "";
      if (!block || block.includes(e.PLACEHOLDER)) {
        console.error("placeholder database_id still present in the generated config");
        process.exit(1);
      }
      fs.writeFileSync(e.OUT, out);
    '
fi

# 5. Migrations (additive, before the code).
wrangler d1 migrations apply DB --remote --env "$ENVIRONMENT" --config "$GENERATED"

# 6. Code.
wrangler deploy --env "$ENVIRONMENT" --config "$GENERATED"

# 7. Full plan: custom domain, workers.dev/previews, cron, alerts.
PLAN2="$TMP_DIR/full.tfplan"
tofu_ plan -input=false -var "environment=$ENVIRONMENT" -out "$PLAN2"
tofu_ show "$PLAN2"
confirm "Apply the full plan for $ENVIRONMENT?"
tofu_ apply -input=false "$PLAN2"

# 8. Secrets must exist (names only; values are never read or printed).
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would run: wrangler secret list and require: ${REQUIRED_SECRETS[*]}"
else
  SECRET_NAMES="$(npx --prefix "$WORKER_DIR" wrangler secret list --env "$ENVIRONMENT" --config "$GENERATED" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
      try { console.log(JSON.parse(s).map((x) => x.name).join("\n")); } catch { process.exit(1); }
    });')"
  missing=0
  for name in "${REQUIRED_SECRETS[@]}"; do
    if ! grep -qx "$name" <<< "$SECRET_NAMES"; then
      missing=1
      echo "missing secret: $name" >&2
      echo "  npx --prefix services/premium-worker wrangler secret put $name --env $ENVIRONMENT --config $GENERATED" >&2
    fi
  done
  [[ "$missing" -eq 0 ]] || exit 1
fi

# 9. Smoke test.
if [[ "$ENVIRONMENT" == "production" ]]; then
  HOST="$(tofu -chdir="$TF_DIR" output -raw custom_hostname 2> /dev/null || echo "<custom_hostname>")"
  BASE_URL="https://$HOST"
else
  BASE_URL="${PREMIUM_STAGING_URL:-}"
  if [[ -z "$BASE_URL" && "$DRY_RUN" -eq 0 ]]; then
    echo "set PREMIUM_STAGING_URL to the staging workers.dev URL for the smoke test" >&2
    exit 1
  fi
  BASE_URL="${BASE_URL:-<PREMIUM_STAGING_URL>}"
fi
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] would run: curl -fsS $BASE_URL/v1/config | JSON check"
else
  curl -fsS "$BASE_URL/v1/config" | node -e '
    let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => { JSON.parse(s); console.log("smoke test: JSON ok"); });'
fi

# 10. Deployed version.
wrangler deployments list --env "$ENVIRONMENT" --config "$GENERATED"
