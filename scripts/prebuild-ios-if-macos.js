#!/usr/bin/env node

/**
 * macOS-specific iOS prebuild fix script.
 *
 * CRITICAL: This script must re-run expo prebuild for iOS on macOS even if
 * it was already run on Linux. Linux prebuild generates a stripped-down iOS
 * project without proper CocoaPods integration.
 *
 * This script:
 * 1. Re-runs expo prebuild specifically for iOS (regenerates from scratch)
 * 2. Applies Podfile fixes (EXCLUDED_ARCHS)
 * 3. Runs pod install (full CocoaPods integration)
 * 4. Applies project.pbxproj fixes (PBXTargetDependency)
 *
 * Used by: npm run lint:all
 */

const { execSync } = require('child_process');
const os = require('os');

const platform = os.platform();
const isMacOS = platform === 'darwin';

console.log(`[prebuild-ios-if-macos] Detected platform: ${platform}`);

if (!isMacOS) {
  console.log('[prebuild-ios-if-macos] Not macOS, skipping iOS prebuild fix');
  process.exit(0);
}

console.log('[prebuild-ios-if-macos] Re-building iOS project with full CocoaPods integration...');

try {
  // Step 1: Re-run expo prebuild for iOS (regenerates from scratch with macOS CocoaPods support)
  // This is necessary because Linux prebuild creates a stripped-down iOS project
  console.log('[prebuild-ios-if-macos] Step 1: expo prebuild -p ios');
  execSync('expo prebuild -p ios', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Step 2: Run pod install (applies EXCLUDED_ARCHS fix + binary patches via post_install hook)
  console.log('[prebuild-ios-if-macos] Step 2: pod install');
  execSync('cd ios && pod install', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Step 3: Apply project.pbxproj fixes AFTER pod install completes
  console.log('[prebuild-ios-if-macos] Step 3: fix-ios-project.js');
  execSync('node scripts/fix-ios-project.js', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[prebuild-ios-if-macos] ✅ iOS project fixed successfully');
} catch (error) {
  console.error('[prebuild-ios-if-macos] ❌ Error:', error.message);
  process.exit(1);
}
