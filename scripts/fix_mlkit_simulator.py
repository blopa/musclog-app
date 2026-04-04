#!/usr/bin/env python3
"""
Fix MLKit frameworks for iOS Simulator.

MLKit frameworks are distributed as static libraries (archives), not dynamic frameworks.
For static libraries, the EXCLUDED_ARCHS fix in the Podfile is sufficient.
"""

import os
import subprocess
import glob

def find_mlkit_frameworks():
    """Find all MLKit*.framework in Pods directory."""
    patterns = [
        "ios/Pods/MLKit*/Frameworks/*.framework/MLKit*",
    ]
    
    frameworks = []
    for pattern in patterns:
        matches = glob.glob(pattern)
        for match in matches:
            if os.path.isfile(match) and 'MLKit' in os.path.basename(match):
                frameworks.append(match)
    return frameworks

def main():
    frameworks = find_mlkit_frameworks()
    
    if not frameworks:
        print("ℹ️  No MLKit frameworks found, skipping")
        return 0
    
    static_count = 0
    for framework in frameworks:
        result = subprocess.run(['file', framework], capture_output=True, text=True)
        if 'ar archive' in result.stdout:
            static_count += 1
        else:
            print(f"ℹ️  {os.path.basename(framework)}: {result.stdout.strip()[:60]}...")
    
    if static_count == len(frameworks):
        print(f"ℹ️  All {len(frameworks)} MLKit frameworks are static libraries - no binary patches needed")
    
    return 0

if __name__ == "__main__":
    exit(main())
