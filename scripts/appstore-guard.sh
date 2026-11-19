#!/usr/bin/env bash
# Scans the app for App Store / Google Play rejection risks with the vendored app-store-compliance guard
# (.agents/skills/app-store-compliance) and fails on anything high or critical that is not a checked false
# positive in appstore-guard-known.json. Offline, read-only, no credentials. release-ios.sh runs it first.
#
#   scripts/appstore-guard.sh                      the app's own sources, iOS findings gate (default)
#   scripts/appstore-guard.sh --all-platforms      Google Play, Android and web findings gate too
#   scripts/appstore-guard.sh --fail-on critical|high|medium     (default high)
#   scripts/appstore-guard.sh --tree               scan the folder as it is, skill and docs included
#   scripts/appstore-guard.sh --raw                the guard's own report, unfiltered
#
# What it does and why it scans a snapshot: scripts/appstore_guard_gate.py, docs/APP_STORE.md.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
case "${1:-}" in -h|--help) sed -n '2,12p' "${BASH_SOURCE[0]}"; exit 0 ;; esac
command -v python3 >/dev/null 2>&1 || { echo "error: python3 is required." >&2; exit 1; }
exec python3 -I "$here/appstore_guard_gate.py" "$@"
