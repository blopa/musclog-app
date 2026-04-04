#!/usr/bin/env node

/**
 * Cross-platform prebuild script.
 *
 * CRITICAL ORDER:
 * 1. expo prebuild --clean (generates fresh iOS/Android projects)
 * 2. pod install (installs pods, runs post_install hooks)
 * 3. fix-ios-project.js (applies PBXTargetDependency fix AFTER pod install)
 *
 * The PBXTargetDependency fix must be applied AFTER pod install, not before,
 * because it references Pods.xcodeproj which causes CocoaPods to fail during post_install.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const isMacOS = os.platform() === 'darwin';

console.log(`[prebuild-cross-platform] Platform: ${os.platform()}`);

try {
  // Step 1: Clean prebuild
  console.log('[prebuild-cross-platform] Step 1: expo prebuild --clean');
  execSync('npx expo prebuild --clean', { stdio: 'inherit', cwd: process.cwd() });

  if (isMacOS) {
    // Step 2: Run pod install (this applies EXCLUDED_ARCHS fix via post_install hook)
    // IMPORTANT: Do NOT modify project.pbxproj before this step!
    console.log('[prebuild-cross-platform] Step 2: pod install');
    try {
      execSync('cd ios && pod install', { stdio: 'inherit', cwd: process.cwd() });
    } catch (e) {
      // Pod install may fail due to the post_install hook issue
      // Continue anyway and try to fix it
      console.log('[prebuild-cross-platform] ⚠️  pod install had issues, continuing with fix...');
    }

    // Step 3: Apply project.pbxproj fixes AFTER pod install
    // This adds PBXTargetDependency which can't be in the project during pod install
    console.log('[prebuild-cross-platform] Step 3: Applying fix-ios-project.js');
    execSync('node scripts/fix-ios-project.js', { stdio: 'inherit', cwd: process.cwd() });

    console.log('[prebuild-cross-platform] ✅ iOS project ready');
  } else {
    console.log('[prebuild-cross-platform] ℹ️  Linux: Skipping iOS-specific steps');
  }

  console.log('[prebuild-cross-platform] ✅ Prebuild complete');
} catch (error) {
  console.error('[prebuild-cross-platform] ❌ Error:', error.message);
  process.exit(1);
}
