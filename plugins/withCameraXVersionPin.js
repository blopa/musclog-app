/**
 * WHY THIS PLUGIN EXISTS
 *
 * The app ships two camera stacks: react-native-vision-camera (the main smart camera) and
 * expo-camera (used only by the reps-recording test screen). vision-camera 4.7.3 declares
 * CameraX 1.5.0-alpha03 and links against CameraX-internal classes (Camera2CameraInfoImpl);
 * expo-camera SDK 57 declares CameraX 1.6.0, where that internal camera2 implementation was
 * removed. Gradle resolves each androidx.camera artifact to the highest requested version, so
 * without this pin the APK packages CameraX 1.6.0 and vision-camera crashes at startup with
 * NoClassDefFoundError (Camera2CameraInfoImpl) the moment its native module initializes.
 *
 * The pin forces every androidx.camera artifact to vision-camera's exact compile version, so
 * its runtime matches its compile classpath. expo-camera compiles from source, so it recompiles
 * against 1.5.0-alpha03 — any API incompatibility would fail the build loudly instead of
 * crashing at runtime.
 *
 * Remove this plugin when vision-camera is upgraded to v5+ (CameraX 1.7+, resolving above
 * expo-camera's version) or when expo-camera is dropped.
 */

const { withProjectBuildGradle } = require('expo/config-plugins');

const CAMERAX_VERSION = '1.5.0-alpha03';
const CAMERAX_ARTIFACTS = [
  'camera-core',
  'camera-camera2',
  'camera-lifecycle',
  'camera-video',
  'camera-view',
  'camera-extensions',
  'camera-mlkit-vision',
];

const MARKER = '// [withCameraXVersionPin]';

const GRADLE_BLOCK = `
${MARKER} Managed by plugins/withCameraXVersionPin.js — see that file for the full rationale.
${MARKER} Pins CameraX so react-native-vision-camera (compiled against ${CAMERAX_VERSION}) does not
${MARKER} get expo-camera's CameraX 1.6.0 at runtime (NoClassDefFoundError: Camera2CameraInfoImpl).
allprojects {
  configurations.configureEach {
    resolutionStrategy {
      force(
${CAMERAX_ARTIFACTS.map(
  (artifact) => `        'androidx.camera:${artifact}:${CAMERAX_VERSION}'`
).join(',\n')}
      )
    }
  }
}
`;

module.exports = function withCameraXVersionPin(config) {
  return withProjectBuildGradle(config, (gradleConfig) => {
    if (gradleConfig.modResults.language !== 'groovy') {
      throw new Error('withCameraXVersionPin: expected a Groovy android/build.gradle');
    }

    if (!gradleConfig.modResults.contents.includes(MARKER)) {
      gradleConfig.modResults.contents += GRADLE_BLOCK;
    }

    return gradleConfig;
  });
};
