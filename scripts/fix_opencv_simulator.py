#!/usr/bin/env python3
"""
Fix OpenCV framework for iOS Simulator.

OpenCV 4.3.0 is distributed as a static library (archive), not a dynamic framework.
For static libraries, the EXCLUDED_ARCHS fix in the Podfile is sufficient.
This script just verifies the framework exists and reports its type.
"""

import os
import subprocess

def find_opencv_framework():
    """Find OpenCV2.framework in Pods directory."""
    paths = [
        "ios/Pods/OpenCV/opencv2.framework/opencv2",
        "ios/Pods/OpenCV2/opencv2.framework/opencv2",
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    return None

def main():
    framework_path = find_opencv_framework()
    
    if not framework_path:
        print("ℹ️  OpenCV2 framework not found, skipping")
        return 0
    
    # Check file type
    result = subprocess.run(['file', framework_path], capture_output=True, text=True)
    if 'ar archive' in result.stdout:
        print(f"ℹ️  OpenCV is a static library (archive) - no binary patch needed")
        print(f"   The EXCLUDED_ARCHS fix in Podfile is sufficient")
        return 0
    elif 'Mach-O' in result.stdout:
        print(f"⚠️  OpenCV is a dynamic framework but patching not implemented for this type")
        return 0
    else:
        print(f"ℹ️  OpenCV framework type: {result.stdout.strip()}")
        return 0

if __name__ == "__main__":
    exit(main())
