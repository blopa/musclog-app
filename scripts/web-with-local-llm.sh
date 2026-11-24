#!/usr/bin/env bash
# Development only: `npm run web` plus the desktop llama-server the web build needs to try the
# on-device (downloaded model) provider with photos. The server lives and dies with this command.
# Plain `npm run web` never starts it. See services/localModels/devWebBridge.ts.
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/dev-local-model-server.sh &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT INT TERM

# Fail fast if the server died at once (missing llama-server, failed download).
sleep 3
kill -0 "$server" 2>/dev/null || { echo "llama-server did not start" >&2; exit 1; }

EXPO_PUBLIC_DEV_LOCAL_MODEL=1 npm run web
