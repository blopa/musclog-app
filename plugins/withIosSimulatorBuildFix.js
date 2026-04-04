/**
 * Expo Config Plugin to fix iOS Simulator build issues for Xcode 26 / iOS 26.4
 *
 * This plugin modifies the Podfile to:
 * 1. Add EXCLUDED_ARCHS fix for arm64 simulator builds
 * 2. Run binary patches for OpenCV, MLImage, and MLKit frameworks AFTER pod install
 *
 * Usage: Add to app.json plugins array:
 * ["./plugins/withIosSimulatorBuildFix"]
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withIosSimulatorBuildFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosPath = path.join(config.modRequest.projectRoot, 'ios');
      const podfilePath = path.join(iosPath, 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.log('Podfile not found, skipping iOS simulator fixes...');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if already patched
      if (podfileContent.includes('PATCH_IOS_FRAMEWORKS')) {
        console.log('Podfile already has iOS simulator build fix, skipping...');
        return config;
      }

      console.log('Applying iOS Simulator build fixes to Podfile...');

      // Create the post_install hook with both EXCLUDED_ARCHS fix and binary patches
      const postInstallFix = `
    # Fix for iOS 26.4 simulator (arm64 only, no x86_64)
    # Remove EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64 from all targets
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
      end
    end
    installer.pods_project.build_configurations.each do |config|
      config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
    end
    
    # PATCH_IOS_FRAMEWORKS - Run binary patches after pods are installed
    puts "Running iOS framework binary patches..."
    system("python3 fix_opencv_simulator.py") if File.exist?("../fix_opencv_simulator.py")
    system("python3 fix_mlimage_simulator.py") if File.exist?("../fix_mlimage_simulator.py")
    system("python3 fix_mlkit_simulator.py") if File.exist?("../fix_mlkit_simulator.py")
`;

      // Check if there's already a post_install block
      const postInstallRegex = /(post_install do \|installer\|.*$)/m;

      if (postInstallRegex.test(podfileContent)) {
        // Add after the post_install do |installer| line
        podfileContent = podfileContent.replace(postInstallRegex, `$1${postInstallFix}`);
      } else {
        // Add a new post_install block at the end
        const newPostInstall = `
post_install do |installer|
${postInstallFix}
end
`;
        podfileContent += newPostInstall;
      }

      // Write the modified Podfile
      fs.writeFileSync(podfilePath, podfileContent);
      console.log('✅ Podfile updated with EXCLUDED_ARCHS fix and binary patch hooks');

      return config;
    },
  ]);
};

module.exports = withIosSimulatorBuildFix;
