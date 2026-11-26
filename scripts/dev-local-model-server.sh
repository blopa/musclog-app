#!/usr/bin/env bash
# Development only: serves the app's downloadable on-device model (model + photo projector, the
# pinned files from constants/localModels.ts) through llama.cpp's llama-server, so the WEB dev build
# can try the "on-device" provider with photos. See services/localModels/devWebBridge.ts.
#
#   scripts/dev-local-model-server.sh          # standalone; normally started by `npm run web:local-llm`
#   PORT=9000 scripts/dev-local-model-server.sh
#
# Uses `llama-server` from PATH when present, otherwise the official llama.cpp image through podman.
set -euo pipefail

REPO="LiquidAI/LFM2.5-VL-450M-GGUF"
REVISION="1abed04b6fe71314d8c446a1371c03d7c332266d"
MODEL="LFM2.5-VL-450M-Q4_0.gguf"
PROJECTOR="mmproj-LFM2.5-VL-450m-Q8_0.gguf"
DIR="${MUSCLOG_DEV_MODEL_DIR:-$HOME/.cache/musclog-dev-model}"
PORT="${PORT:-8080}"

if ! [[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1 && "$PORT" -le 65535 ]]; then
  echo "Invalid PORT: $PORT (expected 1-65535)" >&2
  exit 2
fi

if ! command -v llama-server >/dev/null && ! command -v podman >/dev/null; then
  echo "Neither llama-server nor podman found on PATH" >&2
  exit 1
fi

mkdir -p "$DIR"
trap 'rm -f "$DIR"/*.part' EXIT
for file in "$MODEL" "$PROJECTOR"; do
  if [ ! -s "$DIR/$file" ]; then
    command -v curl >/dev/null || { echo "curl is required to download $file" >&2; exit 1; }
    echo "Downloading $file ..."
    curl -fL --retry 3 -o "$DIR/$file.part" "https://huggingface.co/$REPO/resolve/$REVISION/$file"
    mv "$DIR/$file.part" "$DIR/$file"
  fi
done

COMMON_FLAGS=(-c 4096 --jinja)

if command -v llama-server >/dev/null; then
  # llama-server answers cross-origin requests by default, so the browser can call it directly.
  exec llama-server -m "$DIR/$MODEL" --mmproj "$DIR/$PROJECTOR" "${COMMON_FLAGS[@]}" \
    --port "$PORT" --host 127.0.0.1
fi

# No local llama-server: run the official image (pulled on first use, about a few hundred MB).
echo "llama-server not on PATH; using podman (ghcr.io/ggml-org/llama.cpp:server)"
exec podman run --rm -p "127.0.0.1:${PORT}:8080" -v "$DIR:/models:ro,Z" \
  ghcr.io/ggml-org/llama.cpp:server -m "/models/$MODEL" --mmproj "/models/$PROJECTOR" \
  "${COMMON_FLAGS[@]}" --host 0.0.0.0 --port 8080
