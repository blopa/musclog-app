#!/usr/bin/env python3
"""Make the legacy OpenCV arm64 slice linkable by the iOS Simulator."""

import os

from ios_simulator_binary import patch_arm64_binary


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
FRAMEWORK = os.path.join(ROOT, "ios/Pods/OpenCV/opencv2.framework/Versions/A/opencv2")


def main():
    if not os.path.exists(FRAMEWORK):
        print("OpenCV: not installed; skipping.")
        return

    result = patch_arm64_binary(FRAMEWORK)
    print(result.architecture_info)
    stats = result.stats
    if not stats.macho_members:
        print("OpenCV: no arm64 slice; skipping.")
    elif stats.patched_commands:
        print(
            f"OpenCV: patched {stats.patched_commands} device-only load commands "
            f"across {stats.macho_members} arm64 Mach-O members."
        )
    else:
        print(
            f"OpenCV: already simulator-compatible "
            f"({stats.macho_members} arm64 Mach-O members checked)."
        )


if __name__ == "__main__":
    main()
