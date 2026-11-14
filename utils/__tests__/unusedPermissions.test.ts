import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative: string) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const UNUSED_PERMISSIONS = [
  'android.permission.READ_CALENDAR',
  'android.permission.WRITE_CALENDAR',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.SYSTEM_ALERT_WINDOW',
  'android.permission.RECORD_AUDIO',
];

const appJson = JSON.parse(read('app.json')).expo;

describe('unused permissions stay undeclared', () => {
  it.each(UNUSED_PERMISSIONS)('%s is blocked in app.json and not requested', (permission) => {
    expect(appJson.android.blockedPermissions).toContain(permission);
    expect(appJson.android.permissions).not.toContain(permission);
  });

  it.each(UNUSED_PERMISSIONS)('%s only appears in the manifest as removed', (permission) => {
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    const lines = manifest.split('\n').filter((line) => line.includes(`"${permission}"`));

    expect(lines.length).toBeGreaterThan(0);
    lines.forEach((line) => expect(line).toContain('tools:node="remove"'));
  });

  it('vision-camera does not request the microphone', () => {
    const plugin = appJson.plugins.find(
      (entry: unknown) => Array.isArray(entry) && entry[0] === 'react-native-vision-camera'
    );

    expect(plugin[1].enableMicrophonePermission).toBe(false);
    expect(plugin[1].microphonePermissionText).toBeUndefined();
  });

  it('does not depend on expo-calendar', () => {
    const pkg = JSON.parse(read('package.json'));

    expect({ ...pkg.dependencies, ...pkg.devDependencies }).not.toHaveProperty('expo-calendar');
  });

  it('declares no calendar, reminders or microphone usage on iOS', () => {
    const plist = read('ios/MusclogLiftLogRepeat/Info.plist');

    expect(plist).not.toMatch(/NSCalendars|NSReminders|NSMicrophoneUsageDescription/);
  });

  it('records the reps video silently', () => {
    const screen = read('app/app/test/reps-recording.tsx');

    expect(screen).not.toContain('useMicrophonePermission');
    expect(screen).not.toContain('audio={true}');
  });
});
