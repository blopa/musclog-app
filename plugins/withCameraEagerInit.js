/**
 * WHY THIS PLUGIN EXISTS
 *
 * expo-camera's useCameraPermissions() hook triggers TurboModule lazy initialization
 * on its first call. In a production build with New Architecture enabled, this first
 * call takes ~10s because:
 *
 *   1. The ExpoCamera TurboModule initializes via JSI on first access.
 *   2. Its constructor internally calls ProcessCameraProvider.getInstance() to set up
 *      CameraX — which is the heavyweight part: it loads the camera HAL, registers
 *      CameraX with the lifecycle, and may trigger MLKit descriptor loading.
 *   3. This initialization competes with every other native module (WatermelonDB,
 *      Health Connect, MLKit-OCR, Sentry) that is also initializing at the same time.
 *
 * This plugin patches MainApplication.kt to invoke ProcessCameraProvider.getInstance()
 * via reflection inside Application.onCreate(). That fires before React Native even
 * starts loading, so CameraX warms up in the background while the JS bundle is being
 * parsed. By the time useCameraPermissions() fires (at boot, via SmartCameraContext),
 * the CameraX heavy-lift is already done and ExpoCamera's TurboModule initialization
 * completes in <100ms instead of ~10s.
 *
 * Reflection is used deliberately: ProcessCameraProvider.getInstance() returns a
 * ListenableFuture, and that type is only a transitive (non-exposed) compile dep of
 * expo-camera — so calling it directly causes "Cannot access class 'ListenableFuture'"
 * at compile time. Reflection sidesteps the classpath issue entirely; the class is
 * always present at runtime via expo-camera's transitive deps.
 *
 * This is especially important for the home-screen widget flow, where the app cold-
 * starts directly into the camera.
 *
 * ANDROID ONLY — iOS uses AVFoundation which initializes differently and does not
 * exhibit the same first-call latency.
 *
 * WHEN CAN THIS BE REMOVED?
 *
 * If React Native ever gains a first-party API for marking TurboModules as eagerly
 * initialized (similar to getEagerInitModuleNames() in some internal builds), or if
 * expo-camera moves the CameraX init out of the module constructor and into a lazy
 * property that only fires when the camera view actually opens, this plugin becomes
 * unnecessary.
 */

const { withMainApplication } = require('@expo/config-plugins');

// Reflection-based pre-warm: no import needed, no extra compile-time deps.
// ProcessCameraProvider is always present at runtime via expo-camera's transitive deps.
const PREWARM_CALL =
  'try { Class.forName("androidx.camera.lifecycle.ProcessCameraProvider")' +
  '.getMethod("getInstance", android.content.Context::class.java)' +
  '.invoke(null, this) } catch (_: Throwable) {}';

module.exports = function withCameraEagerInit(config) {
  return withMainApplication(config, (config) => {
    let { contents } = config.modResults;

    // Idempotency guard — safe to run on every prebuild.
    if (contents.includes(PREWARM_CALL)) {
      return config;
    }

    // Insert the pre-warm call immediately after super.onCreate(), preserving
    // whatever indentation Expo's prebuild uses for that line.
    contents = contents.replace(/^(\s+)(super\.onCreate\(\))/m, (_, indent, call) => {
      return `${indent}${call}\n${indent}${PREWARM_CALL}`;
    });

    config.modResults.contents = contents;
    return config;
  });
};
