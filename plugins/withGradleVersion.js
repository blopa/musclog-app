/**
 * WHY THIS PLUGIN EXISTS
 *
 * Expo's prebuild generates an /android folder whose gradle-wrapper.properties
 * points to Gradle 9.0.0. Gradle 9 removed the IBM_SEMERU constant from
 * JvmVendorSpec, but the foojay-resolver-convention Gradle plugin version
 * pinned by React Native (0.5.0) still references that constant. This causes
 * every local `expo run:android` build to fail immediately with:
 *
 *   NoSuchFieldError: Class org.gradle.jvm.toolchain.JvmVendorSpec does not
 *   have member field 'org.gradle.jvm.toolchain.JvmVendorSpec IBM_SEMERU'
 *
 * EAS Cloud builds are unaffected because they run in an environment pinned to
 * Gradle 8.x, where IBM_SEMERU still exists.
 *
 * expo-build-properties has no gradleVersion property, so the only way to
 * override the generated wrapper without manually editing /android (which gets
 * wiped on every prebuild) is this config plugin.
 *
 * WHEN CAN THIS BE REMOVED?
 *
 * React Native 0.86.0 upgrades foojay-resolver-convention to 1.0.0, which
 * drops the IBM_SEMERU reference and is fully compatible with Gradle 9.
 * Track progress at: https://github.com/facebook/react-native/issues/55781
 *
 * Once this project upgrades to RN 0.86.0 (stable), delete this plugin and
 * remove its entry from app.json.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

module.exports = function withGradleVersion(config, { version = '8.13' } = {}) {
  return withDangerousMod(config, [
    'android',
    (config) => {
      const wrapperPath = path.join(
        config.modRequest.platformProjectRoot,
        'gradle/wrapper/gradle-wrapper.properties'
      );
      let contents = fs.readFileSync(wrapperPath, 'utf8');
      contents = contents.replace(
        /distributionUrl=.*/,
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${version}-bin.zip`
      );
      fs.writeFileSync(wrapperPath, contents);
      return config;
    },
  ]);
};
