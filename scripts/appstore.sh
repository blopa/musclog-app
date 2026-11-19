#!/usr/bin/env bash
# The App Store listing as files, Terraform-style. The counterpart of play.sh, with `asc metadata`
# (https://github.com/rorkai/App-Store-Connect-CLI).
#
#   scripts/appstore.sh pull [--version X.Y.Z] [--with-settings]   App Store Connect -> repo (mirrors it: ios/appstore/metadata is replaced)
#   scripts/appstore.sh plan [--with-settings]   repo vs App Store Connect, changes nothing
#   scripts/appstore.sh up [--yes] [--with-settings]   show the plan, confirm, apply (--if-exists update)
#   scripts/appstore.sh new-version [--version X.Y.Z]   create the App Store version the listing and screenshots attach to (if missing)
#   scripts/appstore.sh validate                 offline lint (limits, other platforms) + `asc metadata validate --check-urls`
#   scripts/appstore.sh audit                    the text against App Review's metadata rules (vendored metadata-audit.py), offline
#   scripts/appstore.sh from-listing             Play listing -> ios/appstore/metadata (appstore-listing-metadata.py)
#   scripts/appstore.sh screenshots list|from-captures|validate|plan|up   the screenshots, see below
#
# Desired state: ios/appstore/metadata/app-info/<locale>.json (name, subtitle, privacyPolicyUrl) and
# ios/appstore/metadata/version/<X.Y.Z>/<locale>.json (description, keywords, promotionalText, supportUrl,
# marketingUrl, whatsNew). A field left out of a file is not touched on App Store Connect, and nothing is
# deleted (no --allow-deletes). Never run `up` without the owner's go-ahead. See docs/APP_STORE.md.
#
# --with-settings adds asc's opt-in scopes: categories.json, age-rating.json and review-information.json (the App
# Review contact; it is gitignored, a phone number does not belong in a public repo, and a demo password is only
# ever an @env: reference).
# Screenshots: ios/appstore/screenshots/<apple locale>/{iphone,ipad}/NN-name.png, at most 10 per set, sorted by
# file name; iphone is the IPHONE_65 slot (1242x2688 or 1284x2778), ipad the IPAD_PRO_3GEN_129 slot (2048x2732
# or 2064x2752). `screenshots up` REPLACES the set on App Store Connect with the local folder.
# NOT managed here: the App Privacy answers, pricing and availability, the export compliance answers and the
# release setting. Builds are not handled here (EAS builds and submits them; release-ios.sh is optional). Text
# edits to a live version reach the store with the next submitted version, except the promotional text, which App
# Store Connect publishes at once.
set -euo pipefail
# shellcheck source=lib/asc-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/asc-common.sh"

ROOT="$(repo_root)"
META="$APPSTORE_META"
AUDIT="$ROOT/.agents/skills/app-store-compliance/scripts/metadata-audit.py"
SHOTS="${MUSCLOG_APPSTORE_SHOTS:-$APPSTORE_DIR/screenshots}"   # the env var is for tests
WORK=""
WITH_SETTINGS=0
SCOPES_BASE="localizations"
SCOPES_ALL="localizations,categories,age-rating,review-information"
cleanup() { [[ -n "$WORK" ]] && rm -rf "$WORK"; return 0; }
trap cleanup EXIT

# The one version folder in $META/version (asc names it after the version string), or stop.
meta_version() {
  local dirs
  dirs="$(find "$META/version" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)"
  [[ -n "$dirs" ]] || die "no version folder in $META/version. Run 'scripts/appstore.sh pull' (or from-listing) first."
  [[ "$(printf '%s\n' "$dirs" | wc -l)" == 1 ]] || die "more than one version folder in $META/version; keep only the one you edit:
$dirs"
  local folder
  folder="$(basename "$dirs")"
  # The listing and the screenshots attach to the version `new-version` creates, which is app.json's. A folder
  # left over from an older pull (the listing once sat in 2.6.2 while the app was 2.16.x) would be pushed into
  # that old version.
  [[ "$folder" == "$(app_version)" ]] || die "the version folder is $META/version/$folder but app.json's version is $(app_version).
Rename it:  mv '$META/version/$folder' '$META/version/$(app_version)'   (or run 'scripts/appstore.sh pull' for that version)."
  printf '%s\n' "$folder"
}

# The scopes asc reads and writes: the listing text, or with --with-settings the category, age rating and review contact too.
scopes() { if [[ "$WITH_SETTINGS" -eq 1 ]]; then echo "$SCOPES_ALL"; else echo "$SCOPES_BASE"; fi; }

cmd_pull() {
  local version=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --version) version=(--version "${2:?--version needs a value}"); shift 2 ;;
      --with-settings) WITH_SETTINGS=1; shift ;;
      *) die "pull: unknown option $1" ;;
    esac
  done
  use_asc_profile
  WORK="$(mktemp -d)"
  note "pulling the App Store listing"
  # Into a temp folder first: a failed pull must not leave the repo without its files.
  asc metadata pull --app "$(asc_app_id)" ${version[@]+"${version[@]}"} --platform IOS --dir "$WORK/metadata" --include "$(scopes)" --output table
  [[ -d "$WORK/metadata" ]] || die "asc pulled nothing."
  rm -rf "$META"
  mkdir -p "$APPSTORE_DIR"
  mv "$WORK/metadata" "$META"
  note "pulled into $META. Review with: git status --short ios/appstore"
}

cmd_plan() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --with-settings) WITH_SETTINGS=1; shift ;;
      *) die "plan: unknown option $1" ;;
    esac
  done
  # The version folder is checked offline, before the sign-in: a wrong folder is the same mistake whether or not
  # the profile is signed in, and the check must not depend on the machine's credentials.
  local v
  v="$(meta_version)"
  use_asc_profile
  echo "== Listing for version $v (dry run, nothing is changed)"
  asc metadata push --app "$(asc_app_id)" --version "$v" --platform IOS --dir "$META" --include "$(scopes)" --dry-run --output table
}

cmd_up() {
  local yes=0 plan_args=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes) yes=1; shift ;;
      --with-settings) WITH_SETTINGS=1; plan_args+=(--with-settings); shift ;;
      *) die "up: unknown option $1" ;;
    esac
  done
  cmd_lint
  cmd_plan ${plan_args[@]+"${plan_args[@]}"}
  echo
  if [[ "$yes" -eq 0 ]]; then
    read -r -p "Apply this to App Store Connect for $(app_bundle_id)? [y/N] " answer
    [[ "$answer" == y || "$answer" == Y ]] || { echo "Cancelled; nothing changed."; return 0; }
  fi
  asc metadata push --app "$(asc_app_id)" --version "$(meta_version)" --platform IOS --dir "$META" --include "$(scopes)" --if-exists update --output table
  note "applied. App Store Connect now matches $META."
}

# Limits and other-platform names, offline, over the files as they are.
cmd_lint() {
  [[ -d "$META" ]] || die "no $META yet. Run 'scripts/appstore.sh pull' or 'from-listing' first."
  meta_version >/dev/null
  python3 -I - "$META" <<'PY' || die "listing text problems above."
import json, re, sys
from pathlib import Path
limits = {"name": 30, "subtitle": 30, "keywords": 100, "promotionalText": 170, "description": 4000}
other = re.compile(r"\b(Android|Google Play|Play Store|Play Console|Wear OS|Huawei|AppGallery)\b", re.I)
bad = 0
root = Path(sys.argv[1])
# Only the listing files; categories.json, age-rating.json and review-information.json are settings.
for f in sorted([*root.glob("app-info/*.json"), *root.glob("version/*/*.json")]):
    for k, v in json.loads(f.read_text(encoding="utf-8")).items():
        if not isinstance(v, str):
            continue
        rel = f.relative_to(sys.argv[1])
        if k in limits and len(v) > limits[k]:
            print(f"{rel}: {k} is {len(v)} characters, limit {limits[k]}", file=sys.stderr); bad = 1
        m = other.search(v)
        if m and k not in ("whatsNew",):
            print(f"{rel}: {k} names '{m.group(0)}' (App Review 2.3.10)", file=sys.stderr); bad = 1
sys.exit(bad)
PY
}

cmd_validate() {
  cmd_lint
  require_asc
  asc metadata validate --dir "$META" --check-urls --output table
}

cmd_audit() {
  [[ -d "$META" ]] || die "no $META yet. Run 'scripts/appstore.sh pull' or 'from-listing' first."
  [[ -f "$AUDIT" ]] || die "the vendored metadata-audit.py is missing ($AUDIT)."
  # metadata-audit.py audits one folder per language with fastlane's field names; asc keeps one file per
  # language in two folders. Lay a copy out its way, in a temporary folder.
  WORK="$(mktemp -d)"
  python3 -I - "$META" "$WORK" <<'PY'
import json, sys
from pathlib import Path
meta, out = Path(sys.argv[1]), Path(sys.argv[2])
names = {"name": "name", "subtitle": "subtitle", "privacyPolicyUrl": "privacy_url", "description": "description",
         "keywords": "keywords", "promotionalText": "promotional_text", "supportUrl": "support_url",
         "marketingUrl": "marketing_url", "whatsNew": "release_notes"}
for f in sorted([*meta.glob("app-info/*.json"), *meta.glob("version/*/*.json")]):
    if f.stem == "default":
        continue
    d = out / f.stem
    d.mkdir(exist_ok=True)
    for k, v in json.loads(f.read_text(encoding="utf-8")).items():
        if k in names and isinstance(v, str):
            (d / f"{names[k]}.txt").write_text(v, encoding="utf-8")
PY
  python3 -I "$AUDIT" "$WORK"
}

cmd_from_listing() {
  python3 -I "$(dirname "${BASH_SOURCE[0]}")/appstore-listing-metadata.py" "$META"
  echo "Now: scripts/appstore.sh validate   then   scripts/appstore.sh plan"
}

# The App Store version the listing and the screenshots attach to. `asc metadata push` and `screenshots upload`
# need it to exist; the binary EAS uploads does not create it.
cmd_new_version() {
  local version=""
  if [[ "${1:-}" == --version ]]; then version="${2:?--version needs a value}"; fi
  version="${version:-$(app_version)}"
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "version '$version' is not x.y.z."
  use_asc_profile
  asc versions create --app "$(asc_app_id)" --version "$version" --platform IOS --if-exists skip --output table
}

# --- screenshots ----------------------------------------------------------------------------------------------
# ios/appstore/screenshots/<apple locale>/iphone|ipad/*.png  ->  the IPHONE_65 / IPAD_PRO_3GEN_129 sets.
SHOT_KINDS=("iphone:IPHONE_65" "ipad:IPAD_PRO_3GEN_129")

# Calls "$1 locale kind device_type dir" for every non-empty folder.
each_shot_dir() {
  local fn="$1" loc kind pair dir
  [[ -d "$SHOTS" ]] || die "no $SHOTS yet. Put captures in $SHOTS/<locale>/iphone (and /ipad), or run: scripts/appstore.sh screenshots from-captures"
  for loc_dir in "$SHOTS"/*/; do
    [[ -d "$loc_dir" ]] || continue
    loc="$(basename "$loc_dir")"
    for pair in "${SHOT_KINDS[@]}"; do
      kind="${pair%%:*}"
      dir="$loc_dir$kind"
      compgen -G "$dir/*.png" >/dev/null || continue
      "$fn" "$loc" "$kind" "${pair##*:}" "$dir"
    done
  done
}

shot_validate() {
  local loc="$1" kind="$2" type="$3" dir="$4" n
  n="$(find "$dir" -maxdepth 1 -name '*.png' | wc -l)"
  [[ "$n" -le 10 ]] || die "$loc/$kind has $n screenshots; App Store Connect allows 10 per set."
  echo "== $loc/$kind ($n files, $type)"
  asc screenshots validate --path "$dir" --device-type "$type" --output table
}

shot_dry_run() {
  local loc="$1" kind="$2" type="$3" dir="$4"
  echo "== $loc/$kind: what App Store Connect would get (dry run)"
  asc screenshots upload --app "$(asc_app_id)" --version "$SHOT_VERSION" --locale "$loc" --path "$dir" --device-type "$type" --replace --dry-run --output table
}

shot_upload() {
  local loc="$1" kind="$2" type="$3" dir="$4"
  echo "== $loc/$kind: replacing the $type set"
  asc screenshots upload --app "$(asc_app_id)" --version "$SHOT_VERSION" --locale "$loc" --path "$dir" --device-type "$type" --replace --confirm --output table
}

cmd_screenshots() {
  local sub="${1:-}"; shift || true
  SHOT_VERSION="$(app_version)"
  case "$sub" in
    list)
      use_asc_profile
      asc screenshots list --app "$(asc_app_id)" --version "$SHOT_VERSION" --output table ;;
    from-captures)
      # Copies the numbered captures (NN-name.png) of one folder into the folder for one locale and kind.
      #   ipad:   defaults to screenshots/app-store-listing/ipad/<locale>, written by `npm run screenshots:app-store-ipad`.
      #   iphone: needs --from. The iPhone set is normally rendered, not copied: `npm run screenshots:app-store-iphone`
      #           writes the designed frames straight into ios/appstore/screenshots/<locale>/iphone. --from is for raw
      #           captures only (they have no device frame and show the web layout).
      local from="" loc="en-US" kind="iphone"
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --from) from="${2:?--from needs a folder}"; shift 2 ;;
          --locale) loc="${2:?--locale needs an Apple locale}"; shift 2 ;;
          --kind) kind="${2:?--kind needs iphone or ipad}"; shift 2 ;;
          *) die "screenshots from-captures: unknown option $1" ;;
        esac
      done
      [[ "$kind" == iphone || "$kind" == ipad ]] || die "--kind is iphone or ipad."
      if [[ -z "$from" ]]; then
        [[ "$kind" == ipad ]] || die "the iphone set is rendered: run npm run screenshots:app-store-iphone (or pass --from DIR for raw captures)."
        from="$ROOT/screenshots/app-store-listing/ipad/$loc"
      fi
      compgen -G "$from/[0-9][0-9]-*.png" >/dev/null || die "no NN-name.png captures in $from (run: npm run screenshots:app-store-ipad)."
      mkdir -p "$SHOTS/$loc/$kind"
      # The folder is replaced, not merged: a file the capture no longer makes must not stay on the store.
      rm -f "$SHOTS/$loc/$kind"/[0-9][0-9]-*.png
      cp -v "$from"/[0-9][0-9]-*.png "$SHOTS/$loc/$kind/"
      note "copied. Check them, then: scripts/appstore.sh screenshots validate" ;;
    validate)
      require_asc
      each_shot_dir shot_validate ;;
    plan)
      use_asc_profile
      each_shot_dir shot_validate
      each_shot_dir shot_dry_run ;;
    up)
      local yes=0
      [[ "${1:-}" != --yes ]] || yes=1
      use_asc_profile
      each_shot_dir shot_validate
      each_shot_dir shot_dry_run
      if [[ "$yes" -eq 0 ]]; then
        read -r -p "Replace these screenshot sets on App Store Connect for version $SHOT_VERSION? [y/N] " answer
        [[ "$answer" == y || "$answer" == Y ]] || { echo "Cancelled; nothing changed."; return 0; }
      fi
      each_shot_dir shot_upload
      note "done. Check them: scripts/appstore.sh screenshots list" ;;
    *) die "screenshots: use list, from-captures, validate, plan or up." ;;
  esac
}

sub="${1:-}"; shift || true
case "$sub" in
  pull) cmd_pull "$@" ;;
  plan) cmd_plan "$@" ;;
  up) cmd_up "$@" ;;
  new-version) cmd_new_version "$@" ;;
  screenshots) cmd_screenshots "$@" ;;
  validate) cmd_validate ;;
  audit) cmd_audit ;;
  from-listing) cmd_from_listing ;;
  -h|--help|"") sed -n '2,32p' "$0" ;;
  *) die "unknown subcommand '$sub'" ;;
esac
