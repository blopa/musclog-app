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

  it('declares the Premium data types: purchase history, the user id and the device id', () => {
    const collected: {
      NSPrivacyCollectedDataType: string;
      NSPrivacyCollectedDataTypePurposes: string[];
    }[] = expo.ios.privacyManifests.NSPrivacyCollectedDataTypes;
    const types = collected.map((type) => type.NSPrivacyCollectedDataType);

    expect(types).toEqual(
      expect.arrayContaining([
        'NSPrivacyCollectedDataTypePurchaseHistory',
        // The RevenueCat app user id is the per-install id made from the device key.
        'NSPrivacyCollectedDataTypeUserID',
        'NSPrivacyCollectedDataTypeDeviceID',
      ])
    );

    // RevenueCat's own App Privacy guidance: purchase history and a custom app user id are used for
    // Analytics (its dashboards) and App Functionality (the entitlement check).
    for (const name of ['PurchaseHistory', 'UserID']) {
      const entry = collected.find(
        (type) => type.NSPrivacyCollectedDataType === `NSPrivacyCollectedDataType${name}`
      );

      expect(entry?.NSPrivacyCollectedDataTypePurposes).toEqual(
        expect.arrayContaining([
          'NSPrivacyCollectedDataTypePurposeAnalytics',
          'NSPrivacyCollectedDataTypePurposeAppFunctionality',
        ])
      );
    }
  });

  it('ships every collected data type of app.json in the committed iOS manifest', () => {
    const xml = read(PRIVACY_INFO);

    for (const type of expo.ios.privacyManifests.NSPrivacyCollectedDataTypes) {
      expect(xml).toContain(type.NSPrivacyCollectedDataType);
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

  it('words the local-network permission for the local AI model, never for the dev launcher', () => {
    // Release builds strip only a description that still says "Expo Dev Launcher", so a real
    // Musclog string is what keeps the local AI model reachable on a home network.
    const text = expo.ios.infoPlist.NSLocalNetworkUsageDescription as string;

    expect(text).toMatch(/^Musclog /);
    expect(text).not.toMatch(/Expo Dev Launcher/i);
    expect(plistStrings(read(INFO_PLIST)).NSLocalNetworkUsageDescription).toBe(text);
  });

  it('declares no remote-push background mode: every notification is scheduled locally', () => {
    expect(pluginOptions('expo-notifications')?.enableBackgroundRemoteNotifications).toBe(false);
    expect(expo.ios.infoPlist.UIBackgroundModes).not.toContain('remote-notification');
    expect(read(INFO_PLIST)).not.toContain('<string>remote-notification</string>');
  });

  it('declares the languages the app ships, so the App Store lists them', () => {
    const declared = (pluginOptions('expo-localization')?.supportedLocales as any)?.ios as string[];
    const shipped = fs
      .readdirSync(path.join(root, 'lang/locales'))
      .filter((d) => d !== 'untranslated.json');
    const base = (tag: string) => tag.toLowerCase().split('-')[0];

    expect(declared.map(base).sort()).toEqual(shipped.map(base).sort());
    const plist = read(INFO_PLIST);
    const block =
      plist.match(/<key>CFBundleLocalizations<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
    expect([...block.matchAll(/<string>([^<]+)<\/string>/g)].map((m) => m[1])).toEqual(declared);
  });
});
