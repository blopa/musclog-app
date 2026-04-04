#!/usr/bin/env node

/**
 * Cross-platform script to apply iOS-specific fixes after prebuild.
 *
 * This script:
 * 1. Checks if running on macOS (Darwin)
 * 2. If macOS: runs pod install (which applies EXCLUDED_ARCHS fix + binary patches)
 *    then applies project.pbxproj fixes AFTER pod install completes
 * 3. If not macOS: skips silently
 *
 * IMPORTANT: The order matters:
 *   1. pod install (runs post_install hook with binary patches)
 *   2. fix-ios-project.js (modifies project.pbxproj with PBXTargetDependency)
 *
 * Used by: npm run lint:all
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const isMacOS = platform === 'darwin';

console.log(`[prebuild-ios-if-macos] Detected platform: ${platform}`);

if (!isMacOS) {
  console.log('[prebuild-ios-if-macos] Not macOS, skipping iOS fixes');
  process.exit(0);
}

// Check if ios directory exists (prebuild should have already run)
const iosDir = path.join(process.cwd(), 'ios');
if (!fs.existsSync(iosDir)) {
  console.log(
    '[prebuild-ios-if-macos] iOS directory not found. Make sure to run "expo prebuild" first.'
  );
  process.exit(0);
}

console.log('[prebuild-ios-if-macos] Applying iOS fixes...');

try {
  // Step 1: Run pod install (this applies EXCLUDED_ARCHS fix and binary patches via post_install hook)
  console.log('[prebuild-ios-if-macos] Running: pod install');
  execSync('cd ios && pod install', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  // Step 2: Apply project.pbxproj fixes AFTER pod install completes
  // This must be done after pod install because it references Pods.xcodeproj
  console.log('[prebuild-ios-if-macos] Running: fix-ios-project.js');
  execSync('node scripts/fix-ios-project.js', {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('[prebuild-ios-if-macos] ✅ iOS fixes applied successfully');
} catch (error) {
  console.error('[prebuild-ios-if-macos] ❌ Error:', error.message);
  process.exit(1);
}
