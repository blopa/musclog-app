#!/usr/bin/env bash
# Build, check and publish the Android app bundle with EAS + gplay.
#
#   scripts/release-android.sh build [--local]
#   scripts/release-android.sh check [--file AAB]
#   scripts/release-android.sh upload [--track internal|alpha|beta|production] [--rollout F]
#                                     [--notes FILE] [--file AAB] [--skip-build] [--dry-run]
#   scripts/release-android.sh promote FROM TO [--rollout F]
#   scripts/release-android.sh rollout update F | halt | resume | complete [--track T]
#   scripts/release-android.sh status
#
# Design (docs/GOOGLE_PLAY.md):
# - Builds go through EAS with the `production` profile. android/app/build.gradle signs the
#   release type with the DEBUG key, so a plain gradle bundleRelease is never upload-ready; EAS
#   injects the managed upload key. Every bundle is checked and a debug-signed one is refused.
# - Uploads go through `gplay release`, not `eas submit`: eas.json has no Android submit config,
#   `appVersionSource` is `local` (so EAS autoIncrement would not apply anyway), and gplay gives
#   preflight, staged rollouts and promotion in one tool.
# - This script never bumps the version (use `npm run bump-app-version`). It refuses to upload
#   unless versionCode is higher than every code already on Play, because Play spends a code even
#   on a rejected upload.
set -euo pipefail
# shellcheck source=lib/gplay-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/gplay-common.sh"

ROOT="$(repo_root)"
OUT_DIR="$ROOT/.release"
TRACKS="internal alpha beta production"

usage() { sed -n '2,12p' "$0"; exit "${1:-0}"; }
valid_track() { [[ " $TRACKS " == *" $1 "* ]]; }
valid_fraction() { python3 -I -c 'import sys; f=float(sys.argv[1]); sys.exit(0 if 0 < f <= 1 else 1)' "$1" 2>/dev/null; }

default_aab() { echo "$OUT_DIR/musclog-$(local_version_name)-$(local_version_code).aab"; }

# Refuse a bundle signed with the Android debug key (or not signed at all).
assert_release_signed() {
  local aab="$1" cert
  [[ -s "$aab" ]] || die "$aab does not exist."
  cert="$(keytool -printcert -jarfile "$aab" 2>&1)" || die "could not read the signature of $aab: $cert"
  grep -q '^Owner:' <<<"$cert" || die "$aab has no signing certificate."
  if grep -qiE '^Owner:.*(CN=Android Debug|O=Android)' <<<"$cert"; then
    die "$aab is signed with the Android DEBUG key. Build it through EAS (this script's 'build')."
  fi
  note "signed by: $(grep -m1 '^Owner:' <<<"$cert")"
}

cmd_build() {
  local local_build=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --local) local_build=1; shift ;;
      *) die "build: unknown option $1" ;;
    esac
  done
  mkdir -p "$OUT_DIR"
  local out
  out="$(default_aab)"
  cd "$ROOT"
  npm run --silent check-version-sync || die "versions are out of sync; fix them (the script never bumps)."
  note "building versionCode $(local_version_code) / $(local_version_name) with EAS profile 'production'"
  if [[ "$local_build" -eq 1 ]]; then
    bash scripts/run-eas-local-android-build.sh production --non-interactive --output "$out"
  else
    local json url
    json="$(npx --no-install eas build --platform android --profile production --non-interactive --wait --json)"
    url="$(jq -r '[.[]? | .artifacts.buildUrl // empty][0] // empty' <<<"$json")"
    [[ -n "$url" ]] || die "EAS returned no artifact url: $json"
    curl -fsSL -o "$out" "$url"
  fi
  assert_release_signed "$out"
  note "built $out"
}

cmd_check() {
  local aab=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --file) aab="${2:?--file needs a path}"; shift 2 ;;
      *) die "check: unknown option $1" ;;
    esac
  done
  aab="${aab:-$(default_aab)}"
  require_gplay
  assert_release_signed "$aab"
  gplay preflight --file "$aab" --fail-on warning --pretty
}

# Aborts unless the local versionCode beats every code on Play.
assert_version_code_is_new() {
  local mine highest
  mine="$(local_version_code)"
  [[ "$mine" =~ ^[0-9]+$ ]] || die "could not read versionCode from android/app/build.gradle."
  open_edit
  highest="$(highest_play_version_code)"
  gplay edits delete --package "$PACKAGE" --edit "$EDIT_ID" --confirm >/dev/null
  EDIT_ID=""
  [[ "$mine" -gt "$highest" ]] \
    || die "versionCode $mine is not above the highest on Play ($highest). Bump first: npm run bump-app-version"
  note "versionCode $mine > Play's $highest"
}

cmd_upload() {
  local track="internal" rollout="" notes="" aab="" skip_build=0 dry=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --track) track="${2:?}"; shift 2 ;;
      --rollout) rollout="${2:?}"; shift 2 ;;
      --notes) notes="${2:?}"; shift 2 ;;
      --file) aab="${2:?}"; shift 2 ;;
      --skip-build) skip_build=1; shift ;;
      --dry-run) dry=1; shift ;;
      *) die "upload: unknown option $1" ;;
    esac
  done
  valid_track "$track" || die "unknown track '$track' (use: $TRACKS)."
  if [[ "$track" == "production" && -z "$rollout" ]]; then
    die "production needs an explicit --rollout F (0 < F <= 1; 1 = everyone). Start with 0.1."
  fi
  rollout="${rollout:-1}"
  valid_fraction "$rollout" || die "--rollout must be a number above 0 and at most 1."
  [[ -z "$notes" || -s "$notes" ]] || die "--notes file '$notes' is missing or empty."

  require_gplay
  use_profile
  aab="${aab:-$(default_aab)}"
  if [[ "$skip_build" -eq 0 && "$dry" -eq 0 ]]; then
    cmd_build
  fi
  [[ -s "$aab" ]] || die "no bundle at $aab (run 'build' or pass --file)."
  assert_release_signed "$aab"
  gplay preflight --file "$aab" --fail-on warning >/dev/null || { gplay preflight --file "$aab" --fail-on warning --pretty >&2 || true; die "preflight found problems."; }
  assert_version_code_is_new

  local args=(release --package "$PACKAGE" --track "$track" --bundle "$aab" --rollout "$rollout" --wait)
  [[ -n "$notes" ]] && args+=(--release-notes "@$notes")
  if [[ "$dry" -eq 1 ]]; then
    note "dry run, would execute: gplay ${args[*]}"
    return 0
  fi
  gplay "${args[@]}" --pretty
}

cmd_promote() {
  local from="${1:-}" to="${2:-}" rollout=""
  [[ -n "$from" && -n "$to" ]] || usage 1
  shift 2
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --rollout) rollout="${2:?}"; shift 2 ;;
      *) die "promote: unknown option $1" ;;
    esac
  done
  valid_track "$from" && valid_track "$to" || die "tracks are: $TRACKS."
  [[ "$from" != "$to" ]] || die "FROM and TO are the same track."
  if [[ "$to" == "production" && -z "$rollout" ]]; then
    die "promoting to production needs an explicit --rollout F."
  fi
  rollout="${rollout:-1}"
  valid_fraction "$rollout" || die "--rollout must be above 0 and at most 1."
  require_gplay; use_profile
  gplay promote --package "$PACKAGE" --from "$from" --to "$to" --rollout "$rollout" --pretty
}

cmd_rollout() {
  local action="${1:-}"; shift || true
  local track="production" fraction=""
  if [[ "$action" == "update" ]]; then fraction="${1:?rollout update needs a fraction}"; shift; fi
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --track) track="${2:?}"; shift 2 ;;
      *) die "rollout: unknown option $1" ;;
    esac
  done
  valid_track "$track" || die "unknown track '$track'."
  require_gplay; use_profile
  case "$action" in
    update)
      valid_fraction "$fraction" || die "fraction must be above 0 and at most 1."
      gplay rollout update --package "$PACKAGE" --track "$track" --rollout "$fraction" --pretty ;;
    halt|resume|complete)
      gplay rollout "$action" --package "$PACKAGE" --track "$track" --pretty ;;
    *) usage 1 ;;
  esac
}

cmd_status() {
  require_gplay; use_profile
  gplay status --package "$PACKAGE" --pretty
}

sub="${1:-}"; shift || true
case "$sub" in
  build) cmd_build "$@" ;;
  check) cmd_check "$@" ;;
  upload) cmd_upload "$@" ;;
  promote) cmd_promote "$@" ;;
  rollout) cmd_rollout "$@" ;;
  status) cmd_status "$@" ;;
  -h|--help|"") usage 0 ;;
  *) usage 1 ;;
esac
