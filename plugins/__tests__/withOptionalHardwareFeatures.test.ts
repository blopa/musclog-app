jest.mock('expo/config-plugins', () => ({
  withAndroidManifest: (config: any, action: (c: any) => any) => action(config),
}));

const withOptionalHardwareFeatures = require('../withOptionalHardwareFeatures');

const featuresOf = (result: any) =>
  Object.fromEntries(
    result.modResults.manifest['uses-feature'].map((f: any) => [
      f.$['android:name'],
      f.$['android:required'],
    ])
  );

describe('withOptionalHardwareFeatures', () => {
  it('declares every hardware feature a permission implies as not required', () => {
    const result = withOptionalHardwareFeatures({ modResults: { manifest: {} } });
    const features = featuresOf(result);

    for (const name of [
      'android.hardware.wifi',
      'android.hardware.camera',
      'android.hardware.camera.autofocus',
      'android.hardware.bluetooth',
      'android.hardware.bluetooth_le',
      'android.hardware.location',
      'android.hardware.location.gps',
      'android.hardware.location.network',
    ]) {
      expect(features[name]).toBe('false');
    }
  });

  it('flips an existing required declaration and keeps unrelated features', () => {
    const result = withOptionalHardwareFeatures({
      modResults: {
        manifest: {
          'uses-feature': [
            { $: { 'android:name': 'android.hardware.wifi', 'android:required': 'true' } },
            { $: { 'android:name': 'android.hardware.touchscreen', 'android:required': 'true' } },
            { $: { 'android:name': 'android.hardware.camera' } },
          ],
        },
      },
    });
    const features = featuresOf(result);

    expect(features['android.hardware.wifi']).toBe('false');
    expect(features['android.hardware.camera']).toBe('false');
    expect(features['android.hardware.touchscreen']).toBe('true');
    expect(
      result.modResults.manifest['uses-feature'].filter(
        (f: any) => f.$['android:name'] === 'android.hardware.wifi'
      )
    ).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once = withOptionalHardwareFeatures({ modResults: { manifest: {} } });
    const twice = withOptionalHardwareFeatures(once);

    expect(twice.modResults.manifest['uses-feature']).toHaveLength(
      withOptionalHardwareFeatures.OPTIONAL_FEATURES.length
    );
  });
});
