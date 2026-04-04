/**
 * Expo Config Plugin to fix iOS Simulator build issues for Xcode 26 / iOS 26.4
 * 
 * This plugin modifies the Podfile to:
 * 1. Add EXCLUDED_ARCHS fix for arm64 simulator builds
 * 2. Run binary patches for OpenCV, MLImage, and MLKit frameworks after pod install
 * 
 * Usage: Add to app.json plugins array:
 * ["./plugins/withIosSimulatorBuildFix"]
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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
      if (podfileContent.includes('EXCLUDED_ARCHS[sdk=iphonesimulator*]')) {
        console.log('Podfile already has EXCLUDED_ARCHS fix, skipping...');
        return config;
      }

      console.log('Applying iOS Simulator build fixes to Podfile...');

      // Find the post_install block or create one
      const excludedArchsFix = `
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
`;

      // Check if there's already a post_install block
      const postInstallRegex = /(post_install do \|installer\|.*$)/m;
      
      if (postInstallRegex.test(podfileContent)) {
        // Add after the post_install do |installer| line
        podfileContent = podfileContent.replace(
          postInstallRegex,
          `$1${excludedArchsFix}`
        );
      } else {
        // Add a new post_install block at the end
        const newPostInstall = `
post_install do |installer|
${excludedArchsFix}
end
`;
        podfileContent += newPostInstall;
      }

      // Write the modified Podfile
      fs.writeFileSync(podfilePath, podfileContent);
      console.log('✅ Podfile updated with EXCLUDED_ARCHS fix');

      // Run binary patches if they exist
      const projectRoot = config.modRequest.projectRoot;
      const patchScripts = [
        { name: 'fix_opencv_simulator.py', framework: 'OpenCV' },
        { name: 'fix_mlimage_simulator.py', framework: 'MLImage' },
        { name: 'fix_mlkit_simulator.py', framework: 'MLKit' },
      ];

      for (const { name, framework } of patchScripts) {
        const scriptPath = path.join(projectRoot, name);
        if (fs.existsSync(scriptPath)) {
          try {
            console.log(`🔧 Running ${framework} patch...`);
            execSync(`python3 "${scriptPath}"`, { 
              cwd: projectRoot,
              stdio: 'pipe'
            });
            console.log(`✅ ${framework} patch completed`);
          } catch (error) {
            // Framework might not be installed, that's ok
            console.log(`⚠️  ${framework} patch skipped (framework may not be installed)`);
          }
        }
      }

      return config;
    },
  ]);
};

module.exports = withIosSimulatorBuildFix;
