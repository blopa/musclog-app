const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * iOS Simulator Build Fix for Xcode 15/16
 *
 * CRITICAL: Binary patches should ONLY be applied for simulator builds.
 * For device/App Store builds, the patches would incorrectly mark frameworks
 * as simulator-only, causing build failures.
 *
 * Strategy:
 * 1. EAS Builds: Use EAS_BUILD_PLATFORM env var (set in eas.json)
 * 2. Local Builds: Use EXPO_IS_SIMULATOR_BUILD env var (set manually)
 * 3. Default: Apply patches (safe for local dev, opt-out for device builds)
 */
const withIosSimulatorBuildFix = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const podfilePath = path.join(projectRoot, 'ios', 'Podfile');

      if (!fs.existsSync(podfilePath)) {
        console.log('[withIosSimulatorBuildFix] Podfile not found, skipping');
        return config;
      }

      let podfileContent = fs.readFileSync(podfilePath, 'utf-8');

      // Check if already patched
      if (podfileContent.includes('### EXPO SIMULATOR BUILD FIX ###')) {
        console.log('[withIosSimulatorBuildFix] Podfile already patched');
        return config;
      }

      // Find the post_install hook
      const postInstallMatch = podfileContent.match(/post_install\s+do\s*\|installer\|/);

      if (postInstallMatch) {
        // Insert after post_install do |installer|
        const insertIndex = postInstallMatch.index + postInstallMatch[0].length;

        const fixCode = `
    ### EXPO SIMULATOR BUILD FIX ###
    # Fix for Xcode 15/16: Remove EXCLUDED_ARCHS for simulators
    # Also raise pod deployment targets to silence version mismatch warnings
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        config.build_settings.delete('EXCLUDED_ARCHS[sdk=iphonesimulator*]')
        if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < 16.0
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.0'
        end
      end
    end

    # Determine if this is a simulator build
    # Priority: EAS_BUILD_PLATFORM > EXPO_IS_SIMULATOR_BUILD > default to true (local dev)
    eas_platform = ENV['EAS_BUILD_PLATFORM']
    explicit_simulator = ENV['EXPO_IS_SIMULATOR_BUILD']
    
    is_simulator = if eas_platform
      eas_platform == 'simulator'
    elsif explicit_simulator
      explicit_simulator == 'true'
    else
      true # Default: assume simulator for local development
    end
    
    if is_simulator
      puts "[ExpoSimulatorFix] Detected simulator build - applying binary patches..."
      # Use absolute path from project root
      scripts_dir = File.expand_path('../scripts', __dir__)
      system("python3 #{scripts_dir}/fix_opencv_simulator.py")
      system("python3 #{scripts_dir}/fix_mlimage_simulator.py")
      system("python3 #{scripts_dir}/fix_mlkit_simulator.py")
    else
      puts "[ExpoSimulatorFix] Device build detected - skipping simulator binary patches"
    end
    ### END EXPO SIMULATOR BUILD FIX ###
`;

        podfileContent =
          podfileContent.slice(0, insertIndex) + fixCode + podfileContent.slice(insertIndex);

        fs.writeFileSync(podfilePath, podfileContent);
        console.log('[withIosSimulatorBuildFix] Podfile patched successfully');
      } else {
        console.log('[withIosSimulatorFix] Warning: Could not find post_install hook');
      }

      return config;
    },
  ]);
};

module.exports = withIosSimulatorBuildFix;
