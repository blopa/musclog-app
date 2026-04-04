#!/usr/bin/env node

/**
 * Cross-platform prebuild script that handles macOS/iOS and Linux correctly.
 * 
 * Problem: `expo prebuild --clean` regenerates ios/ from scratch, wiping our fixes.
 * Solution: On macOS, we restore the project.pbxproj from git AFTER prebuild, then run pod install.
 * 
 * This matches the documented workflow in IOS_SIMULATOR_BUILD_FIX.md:
 * 1. expo prebuild -p ios (generates fresh iOS project)
 * 2. git checkout ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj (restore fixes)
 * 3. cd ios && pod install (install pods)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const isMacOS = os.platform() === 'darwin';
const projectPbxprojPath = 'ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj';

console.log(`[prebuild-cross-platform] Platform: ${os.platform()}`);

// Check if project.pbxproj has our fixes before prebuild
let hadFixesBefore = false;
if (fs.existsSync(projectPbxprojPath)) {
  const content = fs.readFileSync(projectPbxprojPath, 'utf-8');
  hadFixesBefore = content.includes('AF0E8295EA1C4ED79216E101');
  console.log(`[prebuild-cross-platform] Project had fixes before: ${hadFixesBefore}`);
}

try {
  // Step 1: Clean prebuild for both platforms
  // On Linux: generates Android + minimal iOS (no CocoaPods)
  // On macOS: generates Android + iOS with CocoaPods
  console.log('[prebuild-cross-platform] Step 1: expo prebuild --clean');
  execSync('npx expo prebuild --clean', { stdio: 'inherit', cwd: process.cwd() });

  if (isMacOS) {
    // Step 2: Restore project.pbxproj from git (brings back our fixes)
    // This is the key step from IOS_SIMULATOR_BUILD_FIX.md
    console.log('[prebuild-cross-platform] Step 2: Restoring project.pbxproj from git...');
    try {
      execSync(`git checkout ${projectPbxprojPath}`, { stdio: 'inherit', cwd: process.cwd() });
      console.log('[prebuild-cross-platform] ✅ project.pbxproj restored');
    } catch (e) {
      console.log('[prebuild-cross-platform] ⚠️  Could not restore from git (may not be committed yet)');
    }

    // Step 3: Apply fix-ios-project.js (in case git restore didn't work or we need to re-apply)
    console.log('[prebuild-cross-platform] Step 3: Applying fix-ios-project.js...');
    execSync('node scripts/fix-ios-project.js', { stdio: 'inherit', cwd: process.cwd() });

    // Step 4: Run pod install (this applies EXCLUDED_ARCHS fix via post_install hook)
    console.log('[prebuild-cross-platform] Step 4: pod install...');
    execSync('cd ios && pod install', { stdio: 'inherit', cwd: process.cwd() });

    console.log('[prebuild-cross-platform] ✅ iOS project ready');
  } else {
    console.log('[prebuild-cross-platform] ℹ️  Linux: Skipping iOS-specific steps');
  }

  console.log('[prebuild-cross-platform] ✅ Prebuild complete');
} catch (error) {
  console.error('[prebuild-cross-platform] ❌ Error:', error.message);
  process.exit(1);
}
