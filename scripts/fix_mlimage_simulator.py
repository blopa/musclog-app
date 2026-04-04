#!/usr/bin/env python3
"""
Fix MLImage framework for iOS Simulator.

MLImage is distributed as a static library (archive), not a dynamic framework.
For static libraries, the EXCLUDED_ARCHS fix in the Podfile is sufficient.
"""

import os
import subprocess

def find_mlimage_framework():
    """Find MLImage.framework in Pods directory."""
    paths = [
        "ios/Pods/MLImage/Frameworks/MLImage.framework/MLImage",
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    return None

def main():
    framework_path = find_mlimage_framework()
    
    if not framework_path:
        print("ℹ️  MLImage framework not found, skipping")
        return 0
    
    # Check file type
    result = subprocess.run(['file', framework_path], capture_output=True, text=True)
    if 'ar archive' in result.stdout:
        print(f"ℹ️  MLImage is a static library (archive) - no binary patch needed")
        return 0
    elif 'Mach-O' in result.stdout:
        print(f"⚠️  MLImage is a dynamic framework but patching not implemented for this type")
        return 0
    else:
        print(f"ℹ️  MLImage framework type: {result.stdout.strip()}")
        return 0

if __name__ == "__main__":
    exit(main())
