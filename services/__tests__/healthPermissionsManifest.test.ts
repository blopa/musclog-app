import * as fs from 'fs';
import * as path from 'path';

import { REQUIRED_HEALTH_PERMISSIONS } from '@/services/healthPermissionsShared';

const ROOT = path.resolve(__dirname, '..', '..');

// Record types the cycle tracking sync requests at runtime (`TYPES` in services/cycleHealth.ts,
// not exported), for both read and write.
const CYCLE_RECORD_TYPES = ['MenstruationFlow', 'BasalBodyTemperature', 'IntermenstrualBleeding'];

// Health Connect names a few permissions differently from their record type.
const MANIFEST_NAME_EXCEPTIONS: Record<string, string> = {
  ExerciseSession: 'EXERCISE',
  MenstruationFlow: 'MENSTRUATION',
};

function manifestName(accessType: string, recordType: string): string {
  const suffix =
    MANIFEST_NAME_EXCEPTIONS[recordType] ??
    recordType.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

  return `android.permission.health.${accessType.toUpperCase()}_${suffix}`;
}

const descriptors = [
  ...REQUIRED_HEALTH_PERMISSIONS,
  ...CYCLE_RECORD_TYPES.flatMap((recordType) => [
    { accessType: 'read', recordType },
    { accessType: 'write', recordType },
  ]),
];
const expected = [...new Set(descriptors.map((d) => manifestName(d.accessType, d.recordType)))];

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
const appJsonPermissions: string[] = appJson.expo.android.permissions;
const manifest = fs.readFileSync(
  path.join(ROOT, 'android/app/src/main/AndroidManifest.xml'),
  'utf8'
);

describe('Android Health Connect permissions are declared', () => {
  it.each(expected)('%s is in app.json', (name) => {
    expect(appJsonPermissions).toContain(name);
  });

  it.each(expected)('%s is in AndroidManifest.xml', (name) => {
    expect(manifest).toContain(`<uses-permission android:name="${name}"/>`);
  });
});
