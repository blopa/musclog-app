#!/usr/bin/env python3
"""Make installed ML Kit arm64 framework slices linkable by the iOS Simulator."""

import glob
import os

from ios_simulator_binary import PatchStats, patch_arm64_binary


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PODS_ROOT = os.path.join(ROOT, "ios", "Pods")


def installed_framework_binaries():
    framework_pattern = os.path.join(PODS_ROOT, "MLKit*", "Frameworks", "*.framework")
    binaries = []
    for framework_directory in glob.glob(framework_pattern):
        framework_name = os.path.splitext(os.path.basename(framework_directory))[0]
        binary_path = os.path.join(framework_directory, framework_name)
        if os.path.isfile(binary_path):
            binaries.append(binary_path)
    return sorted(binaries)


def main():
    frameworks = installed_framework_binaries()
    if not frameworks:
        print("MLKit: no installed binary frameworks found; skipping.")
        return

    totals = PatchStats()
    for framework in frameworks:
        result = patch_arm64_binary(framework)
        stats = result.stats
        framework_name = os.path.basename(framework)
        totals.include(stats)
        if not stats.macho_members:
            print(f"MLKit: {framework_name} has no arm64 slice; skipping.")
        elif stats.patched_commands:
            print(
                f"MLKit: patched {stats.patched_commands} device-only load commands "
                f"across {stats.macho_members} arm64 Mach-O members in {framework_name}."
            )
        else:
            print(
                f"MLKit: {framework_name} is already simulator-compatible "
                f"({stats.macho_members} arm64 Mach-O members checked)."
            )

    if totals.patched_commands:
        print(
            f"MLKit: patched {totals.patched_commands} device-only load commands "
            f"across {len(frameworks)} installed frameworks."
        )
    else:
        print(f"MLKit: all {len(frameworks)} installed frameworks are already compatible.")


if __name__ == "__main__":
    main()
