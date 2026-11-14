#!/usr/bin/env bash
# Shared helpers for scripts/setup-gplay.sh, release-android.sh and play.sh.
# Sourced, never executed. See docs/GOOGLE_PLAY.md.

PACKAGE="com.werules.logger"
APP_KEY_NAME="musclog-play-service-account.json"
GPLAY_PROFILE_NAME="${GPLAY_PROFILE:-musclog}"

die() { echo "error: $*" >&2; exit 1; }
note() { echo "==> $*" >&2; }

# gplay setup --auto installs gcloud here without touching PATH.
if [[ -d "$HOME/google-cloud-sdk/bin" ]]; then
  PATH="$HOME/google-cloud-sdk/bin:$PATH"
fi

repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not on PATH. $2"
}

# The tamtom/play-console-cli binary has `preflight`; an unrelated "gplay"
# (PollyGlot) does not. Refuse the wrong one.
require_gplay() {
  need gplay "Run scripts/setup-gplay.sh."
  gplay preflight --help >/dev/null 2>&1 \
    || die "this gplay has no 'preflight' command; it is not tamtom/play-console-cli. Run scripts/setup-gplay.sh."
}

# Is a service-account key file usable? An empty file is what a failed
# `gcloud iam service-accounts keys create` leaves behind, so existence is not enough.
key_file_ok() {
  local f="$1"
  [[ -s "$f" ]] || return 1
  python3 -I - "$f" <<'PY' >/dev/null 2>&1
import json, sys
d = json.load(open(sys.argv[1]))
assert d.get("client_email") and d.get("private_key")
PY
}

# `gplay auth doctor` exits 0 even with no profile configured, so read
# `gplay auth status` and check the named profile and its key file instead.
auth_ok() {
  local name="${1:-$GPLAY_PROFILE_NAME}" status key
  status="$(gplay auth status 2>/dev/null)" || return 1
  key="$(printf '%s' "$status" | jq -r --arg n "$name" '[.profiles[]? | select(.name == $n)][0].key_path // empty')"
  [[ -n "$key" ]] && key_file_ok "$key"
}

# Use the Musclog profile for every gplay call in the calling script.
use_profile() {
  export GPLAY_PROFILE="$GPLAY_PROFILE_NAME"
  export GPLAY_PACKAGE="$PACKAGE"
  auth_ok "$GPLAY_PROFILE_NAME" \
    || die "gplay profile '$GPLAY_PROFILE_NAME' is not set up with a valid key. Run scripts/setup-gplay.sh."
}

# --- edits -------------------------------------------------------------------
# Play allows one open edit per app. Every command that opens one registers an
# EXIT trap that deletes it unless it was committed.
EDIT_ID=""
EDIT_COMMITTED=0

edit_cleanup() {
  if [[ -n "$EDIT_ID" && "$EDIT_COMMITTED" -eq 0 ]]; then
    gplay edits delete --package "$PACKAGE" --edit "$EDIT_ID" --confirm >/dev/null 2>&1 || true
  fi
}

open_edit() {
  local out
  out="$(gplay edits create --package "$PACKAGE")" || die "could not open an edit (403 usually means the service account is not invited in Play Console; see docs/GOOGLE_PLAY.md)."
  EDIT_ID="$(printf '%s' "$out" | jq -r '.id // empty')"
  [[ -n "$EDIT_ID" ]] || die "no edit id in: $out"
  EDIT_COMMITTED=0
  trap edit_cleanup EXIT
}

# --- versions ----------------------------------------------------------------
local_version_code() {
  sed -nE 's/^[[:space:]]*versionCode[[:space:]]+([0-9]+).*/\1/p' "$(repo_root)/android/app/build.gradle" | head -1
}

local_version_name() {
  sed -nE 's/^[[:space:]]*versionName[[:space:]]+"([^"]+)".*/\1/p' "$(repo_root)/android/app/build.gradle" | head -1
}

# Highest versionCode on any track, from an already-open edit. Prints 0 for none.
highest_play_version_code() {
  gplay tracks list --package "$PACKAGE" --edit "$EDIT_ID" \
    | jq '[.. | objects | .versionCodes? // empty | .[] | tonumber] | max // 0'
}
