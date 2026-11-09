#!/usr/bin/env bash
# The Google Play store listing as files, Terraform-style.
#
#   scripts/play.sh pull                       Play -> repo (mirrors Play: wipes metadata/ first)
#   scripts/play.sh plan                       diff only, changes nothing
#   scripts/play.sh check [--with-images]      rehearsal: edit, apply, validate, delete the edit
#   scripts/play.sh up [--yes] [--no-review] [--with-images] [--allow-destructive]
#                                              show the plan, confirm, apply, commit the edit
#   scripts/play.sh fmt                        strip trailing newlines from the text files
#
# Desired state: android/play/metadata/<locale>/{title,short_description,full_description,video}.txt
# (Fastlane layout, images under <locale>/images/) and android/play/app.json (contactEmail,
# contactPhone, contactWebsite, defaultLanguage). A listing change goes to Google review.
# Never run `up` without the owner's go-ahead. See docs/GOOGLE_PLAY.md.
set -euo pipefail
# shellcheck source=lib/gplay-common.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib/gplay-common.sh"

PLAY_DIR="$(repo_root)/android/play"
META_DIR="$PLAY_DIR/metadata"
DETAILS_FILE="$PLAY_DIR/app.json"
LIMIT_TITLE=30 LIMIT_SHORT=80 LIMIT_FULL=4000
WORK="$(mktemp -d)"
trap 'edit_cleanup; rm -rf "$WORK"' EXIT

summarize_plan() {
  # One line per effect, never the whole text.
  jq -r '
    "destructive: \(.destructiveCount // 0)",
    (if (.effects // []) | length == 0 then "no listing or image changes"
     else (.effects[] | "  \(.kind)\t\(.locale // "-")") end)' "$1"
}

plan_has_non_listing() {
  jq -e '[(.effects // [])[] | select(.kind | startswith("listing.") | not)] | length > 0' "$1" >/dev/null
}

lint_text() {
  [[ -d "$META_DIR" ]] || die "no $META_DIR yet. Run: scripts/play.sh pull"
  python3 -I - "$META_DIR" "$LIMIT_TITLE" "$LIMIT_SHORT" "$LIMIT_FULL" <<'PY' || die "listing text problems above (fix them, or run 'scripts/play.sh fmt' for newlines)."
import os, sys
root, lt, ls, lf = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
limits = {"title.txt": lt, "short_description.txt": ls, "full_description.txt": lf}
bad = 0
for loc in sorted(os.listdir(root)):
    d = os.path.join(root, loc)
    if not os.path.isdir(d):
        continue
    for name in sorted(os.listdir(d)):
        p = os.path.join(d, name)
        if not name.endswith(".txt") or not os.path.isfile(p):
            continue
        text = open(p, encoding="utf-8").read()
        if text.endswith("\n"):
            print(f"{loc}/{name}: ends with a newline (Play stores none; every locale would show as changed)", file=sys.stderr); bad = 1
        if name in limits and len(text) > limits[name]:
            print(f"{loc}/{name}: {len(text)} chars, limit {limits[name]}", file=sys.stderr); bad = 1
sys.exit(bad)
PY
}

details_json() {
  # Only the four fields we manage, in a stable order.
  jq -S '{contactEmail, contactPhone, contactWebsite, defaultLanguage}'
}

details_diff() {
  [[ -f "$DETAILS_FILE" ]] || die "no $DETAILS_FILE. Run: scripts/play.sh pull"
  gplay details get --package "$PACKAGE" --edit "$EDIT_ID" | details_json > "$WORK/details.remote.json"
  details_json < "$DETAILS_FILE" > "$WORK/details.local.json"
  if diff -u "$WORK/details.remote.json" "$WORK/details.local.json" > "$WORK/details.diff"; then
    echo "app details: no changes"
    return 1
  fi
  echo "app details: changes"
  grep -E '^[+-] ' "$WORK/details.diff" | sed 's/^/  /' || true
  return 0
}

make_plan() {
  lint_text
  open_edit
  gplay sync plan --package "$PACKAGE" --edit "$EDIT_ID" --dir "$META_DIR" --plan-file "$WORK/plan.json" >/dev/null
  [[ -s "$WORK/plan.json" ]] || die "gplay wrote no plan."
}

cmd_fmt() {
  [[ -d "$META_DIR" ]] || die "no $META_DIR."
  python3 -I - "$META_DIR" <<'PY'
import os, sys
for dp, _, fs in os.walk(sys.argv[1]):
    for f in fs:
        if f.endswith(".txt"):
            p = os.path.join(dp, f)
            t = open(p, encoding="utf-8").read()
            if t.endswith("\n"):
                open(p, "w", encoding="utf-8", newline="").write(t.rstrip("\n"))
                print("fixed", p)
PY
}

# Play lists images as *_meta.json only; the files are public and `=s0` gives the original.
download_images() {
  python3 -I - "$META_DIR" <<'PY'
import glob, hashlib, json, os, sys, urllib.request
root = sys.argv[1]
SINGLE = {"icon", "featureGraphic", "promoGraphic", "tvBanner"}
bad = 0
for meta in sorted(glob.glob(os.path.join(root, "**", "*_meta.json"), recursive=True)):
    kind = os.path.basename(meta)[: -len("_meta.json")]
    data = json.load(open(meta))
    items = data if isinstance(data, list) else next((v for v in data.values() if isinstance(v, list)), [data])
    out_dir = os.path.dirname(meta)
    for i, it in enumerate(items, 1):
        url, want = it.get("url"), (it.get("sha256") or "").lower()
        if not url:
            continue
        # Screenshot meta files already sit in images/<type>/; single images' meta sit in images/.
        name = f"{kind}.png" if kind in SINGLE else f"{i:02d}.png"
        dest = os.path.join(out_dir, name)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        body = urllib.request.urlopen(url + "=s0").read()
        got = hashlib.sha256(body).hexdigest()
        if want and got != want:
            print(f"{dest}: sha256 mismatch (Play {want[:12]}, got {got[:12]})", file=sys.stderr); bad = 1
            continue
        open(dest, "wb").write(body)
    os.remove(meta)
sys.exit(bad)
PY
}

cmd_pull() {
  mkdir -p "$PLAY_DIR"
  open_edit
  rm -rf "$META_DIR"
  gplay sync export-listings --package "$PACKAGE" --edit "$EDIT_ID" --dir "$META_DIR" >/dev/null
  gplay details get --package "$PACKAGE" --edit "$EDIT_ID" | details_json > "$DETAILS_FILE"
  gplay sync export-images --package "$PACKAGE" --edit "$EDIT_ID" --dir "$META_DIR" >/dev/null
  download_images || die "image download or hash check failed."
  # Play stores no trailing newline; the export should match, but be sure.
  cmd_fmt >/dev/null
  note "pulled $(find "$META_DIR" -mindepth 1 -maxdepth 1 -type d | wc -l) locales into $PLAY_DIR"
  rm -f "$WORK"/*.json
}

cmd_plan() {
  make_plan
  summarize_plan "$WORK/plan.json"
  if plan_has_non_listing "$WORK/plan.json"; then
    echo "NOTE: non-listing effects (images) present; check/up refuse these without --with-images." >&2
  fi
  details_diff || true
}

parse_flags() {
  YES=0 NO_REVIEW=0 WITH_IMAGES=0 ALLOW_DESTRUCTIVE=0
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --yes) YES=1 ;;
      --no-review) NO_REVIEW=1 ;;
      --with-images) WITH_IMAGES=1 ;;
      --allow-destructive) ALLOW_DESTRUCTIVE=1 ;;
      *) die "unknown option $1" ;;
    esac
    shift
  done
}

# Shows the plan, enforces the guards, applies it into the open edit.
apply_into_edit() {
  summarize_plan "$WORK/plan.json"
  if [[ "$WITH_IMAGES" -eq 0 ]] && plan_has_non_listing "$WORK/plan.json"; then
    die "the plan has non-listing effects (images). Images are not automated yet; rerun with --with-images only on purpose."
  fi
  if [[ "$(jq '.destructiveCount // 0' "$WORK/plan.json")" -gt 0 && "$ALLOW_DESTRUCTIVE" -eq 0 ]]; then
    die "the plan is destructive. Review it, then pass --allow-destructive."
  fi
  local has_listing=0 has_details=0
  [[ "$(jq '(.effects // []) | length' "$WORK/plan.json")" -gt 0 ]] && has_listing=1
  details_diff && has_details=1
  if [[ "$has_listing" -eq 0 && "$has_details" -eq 0 ]]; then
    note "nothing to change"
    return 3
  fi
  [[ "$1" == "confirm" && "$YES" -eq 0 ]] && {
    read -r -p "Apply this to Google Play and send it for review? [y/N] " ans
    [[ "$ans" == "y" || "$ans" == "Y" ]] || die "aborted."
  }
  if [[ "$has_listing" -eq 1 ]]; then
    gplay sync run --package "$PACKAGE" --edit "$EDIT_ID" --dir "$META_DIR" --state-dir "$WORK/state" >/dev/null
  fi
  if [[ "$has_details" -eq 1 ]]; then
    gplay details patch --package "$PACKAGE" --edit "$EDIT_ID" --json "@$DETAILS_FILE" >/dev/null
  fi
  gplay edits validate --package "$PACKAGE" --edit "$EDIT_ID" >/dev/null
}

cmd_check() {
  parse_flags "$@"
  make_plan
  local rc=0
  apply_into_edit rehearse || rc=$?
  [[ "$rc" -eq 3 ]] && { note "check ok (nothing to apply); edit discarded"; return 0; }
  [[ "$rc" -eq 0 ]] || return "$rc"
  note "check ok: applied and validated in an edit that is now discarded (nothing was published)"
}

cmd_up() {
  parse_flags "$@"
  make_plan
  local rc=0
  apply_into_edit confirm || rc=$?
  [[ "$rc" -eq 3 ]] && return 0
  [[ "$rc" -eq 0 ]] || return "$rc"
  local flags=()
  [[ "$NO_REVIEW" -eq 1 ]] && flags+=(--changes-not-sent-for-review)
  gplay edits commit --package "$PACKAGE" --edit "$EDIT_ID" "${flags[@]}" >/dev/null
  EDIT_COMMITTED=1
  note "committed"
}

require_gplay
use_profile
sub="${1:-}"; shift || true
case "$sub" in
  pull) cmd_pull ;;
  plan) cmd_plan ;;
  check) cmd_check "$@" ;;
  up) cmd_up "$@" ;;
  fmt) cmd_fmt ;;
  -h|--help|"") sed -n '2,13p' "$0" ;;
  *) die "unknown subcommand '$sub'" ;;
esac
