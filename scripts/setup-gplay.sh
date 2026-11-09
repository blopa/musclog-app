#!/usr/bin/env bash
# One-command setup of Google Play publishing on a fresh machine. Idempotent.
#
#   scripts/setup-gplay.sh [--key PATH] [--project GCP_PROJECT_ID]
#
# Installs gplay (tamtom/play-console-cli), signs in with a service-account key
# (default ~/keys/musclog-play-service-account.json), then checks everything the
# release script needs and prints what is missing. See docs/GOOGLE_PLAY.md.
set -euo pipefail
# shellcheck source=lib/gplay-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/gplay-common.sh"

KEY="$HOME/keys/$APP_KEY_NAME"
GCP_PROJECT=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --key) KEY="${2:?--key needs a path}"; shift 2 ;;
    --project) GCP_PROJECT="${2:?--project needs a GCP project id}"; shift 2 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) die "unknown option: $1" ;;
  esac
done

missing=0
miss() { echo "  MISSING: $*" >&2; missing=1; }

# --- 1. gplay ----------------------------------------------------------------
install_gplay() {
  if command -v brew >/dev/null 2>&1; then
    note "installing gplay with Homebrew"
    brew install tamtom/tap/gplay
    return
  fi
  need curl "Install curl first."
  local tmp
  tmp="$(mktemp -d)"
  # install.sh verifies the release SHA-256 and installs to ~/.local/bin.
  note "downloading the gplay installer to $tmp (not piped to a shell)"
  curl -fsSL -o "$tmp/install.sh" https://raw.githubusercontent.com/tamtom/play-console-cli/main/install.sh
  note "running $tmp/install.sh"
  bash "$tmp/install.sh"
  rm -rf "$tmp"
}

if ! command -v gplay >/dev/null 2>&1; then
  install_gplay
  PATH="$HOME/.local/bin:$PATH"
fi
if ! gplay preflight --help >/dev/null 2>&1; then
  die "'gplay' on PATH ($(command -v gplay)) has no 'preflight' command, so it is not tamtom/play-console-cli (an unrelated PollyGlot gplay exists). Remove it or put ~/.local/bin first on PATH, then rerun."
fi
note "gplay: $(gplay --version | head -1)"

# --- 2. sign in --------------------------------------------------------------
if auth_ok "$GPLAY_PROFILE_NAME"; then
  note "gplay profile '$GPLAY_PROFILE_NAME' already has a valid key"
elif key_file_ok "$KEY"; then
  note "signing in profile '$GPLAY_PROFILE_NAME' with $KEY"
  # --set-default=false: another app's profile may be the default on this machine.
  gplay auth login --service-account "$KEY" --profile "$GPLAY_PROFILE_NAME" --set-default=false >/dev/null
  auth_ok "$GPLAY_PROFILE_NAME" || die "login ran but profile '$GPLAY_PROFILE_NAME' is still not valid."
else
  [[ -e "$KEY" ]] && echo "  $KEY exists but is empty or not a service-account key (a failed key creation leaves an empty file); ignoring it." >&2
  if [[ -z "$GCP_PROJECT" ]]; then
    cat >&2 <<EOF

No service-account key at $KEY.

Either put one there (or pass --key PATH), or create a new one:
  scripts/setup-gplay.sh --project <dedicated-gcp-project-id>
(use a dedicated project, not an unrelated one; create it with
 'gcloud projects create <id>' first). Details and the Workspace key-policy
workaround are in docs/GOOGLE_PLAY.md.
EOF
    miss "service-account key"
  else
    need gcloud "gplay setup --auto can install it; rerun without --no-install."
    note "creating a service account in $GCP_PROJECT"
    mkdir -p "$(dirname "$KEY")"
    gplay setup --auto --project "$GCP_PROJECT" --profile "$GPLAY_PROFILE_NAME" --set-default=false --key-out "$KEY" \
      || miss "service-account key (gplay setup --auto failed; see docs/GOOGLE_PLAY.md → Troubleshooting)"
    [[ -s "$KEY" ]] || rm -f "$KEY"
  fi
fi

if auth_ok "$GPLAY_PROFILE_NAME"; then
  export GPLAY_PROFILE="$GPLAY_PROFILE_NAME"
  if gplay status --package "$PACKAGE" 2>/dev/null | jq -e '.. | objects | select(.name? == "tracks" or .source? == "tracks") | select(.status? == "ok" or .ok? == true)' >/dev/null 2>&1; then
    note "Play access for $PACKAGE: ok"
  else
    echo "  NOTE: could not confirm Play access to $PACKAGE. If 'gplay status' shows tracks failing with 403," >&2
    echo "        invite the service account's client_email in Play Console → Users and permissions" >&2
    echo "        with access to this app, the release permissions and Manage store presence." >&2
  fi
fi

# --- 3. the rest of the toolchain --------------------------------------------
note "checking the build toolchain"
command -v node >/dev/null 2>&1 || miss "node"
if [[ -f "$(repo_root)/.nvmrc" ]]; then
  want="$(tr -d '[:space:]v' < "$(repo_root)/.nvmrc")"
  have="$(node -v 2>/dev/null | sed -nE 's/^v([0-9]+).*/\1/p')"
  [[ "$have" == "$want" ]] || echo "  NOTE: .nvmrc wants Node $want, active is ${have:-none}; the EAS build helper switches through nvm." >&2
fi
command -v jq >/dev/null 2>&1 || miss "jq"
command -v python3 >/dev/null 2>&1 || miss "python3"
command -v keytool >/dev/null 2>&1 || miss "keytool (part of a JDK; needed to refuse a debug-signed bundle)"
command -v unzip >/dev/null 2>&1 || miss "unzip"
[[ -x "$(repo_root)/node_modules/.bin/eas" ]] || miss "eas-cli (run npm ci)"

jdk_ok=0
for j in "${JAVA_HOME:-}" "$HOME"/.jdks/jdk-17* "$HOME"/.jdks/jdk-21* /usr/lib/jvm/java-17-* /usr/lib/jvm/java-21-* ; do
  [[ -n "$j" && -x "$j/bin/java" ]] && jdk_ok=1 && break
done
if [[ "$jdk_ok" -eq 0 ]] && command -v java >/dev/null 2>&1; then
  v="$(java -version 2>&1 | sed -nE '1s/.*version "([0-9]+).*/\1/p')"
  [[ "$v" =~ ^[0-9]+$ && "$v" -ge 17 && "$v" -le 26 ]] && jdk_ok=1
fi
[[ "$jdk_ok" -eq 1 ]] || miss "JDK 17-26 (needed for local EAS builds only; cloud builds need none)"

sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
[[ -d "$sdk/platforms" ]] || echo "  NOTE: no Android SDK at $sdk (needed for local EAS builds only; set ANDROID_HOME)." >&2

# Release signing: build.gradle's release type uses the debug keystore, so a
# plain `gradlew bundleRelease` is NOT upload-ready. Signing is EAS-managed.
if grep -q 'signingConfig signingConfigs.debug' "$(repo_root)/android/app/build.gradle"; then
  note "release signing: EAS-managed (build.gradle release uses the debug key, so only EAS builds are signed for upload)"
fi
if ! (cd "$(repo_root)" && npx --no-install eas whoami >/dev/null 2>&1); then
  miss "EAS login (run: npm run eas-login)"
fi

if [[ "$missing" -eq 0 ]]; then
  note "ready"
else
  die "setup is incomplete; fix the MISSING items above and rerun."
fi
