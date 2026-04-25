#!/usr/bin/env node

/**
 * Cross-platform prebuild script that handles macOS/iOS and Linux correctly.
 *
 * expo prebuild --clean already runs pod install internally.
 * After it completes, fix-ios-project.js is run to apply all iOS project patches:
 *   - PBXTargetDependency fix
 *   - objectVersion / LastUpgradeCheck for Xcode 26
 *   - SUPPORTED_PLATFORMS
 *   - hermesvm.framework inputPaths/outputPaths (prevents duplicate CFBundleIdentifier)
 *   - xcscheme LastUpgradeVersion
 *
 * DO NOT run pod install again — it crashes due to Ruby 4.0 / atomos gem
 * incompatibility in react_native_post_install, which destroys the xcworkspace.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const isMacOS = os.platform() === 'darwin';

console.log(`[prebuild-cross-platform] Platform: ${os.platform()}`);

try {
  if (!isMacOS) {
    // On Linux, only prebuild for Android (skip iOS to avoid touching ios/ files)
    console.log('[prebuild-cross-platform] Step 1: expo prebuild --clean --platform android');
    execSync('npx expo prebuild --clean --platform android', {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    console.log('[prebuild-cross-platform] ✅ Prebuild complete');
    process.exit(0);
  }

  // Step 1: Clean prebuild (includes pod install via expo's built-in CocoaPods integration)
  console.log('[prebuild-cross-platform] Step 1: expo prebuild --clean');
  execSync('npx expo prebuild --clean', { stdio: 'inherit', cwd: process.cwd() });

  if (isMacOS) {
    // Step 2: Apply iOS project patches (PBXTargetDependency, hermesvm paths, xcscheme, etc.)
    console.log('[prebuild-cross-platform] Step 2: Applying iOS project patches...');
    execSync('npm run patch-ios-project', { stdio: 'inherit', cwd: process.cwd() });

    // Step 3: Remove EXCLUDED_ARCHS from xcconfigs
    // The main app target uses these xcconfigs as baseConfigurationReference.
    // EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64 prevents ALL simulator destination enumeration.
    console.log('[prebuild-cross-platform] Step 3: Removing EXCLUDED_ARCHS from xcconfigs...');
    const xcconfigs = [
      'ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.debug.xcconfig',
      'ios/Pods/Target Support Files/Pods-MusclogLiftLogRepeat/Pods-MusclogLiftLogRepeat.release.xcconfig',
      'ios/Pods/Target Support Files/OpenCV/OpenCV.debug.xcconfig',
      'ios/Pods/Target Support Files/OpenCV/OpenCV.release.xcconfig',
    ];
    for (const xcconfig of xcconfigs) {
      if (fs.existsSync(xcconfig)) {
        const content = fs.readFileSync(xcconfig, 'utf-8');
        const fixed = content.replace(/EXCLUDED_ARCHS\[sdk=iphonesimulator\*\] = arm64\n?/g, '');
        if (fixed !== content) {
          fs.writeFileSync(xcconfig, fixed);
          console.log(`[prebuild-cross-platform] ✅ Removed EXCLUDED_ARCHS from ${xcconfig}`);
        }
      }
    }

    console.log('[prebuild-cross-platform] ✅ iOS project ready');
  } else {
    console.log('[prebuild-cross-platform] ℹ️  Linux: Skipping iOS-specific steps');
  }

  console.log('[prebuild-cross-platform] ✅ Prebuild complete');
} catch (error) {
  console.error('[prebuild-cross-platform] ❌ Error:', error.message);
  process.exit(1);
}
