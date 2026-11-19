#!/usr/bin/env bash
# Shared helpers for scripts/setup-asc.sh, release-ios.sh and appstore.sh.
# Sourced, never executed. The App Store side of gplay-common.sh. See docs/APP_STORE.md.
#
# `asc` (https://github.com/rorkai/App-Store-Connect-CLI) keeps its sign-ins as named profiles (in the system
# keychain, or ~/.asc/config.json), one of them the default. Another repo on this machine may use asc too, so
# Musclog signs in under a profile of its own and selects it on every call (ASC_PROFILE), with ASC_STRICT_AUTH
# so credentials are never pieced together from that profile and stray ASC_* variables.
#
# MUSCLOG_ASC_PROFILE overrides the name. A plain ASC_PROFILE exported in the shell is deliberately not read:
# it may be another app's, and this repo must never act as that one.

ASC_VERSION_PINNED="6.3.0"          # what setup-asc.sh installs; bump deliberately, after reading the changelog
ASC_PROFILE_NAME="${MUSCLOG_ASC_PROFILE:-musclog}"
ASC_KEY_NAME="musclog-asc-AuthKey.p8"
# The release's own checksums file is downloaded with the binary, so a swapped release would swap both.
# These are the SHA-256 of asc 6.3.0, read from its release page on 2026-11-18 (asc_6.3.0_checksums.txt).
ASC_SHA256_LINUX_AMD64="bbe4a4d734d090bd3940b9b709394e979f1b576ea23421b78dce3c555f2d47a8"
ASC_SHA256_LINUX_ARM64="99ffa264554362ab6d79cb4aa548e1ef4b0f0d91c0df729216ff171273ea935a"

export PATH="$HOME/.local/bin:$PATH"
# asc sends usage telemetry by default; this repo opts out on every call.
export ASC_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1
# Keychain-less machines (this one): setup-asc.sh --bypass-keychain stores the profile in
# ~/.asc/config.json, and then every call has to say so too.
[[ "${MUSCLOG_ASC_BYPASS_KEYCHAIN:-0}" == 1 ]] && export ASC_BYPASS_KEYCHAIN=1

die() { echo "error: $*" >&2; exit 1; }
note() { echo "==> $*" >&2; }

repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

need() {
  command -v "$1" >/dev/null 2>&1 || die "$1 is required but not on PATH. $2"
}

# A value out of a JSON file: json_value FILE 'a.b.c' (empty when anything on the path is missing).
json_value() {
  python3 -I - "$1" "$2" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1], encoding="utf-8"))
    for k in sys.argv[2].split("."):
        d = d[k]
    print("" if d is None else d)
except (OSError, ValueError, KeyError, TypeError):
    pass
PY
}

# --- what the scripts need to know about the app: one place each ---------------------------------------------
# The App Store Connect app id lives in eas.json (what `eas submit` reads), nowhere else.
asc_app_id() {
  local id
  id="$(json_value "$(repo_root)/eas.json" submit.production.ios.ascAppId)"
  [[ "$id" =~ ^[0-9]+$ ]] || die "no numeric submit.production.ios.ascAppId in eas.json."
  printf '%s' "$id"
}

app_bundle_id() { json_value "$(repo_root)/app.json" expo.ios.bundleIdentifier; }
app_version() { json_value "$(repo_root)/app.json" expo.version; }
app_build_number() { json_value "$(repo_root)/app.json" expo.ios.buildNumber; }

# Is the version a plain x.y.z and the build number a whole number? (Apple: up to three period-separated
# integers; the build number must rise with every upload of one version.)
version_is_sane() { [[ "$(app_version)" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; }
build_number_is_sane() { [[ "$(app_build_number)" =~ ^[1-9][0-9]*$ ]]; }

# The store listing as files, like android/play.
APPSTORE_DIR="$(repo_root)/ios/appstore"
APPSTORE_META="${MUSCLOG_APPSTORE_META:-$APPSTORE_DIR/metadata}"   # the env var is for tests
APPSTORE_APP_JSON="$APPSTORE_DIR/app.json"   # committed, nothing secret: { "testflightGroup": "..." }

appstore_value() { json_value "$APPSTORE_APP_JSON" "$1"; }

# --- the asc binary and its profile -------------------------------------------------------------------------
# Another tool could be called asc; this one has `xcode-cloud` and `metadata` commands.
asc_is_ours() {
  command -v asc >/dev/null 2>&1 && asc --help 2>&1 | grep -q 'metadata:'
}

require_asc() {
  need asc "Run scripts/setup-asc.sh."
  asc_is_ours || die "'asc' on PATH ($(command -v asc)) is not the App Store Connect CLI (rorkai/App-Store-Connect-CLI). Run scripts/setup-asc.sh."
}

# Does the named profile exist? (`asc auth status --output json` lists {"credentials": [{"name": ...}]}.)
asc_profile_ok() {
  command -v asc >/dev/null 2>&1 || return 1
  asc auth status --output json 2>/dev/null | python3 -I -c '
import json, sys
try:
    s = json.load(sys.stdin)
except ValueError:
    sys.exit(1)
sys.exit(0 if any(c.get("name") == sys.argv[1] for c in s.get("credentials") or []) else 1)' "$1"
}

# Pin every asc call in the calling script to this repo's profile, or stop.
use_asc_profile() {
  require_asc
  export ASC_PROFILE="$ASC_PROFILE_NAME" ASC_STRICT_AUTH=true
  asc_profile_ok "$ASC_PROFILE" \
    || die "asc profile '$ASC_PROFILE' is not signed in. Run scripts/setup-asc.sh."
}

# Reads a field out of asc's JSON on stdin: json_get 'expression using d'. Understands both
# {"data": {...}} and a bare object.
json_get() {
  python3 -I -c "
import json, sys
d = json.load(sys.stdin)
print($1)"
}
