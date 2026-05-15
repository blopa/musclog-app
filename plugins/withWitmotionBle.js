/**
 * Expo config plugin for the WitMotion BLE module.
 *
 * This writes the Bluetooth permissions directly into the generated Android
 * manifest and iOS Info.plist during prebuild so the native projects always
 * stay in sync with the BLE feature.
 */

const { withAndroidManifest, withInfoPlist, withProjectBuildGradle } = require('@expo/config-plugins');

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

module.exports = function withWitmotionBle(config) {
  config = withProjectBuildGradle(config, (config) => {
    const buildGradle = config.modResults.contents;
    const repoLine = "    maven { url 'https://verve.jfrog.io/artifactory/verve-gradle-release' }";

    if (!buildGradle.includes(repoLine)) {
      config.modResults.contents = buildGradle.replace(
        /allprojects\s*\{\s*repositories\s*\{([\s\S]*?)\n\s*\}\s*\}/m,
        (match, reposBlock) => {
          if (reposBlock.includes("verve.jfrog.io/artifactory/verve-gradle-release")) {
            return match;
          }
          const insertionPoint = reposBlock.includes("maven { url 'https://www.jitpack.io' }")
            ? "    maven { url 'https://www.jitpack.io' }\n"
            : "    mavenCentral()\n";

          if (reposBlock.includes("maven { url 'https://www.jitpack.io' }")) {
            return match.replace(
              "    maven { url 'https://www.jitpack.io' }\n",
              "    maven { url 'https://www.jitpack.io' }\n" + repoLine + "\n"
            );
          }

          return match.replace(insertionPoint, insertionPoint + repoLine + "\n");
        }
      );
    }

    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] = ensureArray(manifest['uses-permission']);
    manifest['uses-feature'] = ensureArray(manifest['uses-feature']);

    const addPermission = (name) => {
      if (!manifest['uses-permission'].some((entry) => entry.$?.['android:name'] === name)) {
        manifest['uses-permission'].push({ $: { 'android:name': name } });
      }
    };

    const addFeature = (name) => {
      if (!manifest['uses-feature'].some((entry) => entry.$?.['android:name'] === name)) {
        manifest['uses-feature'].push({
          $: {
            'android:name': name,
            'android:required': 'false',
          },
        });
      }
    };

    [
      'android.permission.BLUETOOTH_SCAN',
      'android.permission.BLUETOOTH_CONNECT',
      'android.permission.BLUETOOTH_ADVERTISE',
      'android.permission.ACCESS_FINE_LOCATION',
      'android.permission.BLUETOOTH',
      'android.permission.BLUETOOTH_ADMIN',
      'android.permission.ACCESS_COARSE_LOCATION',
    ].forEach(addPermission);

    addFeature('android.hardware.bluetooth_le');
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothAlwaysUsageDescription =
      'Allow Musclog to connect to your WitMotion sensor and stream live motion data.';
    config.modResults.NSBluetoothPeripheralUsageDescription =
      'Allow Musclog to connect to your WitMotion sensor and stream live motion data.';
    return config;
  });

  return config;
};
