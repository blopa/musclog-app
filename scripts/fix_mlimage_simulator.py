#!/usr/bin/env python3
"""Make the MLImage arm64 slice linkable by the iOS Simulator."""

import os

from ios_simulator_binary import patch_arm64_binary


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRAMEWORK = os.path.join(ROOT, "ios/Pods/MLImage/Frameworks/MLImage.framework/MLImage")


def main():
    if not os.path.exists(FRAMEWORK):
        print("MLImage: not installed; skipping.")
        return

    result = patch_arm64_binary(FRAMEWORK)
    print(result.architecture_info)
    stats = result.stats
    if not stats.macho_members:
        print("MLImage: no arm64 slice; skipping.")
    elif stats.patched_commands:
        print(
            f"MLImage: patched {stats.patched_commands} device-only load commands "
            f"across {stats.macho_members} arm64 Mach-O members."
        )
    else:
        print(
            f"MLImage: already simulator-compatible "
            f"({stats.macho_members} arm64 Mach-O members checked)."
        )


if __name__ == "__main__":
    main()
