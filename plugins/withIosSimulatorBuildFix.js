/**
 * WHY THIS PLUGIN EXISTS
 *
 * The iOS OCR/barcode stack currently pulls in prebuilt Google ML Kit and
 * OpenCV pods that still carry old Intel-era simulator assumptions:
 *
 * - their CocoaPods xcconfigs exclude arm64 for `iphonesimulator`
 * - some arm64 binary slices are tagged as iOS device binaries
 *
 * That combination breaks local simulator builds on Apple Silicon Macs with
 * Xcode 26/iOS 26 simulators. expo-build-properties does not expose an iOS
 * option for overriding `EXCLUDED_ARCHS`, and direct edits to /ios are wiped
 * by `expo prebuild --clean`, so the least-bad Expo-native place for this is a
 * config plugin that patches the generated Podfile.
 *
 * The generated Podfile block is guarded too: it only runs for local macOS
 * arm64 pod installs, never on EAS or CI, and only when the affected pods are
 * present. Set MUSCLOG_IOS_SIMULATOR_BUILD_FIX=0 to force-disable it locally.
 *
 * WHEN CAN THIS BE REMOVED?
 *
 * Once the OCR/barcode dependencies ship modern XCFrameworks with proper arm64
 * simulator slices and no `EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64`
 * setting, delete this plugin and remove its entry from app.json.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const START = '# BEGIN Musclog iOS simulator build fix';
const END = '# END Musclog iOS simulator build fix';

const RUBY_BLOCK = `    ${START}
    # WHY DO WE NEED THIS?
    #
    # Google ML Kit and OpenCV still publish pods that exclude arm64 for iOS
    # simulator builds, but Apple Silicon iOS 26 simulators need arm64. This is
    # only for local Apple Silicon development builds; EAS/CI and non-arm64
    # hosts should use the normal pod settings.
    require 'rbconfig'

    simulator_fix_host_os = RbConfig::CONFIG['host_os']
    simulator_fix_host_arch = \`uname -m\`.strip
    simulator_fix_local_dev = ENV['EAS_BUILD'].nil? &&
      ENV['CI'].nil? &&
      ENV['MUSCLOG_IOS_SIMULATOR_BUILD_FIX'] != '0'
    simulator_fix_apple_silicon = simulator_fix_host_os.include?('darwin') &&
      ['arm64', 'arm64e'].include?(simulator_fix_host_arch)
    simulator_fix_needed = [
      'Pods/OpenCV/opencv2.framework',
      'Pods/MLImage/Frameworks/MLImage.framework',
      'Pods/MLKitCommon/Frameworks/MLKitCommon.framework',
    ].any? { |pod_path| File.exist?(File.join(__dir__, pod_path)) }

    if simulator_fix_local_dev && simulator_fix_apple_silicon && simulator_fix_needed
      Pod::UI.puts("[Musclog simulator fix] Applying local Apple Silicon iOS simulator patches")

      installer.pods_project.targets.each do |target|
        target.build_configurations.each do |config|
          config.build_settings['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
        end
      end

      installer.aggregate_targets.each do |aggregate_target|
        aggregate_target.xcconfigs.each do |_, xcconfig|
          xcconfig.attributes['EXCLUDED_ARCHS[sdk=iphonesimulator*]'] = ''
        end
      end

      Dir.glob(File.join(__dir__, 'Pods', 'Target Support Files', '**', '*.xcconfig')).each do |xcconfig_path|
        contents = File.read(xcconfig_path)
        next unless contents.include?('EXCLUDED_ARCHS[sdk=iphonesimulator*] = arm64')

        File.write(
          xcconfig_path,
          contents.gsub(/^EXCLUDED_ARCHS\\[sdk=iphonesimulator\\*\\] = arm64\\n/, '')
        )
      end

      [
        'scripts/fix_opencv_simulator.py',
        'scripts/fix_mlimage_simulator.py',
        'scripts/fix_mlkit_simulator.py',
      ].each do |script|
        script_path = File.expand_path("../#{script}", __dir__)
        unless File.exist?(script_path)
          Pod::UI.warn("[Musclog simulator fix] Missing #{script}")
          next
        end

        system('python3', script_path) || Pod::UI.warn("[Musclog simulator fix] #{script} failed")
      end
    else
      Pod::UI.puts("[Musclog simulator fix] Skipped; host/env/pods do not require it")
    end
    ${END}`;

function removeExistingBlock(contents) {
  const pattern = new RegExp(`\\n?\\s*${escapeRegExp(START)}[\\s\\S]*?\\n\\s*${escapeRegExp(END)}`);
  return contents.replace(pattern, '');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function addSimulatorFixToPodfile(contents) {
  const cleaned = removeExistingBlock(contents);

  if (!shouldGenerateSimulatorFix()) {
    return cleaned;
  }

  const anchor = /(\s+react_native_post_install\([\s\S]*?\n\s+\))/;

  if (!anchor.test(cleaned)) {
    throw new Error('Could not find react_native_post_install in ios/Podfile');
  }

  return cleaned.replace(anchor, `$1\n\n${RUBY_BLOCK}`);
}

function shouldGenerateSimulatorFix() {
  const hostArch = getHostArch();

  return (
    process.platform === 'darwin' &&
    ['arm64', 'arm64e'].includes(hostArch) &&
    !process.env.EAS_BUILD &&
    !process.env.CI &&
    process.env.MUSCLOG_IOS_SIMULATOR_BUILD_FIX !== '0'
  );
}

function getHostArch() {
  try {
    return execFileSync('uname', ['-m'], { encoding: 'utf8' }).trim();
  } catch {
    return process.arch;
  }
}

module.exports = function withIosSimulatorBuildFix(config) {
  return withDangerousMod(config, [
    'ios',
    (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      const nextContents = addSimulatorFixToPodfile(contents);

      if (nextContents !== contents) {
        fs.writeFileSync(podfilePath, nextContents);
      }

      return config;
    },
  ]);
};
