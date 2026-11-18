#!/usr/bin/env bash
# The App Store listing as files, Terraform-style. The counterpart of play.sh, with `asc metadata`
# (https://github.com/rorkai/App-Store-Connect-CLI).
#
#   scripts/appstore.sh pull [--version X.Y.Z]   App Store Connect -> repo (mirrors it: ios/appstore/metadata is replaced)
#   scripts/appstore.sh plan                     repo vs App Store Connect, changes nothing
#   scripts/appstore.sh up [--yes]               show the plan, confirm, apply (--if-exists update)
#   scripts/appstore.sh validate                 offline lint (limits, other platforms) + `asc metadata validate --check-urls`
#   scripts/appstore.sh audit                    the text against App Review's metadata rules (vendored metadata-audit.py), offline
#   scripts/appstore.sh from-listing             Play listing -> ios/appstore/metadata (appstore-listing-metadata.py)
#
# Desired state: ios/appstore/metadata/app-info/<locale>.json (name, subtitle, privacyPolicyUrl) and
# ios/appstore/metadata/version/<X.Y.Z>/<locale>.json (description, keywords, promotionalText, supportUrl,
# marketingUrl, whatsNew). A field left out of a file is not touched on App Store Connect, and nothing is
# deleted (no --allow-deletes). Never run `up` without the owner's go-ahead. See docs/APP_STORE.md.
#
# NOT managed here: screenshots, the category, the age rating, the App Privacy answers, pricing and
# availability, and the App Review contact (asc can pull and push the category, age rating and review contact
# as opt-in scopes; the demo password never lands in a file). New builds and submissions go out with
# release-ios.sh. Text edits to a live version reach the store with the next submitted version, except the
# promotional text, which App Store Connect publishes at once.
set -euo pipefail
# shellcheck source=lib/asc-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/asc-common.sh"

ROOT="$(repo_root)"
META="$APPSTORE_META"
AUDIT="$ROOT/.agents/skills/app-store-compliance/scripts/metadata-audit.py"
WORK=""
cleanup() { [[ -n "$WORK" ]] && rm -rf "$WORK"; return 0; }
trap cleanup EXIT

# The one version folder in $META/version (asc names it after the version string), or stop.
meta_version() {
  local dirs
  dirs="$(find "$META/version" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | sort)"
  [[ -n "$dirs" ]] || die "no version folder in $META/version. Run 'scripts/appstore.sh pull' (or from-listing) first."
  [[ "$(printf '%s\n' "$dirs" | wc -l)" == 1 ]] || die "more than one version folder in $META/version; keep only the one you edit:
$dirs"
  basename "$dirs"
}

cmd_pull() {
  local version=()
  if [[ "${1:-}" == --version ]]; then version=(--version "${2:?--version needs a value}"); fi
  use_asc_profile
  WORK="$(mktemp -d)"
  note "pulling the App Store listing"
  # Into a temp folder first: a failed pull must not leave the repo without its files.
  asc metadata pull --app "$(asc_app_id)" ${version[@]+"${version[@]}"} --platform IOS --dir "$WORK/metadata" --output table
  [[ -d "$WORK/metadata" ]] || die "asc pulled nothing."
  rm -rf "$META"
  mkdir -p "$APPSTORE_DIR"
  mv "$WORK/metadata" "$META"
  note "pulled into $META. Review with: git status --short ios/appstore"
}

cmd_plan() {
  use_asc_profile
  local v
  v="$(meta_version)"
  echo "== Listing for version $v (dry run, nothing is changed)"
  asc metadata push --app "$(asc_app_id)" --version "$v" --platform IOS --dir "$META" --dry-run --output table
}

cmd_up() {
  local yes=0
  [[ "${1:-}" != --yes ]] || yes=1
  cmd_lint
  cmd_plan
  echo
  if [[ "$yes" -eq 0 ]]; then
    read -r -p "Apply this to App Store Connect for $(app_bundle_id)? [y/N] " answer
    [[ "$answer" == y || "$answer" == Y ]] || { echo "Cancelled; nothing changed."; return 0; }
  fi
  asc metadata push --app "$(asc_app_id)" --version "$(meta_version)" --platform IOS --dir "$META" --if-exists update --output table
  note "applied. App Store Connect now matches $META."
}

# Limits and other-platform names, offline, over the files as they are.
cmd_lint() {
  [[ -d "$META" ]] || die "no $META yet. Run 'scripts/appstore.sh pull' or 'from-listing' first."
  python3 -I - "$META" <<'PY' || die "listing text problems above."
import json, re, sys
from pathlib import Path
limits = {"name": 30, "subtitle": 30, "keywords": 100, "promotionalText": 170, "description": 4000}
other = re.compile(r"\b(Android|Google Play|Play Store|Play Console|Wear OS|Huawei|AppGallery)\b", re.I)
bad = 0
for f in sorted(Path(sys.argv[1]).rglob("*.json")):
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
for f in sorted(meta.rglob("*.json")):
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

sub="${1:-}"; shift || true
case "$sub" in
  pull) cmd_pull "$@" ;;
  plan) cmd_plan ;;
  up) cmd_up "$@" ;;
  validate) cmd_validate ;;
  audit) cmd_audit ;;
  from-listing) cmd_from_listing ;;
  -h|--help|"") sed -n '2,22p' "$0" ;;
  *) die "unknown subcommand '$sub'" ;;
esac
