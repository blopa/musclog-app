#!/usr/bin/env bash
# Build, check and publish the iOS app with EAS + asc. The App Store's counterpart of release-android.sh.
#
#   scripts/release-ios.sh check [--online] [--all-platforms]
#   scripts/release-ios.sh build [--ipa-out FILE]
#   scripts/release-ios.sh testflight [--group NAME[,NAME...]] [--beta-review] [--ipa FILE] [--skip-build] [--eas-submit] [--dry-run]
#   scripts/release-ios.sh submit (--latest | --build-id ID) [--version X.Y.Z] [--yes] [--dry-run]
#   scripts/release-ios.sh status
#   scripts/release-ios.sh review
#
# Design (docs/APP_STORE.md):
# - Builds run on EAS (cloud, profile `production`, a store-signed .ipa) from this checkout, so this machine
#   never needs Xcode. EAS builds iOS locally only on a Mac, so there is no --local. Like release-android.sh,
#   nothing here bumps the version: use `npm run bump-app-version`.
# - `check` runs offline unless --online: version and build number sane, versions in sync across app.json and
#   the native projects, the compliance gate (appstore-guard.sh) and a signed-in asc profile. --online also asks
#   App Store Connect to validate the key and whether the build number is above the ones already uploaded.
# - `testflight` uploads the .ipa with `asc builds upload` (not `eas submit`, which asks for an Apple login
#   unless EAS holds an API key; --eas-submit uses it anyway), waits for Apple to process it, then adds the
#   build to the TestFlight group(s) (comma-separated; internal groups need no review). External groups need
#   Beta App Review: add --beta-review to submit the build for it (asks Apple's reviewers, so opt-in).
# - `submit` stages the version (creates it if needed, applies ios/appstore/metadata, attaches the build),
#   runs `asc validate`, which must pass, then creates the review submission and sends it. It asks first.
#   After approval the release follows the version's release setting in App Store Connect.
# Store text is not released here: see scripts/appstore.sh.
set -euo pipefail
# shellcheck source=lib/asc-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/asc-common.sh"

ROOT="$(repo_root)"
OUT_DIR="$ROOT/.release"

usage() { sed -n '2,11p' "$0"; exit "${1:-0}"; }
default_ipa() { echo "$OUT_DIR/musclog-$(app_version)-$(app_build_number).ipa"; }

# --- check -------------------------------------------------------------------------------------------------
cmd_check() {
  local online=0 gate_args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --online) online=1; shift ;;
      --all-platforms) gate_args+=(--all-platforms); shift ;;
      *) die "check: unknown option $1" ;;
    esac
  done
  need python3 "Install python3."
  version_is_sane || die "expo.version in app.json is '$(app_version)'; it must be x.y.z."
  build_number_is_sane || die "expo.ios.buildNumber in app.json is '$(app_build_number)'; it must be a whole number above 0."
  note "version $(app_version), build $(app_build_number), bundle $(app_bundle_id), App Store Connect app $(asc_app_id)"
  (cd "$ROOT" && npm run --silent check-version-sync) \
    || die "versions are out of sync (app.json, Android, iOS); fix them (the script never bumps)."
  note "compliance gate"
  "$ROOT/scripts/appstore-guard.sh" ${gate_args[@]+"${gate_args[@]}"} || die "the compliance gate failed (above)."
  use_asc_profile
  note "asc profile '$ASC_PROFILE' is signed in"
  if [[ "$online" -eq 1 ]]; then
    asc auth status --validate --output table || die "App Store Connect rejected the stored key (asc auth doctor)."
    assert_build_number_is_new
  fi
  note "check ok"
}

# Aborts unless the local build number beats every build already uploaded for this version.
assert_build_number_is_new() {
  local mine highest
  mine="$(app_build_number)"
  highest="$(asc builds list --app "$(asc_app_id)" --version "$(app_version)" --platform IOS --paginate --output json \
    | json_get 'max([int((x.get("attributes") or {}).get("version") or 0) for x in d.get("data") or []] or [0])')" \
    || die "could not read the builds on App Store Connect."
  [[ "$mine" -gt "$highest" ]] \
    || die "build number $mine is not above the highest uploaded for $(app_version) ($highest). Bump first: npm run bump-app-version"
  note "build number $mine > App Store Connect's $highest"
}

# --- build -------------------------------------------------------------------------------------------------
# Builds on EAS and downloads the .ipa. The callers have already run the checks.
do_build() {
  local out="$1"
  mkdir -p "$OUT_DIR"
  need jq "Install jq."
  need unzip "Install unzip."
  cd "$ROOT"
  # Deliberately NOT scripts/prepare-for-eas.js (what `npm run build-ios` runs): it is stale. It strips the whole
  # PBXTargetDependency section, which now holds the real ExpoWidgetsTarget dependency, and EAS's project parser
  # then fails with "Cannot read properties of undefined". The committed project.pbxproj is what EAS builds.
  note "building $(app_version) ($(app_build_number)) with EAS profile 'production'"
  local json url
  json="$(npx --no-install eas build --platform ios --profile production --non-interactive --wait --json)"
  url="$(jq -r '[.[]? | .artifacts.buildUrl // empty][0] // empty' <<<"$json")"
  [[ -n "$url" ]] || die "EAS returned no artifact url: $json"
  curl -fsSL -o "$out" "$url"
  [[ -s "$out" ]] && unzip -tq "$out" >/dev/null 2>&1 || die "$out is not a valid .ipa."
  EAS_BUILD_ID="$(jq -r '[.[]? | .id // empty][0] // empty' <<<"$json")"
  note "built $out"
}

cmd_build() {
  local out=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --ipa-out) out="${2:?--ipa-out needs a path}"; shift 2 ;;
      --local) die "EAS builds iOS locally only on a Mac. Run this on EAS's servers (no --local)." ;;
      *) die "build: unknown option $1" ;;
    esac
  done
  cmd_check
  do_build "${out:-$(default_ipa)}"
}

# --- testflight --------------------------------------------------------------------------------------------
cmd_testflight() {
  local group="" ipa="" skip_build=0 eas_submit=0 dry=0 beta_review=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --group) group="${2:?--group needs a name}"; shift 2 ;;
      --ipa) ipa="${2:?--ipa needs a path}"; shift 2 ;;
      --beta-review) beta_review=1; shift ;;
      --skip-build) skip_build=1; shift ;;
      --eas-submit) eas_submit=1; shift ;;
      --dry-run) dry=1; shift ;;
      *) die "testflight: unknown option $1" ;;
    esac
  done
  group="${group:-$(appstore_value testflightGroup)}"
  [[ -n "$group" ]] || die "no TestFlight group: pass --group NAME, or run scripts/setup-asc.sh."
  ipa="${ipa:-$(default_ipa)}"
  local app
  app="$(asc_app_id)"

  if [[ "$dry" -eq 1 ]]; then
    cmd_check
    note "dry run, nothing was built, uploaded or changed. It would:"
    [[ "$skip_build" -eq 1 ]] || echo "  eas build --platform ios --profile production --non-interactive --wait --json   (-> $ipa)"
    if [[ "$eas_submit" -eq 1 ]]; then
      echo "  eas submit --platform ios --profile production --id <build id> --non-interactive"
    else
      echo "  asc builds upload --app $app --ipa $ipa --version $(app_version) --build-number $(app_build_number) --wait"
    fi
    echo "  asc builds wait --app $app --build-number $(app_build_number) --platform IOS --version $(app_version)"
    echo "  asc builds add-groups --build-id <that build> --group \"$group\"$([[ "$beta_review" -eq 1 ]] && echo ' --submit --confirm')"
    return 0
  fi

  # Everything that can fail cheaply fails before the build, the build number included.
  cmd_check --online
  if [[ "$skip_build" -eq 0 ]]; then
    do_build "$ipa"
  else
    [[ -s "$ipa" ]] || die "no .ipa at $ipa (run 'build' or pass --ipa)."
  fi

  if [[ "$eas_submit" -eq 1 ]]; then
    [[ -n "${EAS_BUILD_ID:-}" ]] || die "--eas-submit needs a build made by this run (not --skip-build)."
    (cd "$ROOT" && npx --no-install eas submit --platform ios --profile production --id "$EAS_BUILD_ID" --non-interactive)
  else
    asc builds upload --app "$app" --ipa "$ipa" --version "$(app_version)" --build-number "$(app_build_number)" --wait --output table
  fi

  asc builds wait --app "$app" --build-number "$(app_build_number)" --platform IOS --version "$(app_version)" --fail-on-invalid --output table
  local id
  id="$(asc builds info --app "$app" --build-number "$(app_build_number)" --platform IOS --version "$(app_version)" --output json \
    | json_get '(d.get("data") or d).get("id", "")')"
  [[ -n "$id" ]] || die "Apple did not report the processed build; see: scripts/release-ios.sh status"
  note "build $id is processed; giving it to TestFlight group '$group'"
  local add=(builds add-groups --build-id "$id" --group "$group")
  [[ "$beta_review" -eq 1 ]] && add+=(--submit --confirm)
  asc "${add[@]}" --output table
}

# --- submit ------------------------------------------------------------------------------------------------
cmd_submit() {
  local id="" latest=0 version="" yes=0 dry=0 app
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --build-id) id="${2:?--build-id needs a value}"; shift 2 ;;
      --latest) latest=1; shift ;;
      --version) version="${2:?--version needs a value}"; shift 2 ;;
      --yes) yes=1; shift ;;
      --dry-run) dry=1; shift ;;
      *) die "submit: unknown option $1" ;;
    esac
  done
  cmd_check
  app="$(asc_app_id)"
  version="${version:-$(app_version)}"
  if [[ -z "$id" ]]; then
    [[ "$latest" -eq 1 ]] || die "say which build: --build-id ID (from 'testflight' or 'status'), or --latest."
    id="$(asc builds info --app "$app" --latest --version "$version" --platform IOS --processing-state VALID --output json \
      | json_get '(d.get("data") or d).get("id", "")')"
    [[ -n "$id" ]] || die "no processed build of version $version in App Store Connect."
  fi

  local stage=(release stage --app "$app" --version "$version" --build-id "$id" --platform IOS)
  # The listing in the repo goes with the version, once it has been pulled (appstore.sh pull).
  [[ -d "$APPSTORE_META/app-info" || -d "$APPSTORE_META/version" ]] && stage+=(--metadata-dir "$APPSTORE_META")
  echo "== Staging $version with build $id (dry run first)"
  asc "${stage[@]}" --dry-run --output table
  if [[ "$dry" -eq 1 ]]; then
    asc validate --app "$app" --version "$version" --output table || true
    echo "Dry run: nothing was changed or submitted."
    return 0
  fi
  if [[ "$yes" -eq 0 ]]; then
    read -r -p "Stage version $version with build $id and send it to App Review? [y/N] " answer
    [[ "$answer" == y || "$answer" == Y ]] || { echo "Cancelled; nothing changed."; return 0; }
  fi
  asc "${stage[@]}" --confirm --output table
  asc validate --app "$app" --version "$version" --output table \
    || die "App Store Connect says version $version is not ready (above). It is staged, not submitted: fix it and run submit again."

  local vid sub
  vid="$(asc versions view --app "$app" --version "$version" --platform IOS --output json | json_get '(d.get("data") or d)["id"]')"
  sub="$(asc review submissions-create --app "$app" --platform IOS --output json | json_get '(d.get("data") or d)["id"]')"
  asc review items-add --submission "$sub" --item-type appStoreVersions --item-id "$vid" --if-exists skip --output table
  asc review submissions-submit --id "$sub" --confirm --output table
  echo "Submitted $version (build $id) for review. Follow it with: scripts/release-ios.sh review"
}

sub="${1:-}"; shift || true
case "$sub" in
  check) cmd_check "$@" ;;
  build) cmd_build "$@" ;;
  testflight) cmd_testflight "$@" ;;
  submit) cmd_submit "$@" ;;
  status) use_asc_profile; asc status --app "$(asc_app_id)" --output table ;;
  review) use_asc_profile; asc review status --app "$(asc_app_id)" --output table ;;
  -h|--help|"") usage 0 ;;
  *) usage 1 ;;
esac
