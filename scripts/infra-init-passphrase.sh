#!/usr/bin/env bash
# Replaces the placeholder TF_ENCRYPTION passphrase in ~/keys/musclog-infra.env with a random one.
# Idempotent: does nothing once the placeholder is gone. Never prints the passphrase.
set -euo pipefail
FILE="${1:-$HOME/keys/musclog-infra.env}"
[[ -f "$FILE" ]] || { echo "missing $FILE" >&2; exit 1; }
if ! grep -q '<long random passphrase>' "$FILE"; then
  echo "passphrase already set in $FILE; nothing to do"
  exit 0
fi
pw="$(openssl rand -hex 32)"   # hex: no characters that need escaping
sed -i "s|<long random passphrase>|$pw|" "$FILE"
chmod 600 "$FILE"
echo "random passphrase written to $FILE (back that file up with your other keys)"
