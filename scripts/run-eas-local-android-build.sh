#!/usr/bin/env bash

set -euo pipefail

profile="${1:?Usage: $0 <profile> [--load-dotenv] [eas build options...]}"
shift

if [[ "${1:-}" == "--load-dotenv" ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
  shift
fi

# Keep the build and Gradle cache on the same filesystem. Native Android builds
# can then hard-link cached libraries instead of copying many gigabytes to /tmp.
working_root="${EAS_LOCAL_BUILD_ROOT:-${HOME}/eas-local-builds}"
mkdir -p "$working_root"
working_dir="$(mktemp -d -p "$working_root" eas-build-XXXXXXXX)"
export EAS_LOCAL_BUILD_WORKINGDIR="$working_dir"

# EAS normally removes the whole directory. This only cleans up an empty shell
# if EAS exits before registering its own cleanup handler.
trap 'rmdir "$working_dir" 2>/dev/null || true' EXIT

eas build --platform android --profile "$profile" --local "$@"
