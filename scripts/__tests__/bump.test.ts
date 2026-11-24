import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The release script is CommonJS because it runs directly under Node in CI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const {
  assertReleaseVersionsMatch,
  bumpProjectVersions,
  bumpVersion,
  parseBumpRequest,
} = require('../bump');

let projectDir: string;

function writeFixture(relativePath: string, contents: string | object): void {
  const filePath = join(projectDir, relativePath);
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(
    filePath,
    typeof contents === 'string' ? contents : `${JSON.stringify(contents, null, 2)}\n`
  );
}

beforeEach(() => {
  projectDir = mkdtempSync(join(tmpdir(), 'musclog-version-test-'));
  writeFixture('package.json', { name: 'musclog', version: '2.11.2' });
  writeFixture('package-lock.json', {
    name: 'musclog',
    packages: { '': { name: 'musclog', version: '2.11.2' } },
    version: '2.11.2',
  });
  writeFixture('app.json', {
    expo: {
      android: { versionCode: 296 },
      ios: { buildNumber: '296' },
      version: '2.11.2',
    },
  });
  writeFixture(
    'android/app/build.gradle',
    'defaultConfig {\n    versionCode 296\n    versionName "2.11.2"\n}\n'
  );
  writeFixture(
    'ios/MusclogLiftLogRepeat/Info.plist',
    '<key>CFBundleShortVersionString</key>\n<string>2.11.2</string>\n' +
      '<key>CFBundleVersion</key>\n<string>296</string>\n'
  );
});

afterEach(() => {
  rmSync(projectDir, { force: true, recursive: true });
});

it('updates every release version source together', () => {
  expect(bumpProjectVersions(projectDir, 'patch')).toEqual({ build: 297, version: '2.11.3' });
  expect(assertReleaseVersionsMatch(projectDir)).toMatchObject({
    androidBuild: 297,
    androidVersion: '2.11.3',
    appBuild: 297,
    appIosBuild: '297',
    appVersion: '2.11.3',
    iosBuild: '297',
    iosVersion: '2.11.3',
    lockRootVersion: '2.11.3',
    lockVersion: '2.11.3',
    packageVersion: '2.11.3',
  });
  expect(readFileSync(join(projectDir, 'android/app/build.gradle'), 'utf8')).toContain(
    'versionCode 297'
  );
});

it('keeps the widget extension version and build in sync when it exists', () => {
  writeFixture(
    'ios/ExpoWidgetsTarget/Info.plist',
    '<key>CFBundleShortVersionString</key>\n<string>2.11.2</string>\n' +
      '<key>CFBundleVersion</key>\n<string>296</string>\n'
  );
  bumpProjectVersions(projectDir, 'minor');
  const widgetInfo = readFileSync(join(projectDir, 'ios/ExpoWidgetsTarget/Info.plist'), 'utf8');
  expect(widgetInfo).toContain('<string>2.12.0</string>');
  expect(widgetInfo).toContain('<string>297</string>');
});

it('resets the lower parts on a minor or major bump', () => {
  expect(bumpVersion('2.17.8', 'minor')).toBe('2.18.0');
  expect(bumpVersion('2.17.8', 'major')).toBe('3.0.0');
  expect(bumpVersion('2.17.8', 'patch')).toBe('2.17.9');
});

it('sets an exact version and still raises the build number by one', () => {
  expect(bumpProjectVersions(projectDir, { version: '2.14.0' })).toEqual({
    build: 297,
    version: '2.14.0',
  });
  expect(assertReleaseVersionsMatch(projectDir)).toMatchObject({
    androidVersion: '2.14.0',
    appBuild: 297,
    appVersion: '2.14.0',
    iosVersion: '2.14.0',
  });
});

it('refuses an exact version that is malformed or older than the current one', () => {
  expect(() => bumpProjectVersions(projectDir, { version: '2.14' })).toThrow('Invalid version');
  expect(() => bumpProjectVersions(projectDir, { version: '2.11.1' })).toThrow('older than');
});

it('reads --specific from the command line', () => {
  expect(parseBumpRequest(['--specific', '2.18.0'])).toEqual({ version: '2.18.0' });
  expect(parseBumpRequest(['--minor'])).toBe('minor');
  expect(() => parseBumpRequest(['--specific'])).toThrow('--specific needs a version');
  expect(() => parseBumpRequest(['--specific', 'abc'])).toThrow('--specific needs a version');
  expect(() => parseBumpRequest(['--specific', '2.18.0', '--minor'])).toThrow('on its own');
});

it('refuses to bump an already inconsistent project', () => {
  writeFixture(
    'android/app/build.gradle',
    'defaultConfig {\n    versionCode 295\n    versionName "2.11.1"\n}\n'
  );

  expect(() => bumpProjectVersions(projectDir, 'patch')).toThrow('Release version mismatch');
});

it('renames the App Store listing folder to the new version', () => {
  writeFixture('ios/appstore/metadata/version/2.11.2/en-US.json', {});
  bumpProjectVersions(projectDir, 'patch');

  expect(existsSync(join(projectDir, 'ios/appstore/metadata/version/2.11.3/en-US.json'))).toBe(
    true
  );
  expect(existsSync(join(projectDir, 'ios/appstore/metadata/version/2.11.2'))).toBe(false);
});

it('leaves a listing folder named after another version alone', () => {
  writeFixture('ios/appstore/metadata/version/2.6.2/en-US.json', {});
  bumpProjectVersions(projectDir, 'patch');

  expect(existsSync(join(projectDir, 'ios/appstore/metadata/version/2.6.2/en-US.json'))).toBe(true);
});

it('keeps short arrays in app.json on one line after a bump', () => {
  writeFixture(
    'app.json',
    '{\n  "expo": {\n    "android": { "versionCode": 296 },\n' +
      '    "ios": { "buildNumber": "296" },\n' +
      '    "platforms": ["ios", "android", "web"],\n    "version": "2.11.2"\n  }\n}\n'
  );
  bumpProjectVersions(projectDir, 'patch');

  expect(readFileSync(join(projectDir, 'app.json'), 'utf8')).toContain(
    '"platforms": ["ios", "android", "web"]'
  );
});

it('rejects an out-of-sync widget extension Info.plist before bumping', () => {
  writeFixture(
    'ios/ExpoWidgetsTarget/Info.plist',
    '<key>CFBundleShortVersionString</key>\n<string>2.10.0</string>\n' +
      '<key>CFBundleVersion</key>\n<string>296</string>\n'
  );

  expect(() => assertReleaseVersionsMatch(projectDir)).toThrow('Release version mismatch');
  expect(() => bumpProjectVersions(projectDir, 'patch')).toThrow('Release version mismatch');

  writeFixture(
    'ios/ExpoWidgetsTarget/Info.plist',
    '<key>CFBundleShortVersionString</key>\n<string>2.11.2</string>\n' +
      '<key>CFBundleVersion</key>\n<string>295</string>\n'
  );
  expect(() => assertReleaseVersionsMatch(projectDir)).toThrow('Release build-number mismatch');
});

it('rejects invalid app.json version or versionCode', () => {
  writeFixture('app.json', {
    expo: {
      android: { versionCode: 0 },
      ios: { buildNumber: '296' },
      version: '2.11.2',
    },
  });
  expect(() => assertReleaseVersionsMatch(projectDir)).toThrow(
    'Invalid app.json expo.android.versionCode'
  );

  writeFixture('app.json', {
    expo: {
      android: { versionCode: 296 },
      ios: { buildNumber: '296' },
      version: 'bad',
    },
  });
  expect(() => assertReleaseVersionsMatch(projectDir)).toThrow('Invalid app.json expo.version');
});
