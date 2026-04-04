#!/usr/bin/env node

/**
 * Cross-platform prebuild script that handles macOS/iOS and Linux correctly.
 *
 * expo prebuild --clean already runs pod install internally.
 * After it completes, we just restore project.pbxproj from git to bring back
 * the PBXTargetDependency fix (IOS_SIMULATOR_BUILD_FIX.md section 2).
 *
 * DO NOT run pod install again — it crashes due to Ruby 4.0 / atomos gem
 * incompatibility in react_native_post_install, which destroys the xcworkspace.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');

const isMacOS = os.platform() === 'darwin';
const projectPbxprojPath = 'ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj';
const xcschemePath =
  'ios/MusclogLiftLogRepeat.xcodeproj/xcshareddata/xcschemes/MusclogLiftLogRepeat.xcscheme';

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
    // Step 2: Restore project.pbxproj from git (brings back PBXTargetDependency fix)
    // expo prebuild regenerated it; we need the committed version with the fix.
    console.log('[prebuild-cross-platform] Step 2: Restoring project.pbxproj from git...');
    try {
      execSync(`git checkout ${projectPbxprojPath} ${xcschemePath}`, {
        stdio: 'inherit',
        cwd: process.cwd(),
      });
      console.log('[prebuild-cross-platform] ✅ project.pbxproj and xcscheme restored from git');
    } catch (e) {
      // Not committed yet — apply fix-ios-project.js instead (patches both files)
      console.log(
        '[prebuild-cross-platform] ⚠️  Could not restore from git, applying fix-ios-project.js...'
      );
      execSync('node scripts/fix-ios-project.js', { stdio: 'inherit', cwd: process.cwd() });
    }

    // Step 3: Remove EXCLUDED_ARCHS from xcconfigs (IOS_SIMULATOR_BUILD_FIX.md section 2 & 10)
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
