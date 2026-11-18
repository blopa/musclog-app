#!/usr/bin/env bash
# One-command setup of App Store publishing on a fresh machine. Idempotent. Works on Linux: nothing here needs
# a Mac, because the builds run on EAS.
#
#   scripts/setup-asc.sh [--key PATH] [--key-id ID] [--issuer-id ID] [--group NAME] [--bypass-keychain]
#
# 1. installs asc (rorkai/App-Store-Connect-CLI) pinned at the version in lib/asc-common.sh, into ~/.local/bin,
#    checked against its SHA-256 (downloaded to a temp dir first, never piped to a shell)
# 2. signs asc in with an App Store Connect API key under the profile "musclog" (the machine's default profile,
#    if there was one, stays the default). Key: ~/keys/musclog-asc-AuthKey.p8, or any ~/keys/AuthKey_*.p8.
# 3. checks the app (ascAppId in eas.json) is reachable and the TestFlight group exists, and writes the group's
#    name to ios/appstore/app.json (committed, nothing secret)
# 4. checks the rest of what a release needs and prints what is missing. See docs/APP_STORE.md.
#
# The API key is a secret: keep it outside the repo. To make one: App Store Connect -> Users and Access ->
# Integrations -> App Store Connect API -> Team Keys -> (+), name "Musclog CLI", access "App Manager".
# Download the .p8 at once (Apple offers it once) and note the Key ID and the Issuer ID above the table.
# --bypass-keychain stores the profile in ~/.asc/config.json instead of the system keychain (a machine without
# one); then export MUSCLOG_ASC_BYPASS_KEYCHAIN=1 in your shell profile.
set -euo pipefail
# shellcheck source=lib/asc-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/asc-common.sh"

KEY="" KEY_ID="" ISSUER_ID="" GROUP="" BYPASS=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) KEY="${2:?--key needs a path}"; shift 2 ;;
    --key-id) KEY_ID="${2:?--key-id needs a value}"; shift 2 ;;
    --issuer-id) ISSUER_ID="${2:?--issuer-id needs a value}"; shift 2 ;;
    --group) GROUP="${2:?--group needs a name}"; shift 2 ;;
    --bypass-keychain) BYPASS=1; export ASC_BYPASS_KEYCHAIN=1; shift ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

ASC_TMP=""
missing=0
miss() { echo "  MISSING: $*" >&2; missing=1; }
step() { printf '\n== %s\n' "$*"; }
ok() { printf '   ok: %s\n' "$*"; }
need python3 "Install python3."

# --- 1. asc ------------------------------------------------------------------------------------------------
install_asc() {
  local arch os want have base file
  os="$(uname -s)"
  if [[ "$os" == Darwin ]] && command -v brew >/dev/null 2>&1; then
    note "installing asc with Homebrew (Homebrew's version may differ from the pinned $ASC_VERSION_PINNED)"
    brew install asc
    return
  fi
  [[ "$os" == Linux ]] || die "no asc build is set up for $os here; install $ASC_VERSION_PINNED from its releases page."
  need curl "Install curl first."
  case "$(uname -m)" in
    x86_64|amd64) arch=amd64; want="$ASC_SHA256_LINUX_AMD64" ;;
    aarch64|arm64) arch=arm64; want="$ASC_SHA256_LINUX_ARM64" ;;
    *) die "no asc build for $(uname -m)." ;;
  esac
  file="asc_${ASC_VERSION_PINNED}_linux_${arch}"
  base="https://github.com/rorkai/App-Store-Connect-CLI/releases/download/$ASC_VERSION_PINNED"
  ASC_TMP="$(mktemp -d)"
  trap 'rm -rf "$ASC_TMP"' EXIT
  note "downloading $file to $ASC_TMP (not piped to a shell)"
  curl -fsSL -o "$ASC_TMP/asc" "$base/$file"
  have="$(sha256sum "$ASC_TMP/asc" | cut -d' ' -f1)"
  [[ "$have" == "$want" ]] || die "$file does not match the pinned SHA-256 (got $have); not installed."
  mkdir -p "$HOME/.local/bin"
  install -m 755 "$ASC_TMP/asc" "$HOME/.local/bin/asc"
}

step "asc"
if asc_is_ours; then
  ok "installed: $(command -v asc) ($(asc version 2>/dev/null | head -1))"
  have_v="$(asc version 2>/dev/null | sed -nE '1s/^([0-9]+\.[0-9]+\.[0-9]+).*/\1/p')"
  [[ "$have_v" == "$ASC_VERSION_PINNED" ]] \
    || echo "   NOTE: this repo's scripts are written for asc $ASC_VERSION_PINNED; installed is ${have_v:-unknown}. Remove it and rerun to install the pinned one." >&2
else
  if command -v asc >/dev/null 2>&1; then
    die "'asc' on PATH ($(command -v asc)) is not the App Store Connect CLI. Remove it or put ~/.local/bin first on PATH, then rerun."
  fi
  install_asc
  asc_is_ours || die "asc is installed but is not the App Store Connect CLI, or is not on PATH."
  ok "installed: $(command -v asc) ($(asc version 2>/dev/null | head -1))"
fi
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "   add to your shell profile:  export PATH=\"\$HOME/.local/bin:\$PATH\"" ;; esac

# --- 2. App Store Connect API key --------------------------------------------------------------------------
step "App Store Connect API key"
if asc_profile_ok "$ASC_PROFILE_NAME"; then
  ok "asc profile '$ASC_PROFILE_NAME' is signed in ('asc auth status')"
else
  if [[ -z "$KEY" ]]; then
    for k in "$HOME/keys/$ASC_KEY_NAME" "$HOME"/keys/AuthKey_*.p8; do
      [[ -f "$k" ]] && { KEY="$k"; break; }
    done
  fi
  # Apple names the download AuthKey_<KEY ID>.p8.
  if [[ -z "$KEY_ID" && -n "$KEY" ]]; then
    KEY_ID="$(basename "$KEY" | sed -nE 's/^AuthKey_([A-Z0-9]{10})\.p8$/\1/p')"
  fi
  if [[ -z "$KEY" || ! -s "$KEY" ]] || ! grep -q 'BEGIN PRIVATE KEY' "$KEY"; then
    miss "no API key (.p8). Make one as described in this script's header (--help), save it as
            ~/keys/$ASC_KEY_NAME, then run:
              $0 --key-id KEYID --issuer-id ISSUER_ID"
  elif [[ -z "$KEY_ID" || -z "$ISSUER_ID" ]]; then
    miss "the key's ids. Run again with --key-id and --issuer-id (App Store Connect -> Users and Access ->
            Integrations -> App Store Connect API: the Issuer ID is above the table, the Key ID in it)."
  else
    chmod 600 "$KEY"
    # asc may make a new profile the default. Note the current one and put it back afterwards, so another repo
    # that relies on the default keeps getting its own app.
    before="$(asc auth status --output json 2>/dev/null | python3 -I -c '
import json, sys
try: s = json.load(sys.stdin)
except ValueError: sys.exit()
print(next((c["name"] for c in s.get("credentials") or [] if c.get("isDefault")), ""))' || true)"
    login=(auth login --name "$ASC_PROFILE_NAME" --key-id "$KEY_ID" --issuer-id "$ISSUER_ID" --private-key "$KEY" --network)
    [[ "$BYPASS" == 1 ]] && login+=(--bypass-keychain)
    asc "${login[@]}"
    if [[ -n "$before" && "$before" != "$ASC_PROFILE_NAME" ]]; then
      asc auth switch --name "$before" >/dev/null && echo "   kept '$before' as the default profile"
    fi
    asc_profile_ok "$ASC_PROFILE_NAME" || die "signing in did not take; run 'asc auth doctor'."
    ok "profile '$ASC_PROFILE_NAME' signed in with $KEY"
    [[ "$BYPASS" == 1 ]] && echo "   add to your shell profile:  export MUSCLOG_ASC_BYPASS_KEYCHAIN=1"
  fi
fi

# --- 3. the app and its TestFlight group -------------------------------------------------------------------
step "The app in App Store Connect"
if [[ "$missing" == 1 ]]; then
  echo "   skipped until the sign-in above works"
else
  export ASC_PROFILE="$ASC_PROFILE_NAME" ASC_STRICT_AUTH=true
  app="$(asc_app_id)"
  bundle="$(app_bundle_id)"
  # The id in eas.json must be the app with this bundle id; a typo there would publish to the wrong app.
  found="$(asc apps list --bundle-id "$bundle" --output json 2>/dev/null | json_get '(d.get("data") or [{}])[0].get("id", "")' 2>/dev/null || true)"
  if [[ "$found" == "$app" ]]; then
    ok "app $app ($bundle)"
  elif [[ -n "$found" ]]; then
    miss "eas.json says ascAppId $app, but this team's app with bundle id $bundle is $found. Fix eas.json."
  else
    miss "no app with bundle id $bundle in this team (or the key belongs to another team). Check the key and eas.json's ascAppId."
  fi

  if [[ -n "$found" ]]; then
    [[ -n "$GROUP" ]] && python3 -I - "$APPSTORE_APP_JSON" "$GROUP" <<'PY'
import json, os, sys
path, group = sys.argv[1:]
os.makedirs(os.path.dirname(path), exist_ok=True)
d = json.load(open(path)) if os.path.exists(path) else {}
d["testflightGroup"] = group
open(path, "w").write(json.dumps(d, indent=2, sort_keys=True) + "\n")
PY
    groups="$(asc testflight groups list --app "$app" --paginate --output json 2>/dev/null \
      | json_get '"\n".join((x.get("attributes") or {}).get("name", "?") for x in d.get("data") or [])' 2>/dev/null || true)"
    GROUP="$(appstore_value testflightGroup)"
    if [[ -z "$GROUP" && "$(printf '%s' "$groups" | grep -c .)" == 1 ]]; then
      GROUP="$groups"
      python3 -I - "$APPSTORE_APP_JSON" "$GROUP" <<'PY'
import json, os, sys
path, group = sys.argv[1:]
os.makedirs(os.path.dirname(path), exist_ok=True)
d = json.load(open(path)) if os.path.exists(path) else {}
d["testflightGroup"] = group
open(path, "w").write(json.dumps(d, indent=2, sort_keys=True) + "\n")
PY
    fi
    if [[ -n "$GROUP" ]] && printf '%s\n' "$groups" | grep -qxF "$GROUP"; then
      ok "TestFlight group '$GROUP' (named in ios/appstore/app.json)"
    elif [[ -z "$groups" ]]; then
      miss "a TestFlight group. Create one in App Store Connect (TestFlight -> Internal Testing -> (+)), or:
              asc testflight groups create --app $app --name \"Internal Testers\" --internal --access-all-builds
            then run: $0 --group \"Internal Testers\""
    else
      miss "which TestFlight group new builds go to. Run again with --group NAME; there are:
$(printf '%s\n' "$groups" | sed 's/^/              /')"
    fi
  fi
fi

# --- 4. the rest of what a release needs --------------------------------------------------------------------
step "Release prerequisites"
root="$(repo_root)"
command -v jq >/dev/null 2>&1 && ok "jq" || miss "jq"
[[ -x "$root/node_modules/.bin/eas" ]] && ok "eas-cli" || miss "eas-cli (run npm ci)"
if (cd "$root" && npx --no-install eas whoami >/dev/null 2>&1); then ok "EAS login"; else miss "EAS login (run: npm run eas-login)"; fi
[[ -f "$root/.agents/skills/app-store-compliance/agent-os/hooks/app-store-compliance-guard.sh" ]] \
  && ok "app-store-compliance guard (vendored)" || miss "the vendored guard (.agents/skills/app-store-compliance)"
[[ -f "$root/ios/MusclogLiftLogRepeat/PrivacyInfo.xcprivacy" ]] && ok "privacy manifest" || miss "ios/MusclogLiftLogRepeat/PrivacyInfo.xcprivacy"
version_is_sane && build_number_is_sane && ok "version $(app_version) (build $(app_build_number))" \
  || miss "a sane expo.version (x.y.z) and expo.ios.buildNumber in app.json"
if [[ -d "$APPSTORE_META" ]]; then ok "listing files in ios/appstore/metadata"; else
  echo "   NOTE: no ios/appstore/metadata yet. Run scripts/appstore.sh pull (or from-listing)." >&2
fi

echo
if [[ "$missing" == 0 ]]; then
  note "ready. Next: scripts/appstore.sh pull   and   scripts/release-ios.sh check --online"
else
  die "setup is incomplete; fix the MISSING items above and rerun."
fi
