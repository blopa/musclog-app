import fs from 'fs';
import path from 'path';

import appJson from '../../app.json';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const expo = appJson.expo as any;
const INFO_PLIST = 'ios/MusclogLiftLogRepeat/Info.plist';
const PRIVACY_INFO = 'ios/MusclogLiftLogRepeat/PrivacyInfo.xcprivacy';

/** `<key>NAME</key>\n<string>VALUE</string>` pairs of a plist, enough for usage strings. */
function plistStrings(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const match of xml.matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)) {
    out[match[1]] = match[2];
  }

  return out;
}

function pluginOptions(name: string): Record<string, unknown> | undefined {
  const entry = expo.plugins.find((p: unknown) => Array.isArray(p) && p[0] === name);
  return entry?.[1];
}

/**
 * App Store review: the app-level privacy manifest (ITMS-91053) and the permission purpose
 * strings (Guideline 5.1.1). Both are generated into `ios/` by prebuild from `app.json`, so the
 * rules are pinned on the source and on the committed output.
 */
describe('iOS privacy configuration', () => {
  it('declares an app-level privacy manifest with the required-reason APIs and no tracking', () => {
    const manifest = expo.ios.privacyManifests;

    expect(manifest.NSPrivacyTracking).toBe(false);
    expect(manifest.NSPrivacyTrackingDomains).toEqual([]);
    const categories = manifest.NSPrivacyAccessedAPITypes.map(
      (t: { NSPrivacyAccessedAPIType: string }) => t.NSPrivacyAccessedAPIType
    );
    expect(categories).toEqual(
      expect.arrayContaining([
        'NSPrivacyAccessedAPICategoryUserDefaults',
        'NSPrivacyAccessedAPICategoryFileTimestamp',
        'NSPrivacyAccessedAPICategorySystemBootTime',
        'NSPrivacyAccessedAPICategoryDiskSpace',
      ])
    );
    for (const type of manifest.NSPrivacyCollectedDataTypes) {
      // No account and no ads: nothing is linked to identity or used for tracking.
      expect(type.NSPrivacyCollectedDataTypeLinked).toBe(false);
      expect(type.NSPrivacyCollectedDataTypeTracking).toBe(false);
    }
  });

  it('ships the generated manifest in the committed iOS project', () => {
    const xml = read(PRIVACY_INFO);
    for (const type of expo.ios.privacyManifests.NSPrivacyAccessedAPITypes) {
      expect(xml).toContain(type.NSPrivacyAccessedAPIType);
    }

    expect(read('ios/MusclogLiftLogRepeat.xcodeproj/project.pbxproj')).toContain(
      'PrivacyInfo.xcprivacy in Resources'
    );
  });

  it('explains every permission it asks for, in words a person reads', () => {
    const strings = plistStrings(read(INFO_PLIST));
    const usage = Object.entries(strings).filter(([key]) => key.endsWith('UsageDescription'));

    expect(usage.length).toBeGreaterThan(0);
    for (const [key, text] of usage) {
      // $(BUNDLE_ID) shows "com.werules.logger"; "Allow $(PRODUCT_NAME) to …" states no reason.
      expect({ key, text }).toEqual({ key, text: expect.not.stringContaining('$(BUNDLE_ID)') });
      expect({ key, text }).toEqual({ key, text: expect.not.stringMatching(/^Allow \$\(/) });
    }
  });

  it('keeps the committed strings in step with app.json', () => {
    const strings = plistStrings(read(INFO_PLIST));

    expect(strings.NSCameraUsageDescription).toBe(
      pluginOptions('react-native-vision-camera')?.cameraPermissionText
    );
    expect(strings.NSFaceIDUsageDescription).toBe(
      pluginOptions('expo-local-authentication')?.faceIDPermission
    );
    expect(strings.NSBluetoothAlwaysUsageDescription).toBe(
      pluginOptions('react-native-ble-plx')?.bluetoothAlwaysPermission
    );
    expect(strings.NSFaceIDUsageDescription).toBe(expo.ios.infoPlist.NSFaceIDUsageDescription);
  });

  it('asks for no microphone: the picker picks images and recordings carry no audio', () => {
    expect(pluginOptions('expo-image-picker')?.microphonePermission).toBe(false);
    expect(pluginOptions('react-native-vision-camera')?.enableMicrophonePermission).toBe(false);
    expect(plistStrings(read(INFO_PLIST)).NSMicrophoneUsageDescription).toBeUndefined();
  });
});
