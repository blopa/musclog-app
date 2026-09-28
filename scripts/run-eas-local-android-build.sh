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

# Gradle 8.13 cannot run on Java 25+ (it fails resolving com.facebook.react.settings
# with the bare Java version as the message), and Fedora now ships only JDK 25.
# Use JAVA_HOME if it is 17 or 21, otherwise pick one from ~/.jdks or /usr/lib/jvm.
java_major() {
  "$1/bin/java" -version 2>&1 | sed -nE '1s/.*version "([0-9]+).*/\1/p'
}

is_supported_jdk() {
  [[ -x "$1/bin/java" ]] || return 1
  local major
  major="$(java_major "$1")"
  [[ "$major" == "17" || "$major" == "21" ]]
}

if ! is_supported_jdk "${JAVA_HOME:-}"; then
  found_jdk=""
  for candidate in "$HOME"/.jdks/jdk-17* "$HOME"/.jdks/jdk-21* /usr/lib/jvm/java-17-* /usr/lib/jvm/java-21-*; do
    if is_supported_jdk "$candidate"; then
      found_jdk="$candidate"
      break
    fi
  done
  if [[ -z "$found_jdk" ]]; then
    echo "error: Android builds need JDK 17 or 21 (Gradle 8.13 cannot run on newer Java)." >&2
    echo "Install one under ~/.jdks, e.g. an Eclipse Temurin 17 tarball from https://adoptium.net" >&2
    exit 1
  fi
  export JAVA_HOME="$found_jdk"
fi
export PATH="$JAVA_HOME/bin:$PATH"
echo "Using JAVA_HOME=$JAVA_HOME (Java $(java_major "$JAVA_HOME"))"

# The EAS working copy has no local.properties, so Gradle needs ANDROID_HOME.
# Fall back to Android Studio's default SDK location.
if [[ -z "${ANDROID_HOME:-}" ]]; then
  ANDROID_HOME="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
fi
if [[ ! -d "$ANDROID_HOME/platforms" ]]; then
  echo "error: Android SDK not found at $ANDROID_HOME; set ANDROID_HOME." >&2
  exit 1
fi
export ANDROID_HOME
echo "Using ANDROID_HOME=$ANDROID_HOME"

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
