#!/usr/bin/env bash
# Chooses the AI gateway the Musclog Iron Worker sends Iron requests through (OpenRouter or Otari),
# by writing one row in the Worker's D1 database (table `meta`, key `upstream`).
#
#   scripts/premium-upstream.sh <staging|production> status [--dry-run]
#   scripts/premium-upstream.sh <staging|production> set <openrouter|otari> [--yes] [--consent-ready]
#
# `set` without --yes is a dry run: it prints the SQL and the command and changes nothing.
# Needs CLOUDFLARE_API_TOKEN for a real run (presence only, never printed) and the generated
# services/premium-worker/.wrangler/deploy-<env>.toml that scripts/premium-deploy.sh writes.
# A dry run needs neither, so CI runs it with an empty environment.
# Takes effect within 30 seconds (each Worker isolate caches it); the app's /v1/config cache
# settles within 5 minutes.
set -euo pipefail

usage() {
  echo "usage: $0 <staging|production> status [--dry-run]" >&2
  echo "       $0 <staging|production> set <openrouter|otari> [--yes] [--consent-ready]" >&2
  exit 2
}

ENVIRONMENT="${1:-}"
ACTION="${2:-}"
case "$ENVIRONMENT" in
  staging | production) ;;
  *) usage ;;
esac

DRY_RUN=0
YES=0
CONSENT_READY=0
UPSTREAM=""
case "$ACTION" in
  status)
    shift 2
    for arg in "$@"; do
      case "$arg" in
        --dry-run) DRY_RUN=1 ;;
        *) usage ;;
      esac
    done
    ;;
  set)
    UPSTREAM="${3:-}"
    case "$UPSTREAM" in
      openrouter | otari) ;;
      *) usage ;;
    esac
    shift 3
    for arg in "$@"; do
      case "$arg" in
        --yes) YES=1 ;;
        --consent-ready) CONSENT_READY=1 ;;
        --dry-run) DRY_RUN=1 ;;
        *) usage ;;
      esac
    done
    # Without --yes a set is a dry run.
    [[ "$YES" -eq 1 ]] || DRY_RUN=1
    ;;
  *) usage ;;
esac

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKER_DIR="$ROOT/services/premium-worker"
SOURCE_TOML="$WORKER_DIR/wrangler.toml"
GENERATED="$WORKER_DIR/.wrangler/deploy-$ENVIRONMENT.toml"

run() {
  if [[ "$DRY_RUN" -eq 1 ]]; then
    printf '[dry-run]'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

# Reads one fact from the committed wrangler.toml for this environment (read-only):
# the D1 database name, and whether AI_CONFIG_JSON has an `otari` block.
read_config() { # <database-name|has-otari>
  ENV_NAME="$ENVIRONMENT" SRC="$SOURCE_TOML" WANT="$1" node -e '
    const fs = require("fs");
    const e = process.env;
    let section = "";
    let dbName = "";
    let configJson = "";
    for (const line of fs.readFileSync(e.SRC, "utf8").split("\n")) {
      const m = line.match(/^\[([^\]]+)\]/);
      if (m) section = m[1];
      if (section === `env.${e.ENV_NAME}`) {
        const name = line.match(/database_name = "([^"]+)"/);
        if (name && !dbName) dbName = name[1];
      }
      if (section === `env.${e.ENV_NAME}.vars`) {
        const json = line.match(/^AI_CONFIG_JSON = \x27(.*)\x27\s*$/);
        if (json) configJson = json[1];
      }
    }
    if (e.WANT === "database-name") {
      if (!dbName) { console.error("no d1 database_name for this environment"); process.exit(1); }
      console.log(dbName);
    } else {
      if (!configJson) { console.log("no"); process.exit(0); }
      const config = JSON.parse(configJson);
      console.log(Object.prototype.hasOwnProperty.call(config, "otari") ? "yes" : "no");
    }
  '
}

# Preconditions (values are only tested for presence, never printed).
command -v node > /dev/null || { echo "missing tool: node" >&2; exit 1; }
command -v npx > /dev/null || { echo "missing tool: npx" >&2; exit 1; }
[[ -f "$SOURCE_TOML" ]] || { echo "missing wrangler config: $SOURCE_TOML" >&2; exit 1; }

DATABASE_NAME="$(read_config database-name)"
HAS_OTARI="$(read_config has-otari)"

precondition_fail() { # <message>
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] a real run would stop: $1"
  else
    echo "$1" >&2
    exit 1
  fi
}
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || precondition_fail "CLOUDFLARE_API_TOKEN is not set"
[[ -f "$GENERATED" ]] || precondition_fail "run scripts/premium-deploy.sh $ENVIRONMENT first (it writes $GENERATED)"

wrangler() { run npx --prefix "$WORKER_DIR" wrangler "$@"; }

if [[ "$ACTION" == "status" ]]; then
  if [[ "$DRY_RUN" -eq 1 ]]; then
    echo "[dry-run] would read the upstream row from $DATABASE_NAME ($ENVIRONMENT)"
    echo "[dry-run] would run: wrangler d1 execute (SELECT value FROM meta WHERE key = 'upstream')"
  else
    RESULT="$(npx --prefix "$WORKER_DIR" wrangler d1 execute "$DATABASE_NAME" --remote \
      --config "$GENERATED" --env "$ENVIRONMENT" --json \
      --command "SELECT value FROM meta WHERE key = 'upstream'")"
    CURRENT="$(node -e '
      let s = ""; process.stdin.on("data", (d) => (s += d)).on("end", () => {
        const parsed = JSON.parse(s);
        const rows = Array.isArray(parsed) && Array.isArray(parsed[0]?.results) ? parsed[0].results : [];
        console.log(rows.length === 0 ? "openrouter (no row: default)" : rows[0].value);
      });' <<< "$RESULT")"
    echo "upstream: $CURRENT"
  fi
  echo "otari block in AI_CONFIG_JSON ($ENVIRONMENT): $HAS_OTARI"
  exit 0
fi

# set
if [[ "$UPSTREAM" == "otari" ]]; then
  if [[ "$HAS_OTARI" != "yes" ]]; then
    echo "refused: AI_CONFIG_JSON for $ENVIRONMENT has no otari block in services/premium-worker/wrangler.toml" >&2
    exit 1
  fi
  if [[ "$ENVIRONMENT" == "production" && "$CONSENT_READY" -eq 0 ]]; then
    echo "refused: the consent and privacy copy must name Otari before production uses it;" >&2
    echo "         see docs/PREMIUM_WORKER.md, then pass --consent-ready" >&2
    exit 1
  fi
fi

SQL="INSERT INTO meta (key, value) VALUES ('upstream', '$UPSTREAM') ON CONFLICT(key) DO UPDATE SET value = excluded.value"
if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "[dry-run] SQL: $SQL"
  echo "[dry-run] nothing changed; pass --yes to write it"
fi
wrangler d1 execute "$DATABASE_NAME" --remote --config "$GENERATED" --env "$ENVIRONMENT" --command "$SQL"
if [[ "$DRY_RUN" -eq 0 ]]; then
  echo "upstream set to $UPSTREAM for $ENVIRONMENT."
  echo "Takes effect within 30 seconds (each Worker isolate caches it); the app's /v1/config cache settles within 5 minutes."
fi
