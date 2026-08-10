import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The release script is CommonJS because it runs directly under Node in CI.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { assertReleaseVersionsMatch, bumpProjectVersions } = require('../bump');

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

it('refuses to bump an already inconsistent project', () => {
  writeFixture(
    'android/app/build.gradle',
    'defaultConfig {\n    versionCode 295\n    versionName "2.11.1"\n}\n'
  );

  expect(() => bumpProjectVersions(projectDir, 'patch')).toThrow('Release version mismatch');
});
