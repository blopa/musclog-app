/**
 * WHY THIS PLUGIN EXISTS
 *
 * Google Play treats certain permissions as an implied `<uses-feature required="true">`:
 * ACCESS_WIFI_STATE (from @react-native-community/netinfo) implies android.hardware.wifi,
 * CAMERA implies android.hardware.camera and .camera.autofocus, the BLUETOOTH permissions imply
 * android.hardware.bluetooth, and the location permissions imply android.hardware.location(.gps|
 * .network). Play then hides the app from every device without that hardware (some tablets,
 * desktops and Android XR headsets) and blocks the release with "Required hardware feature
 * declarations are restricting your app's availability".
 *
 * Musclog works without every one of them: workouts and manual food logging need none of this
 * hardware. Declaring the feature explicitly with `required="false"` overrides the implied
 * requirement while keeping the permission, so the code that uses the hardware keeps working where
 * it exists. `app.json` has no field for `uses-feature`, hence this plugin.
 *
 * Whether the UI hides the feature on a device that lacks the hardware is a separate piece of work.
 */

const { withAndroidManifest } = require('expo/config-plugins');

const OPTIONAL_FEATURES = [
  'android.hardware.wifi',
  'android.hardware.camera',
  'android.hardware.camera.autofocus',
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',
  'android.hardware.location',
  'android.hardware.location.gps',
  'android.hardware.location.network',
];

function withOptionalHardwareFeatures(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const features = manifest['uses-feature'] ?? [];

    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((feature) => feature.$?.['android:name'] === name);

      if (existing) {
        existing.$['android:required'] = 'false';
      } else {
        features.push({ $: { 'android:name': name, 'android:required': 'false' } });
      }
    }

    manifest['uses-feature'] = features;

    return manifestConfig;
  });
}

module.exports = withOptionalHardwareFeatures;
module.exports.OPTIONAL_FEATURES = OPTIONAL_FEATURES;
