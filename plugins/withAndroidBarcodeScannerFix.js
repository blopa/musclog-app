const { withAndroidManifest } = require('@expo/config-plugins');

const withAndroidBarcodeScannerFix = (config) => {
  return withAndroidManifest(config, (config) => {
    const mainApplication = config.modResults.manifest.application[0];

    // Find if the activity already exists to avoid duplicates
    const activities = mainApplication.activity || [];
    const activityName = 'com.google.mlkit.vision.codescanner.internal.GmsBarcodeScanningDelegateActivity';

    const exists = activities.some(activity => activity.$['android:name'] === activityName);

    if (!exists) {
      if (!mainApplication.activity) {
        mainApplication.activity = [];
      }

      mainApplication.activity.push({
        $: {
          'android:name': activityName,
          'android:screenOrientation': 'unspecified',
          'tools:replace': 'android:screenOrientation',
          'tools:node': 'merge',
        },
      });

      // Ensure tools namespace is present in manifest
      if (!config.modResults.manifest.$['xmlns:tools']) {
        config.modResults.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
      }
    }

    return config;
  });
};

module.exports = withAndroidBarcodeScannerFix;
