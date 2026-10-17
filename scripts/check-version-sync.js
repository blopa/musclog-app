#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

const { assertReleaseVersionsMatch } = require('./bump');

const versions = assertReleaseVersionsMatch(path.resolve(process.cwd()));
console.log(`Release versions match: ${versions.appVersion} (${versions.appBuild})`);

const widgetInfo = path.resolve('ios/ExpoWidgetsTarget/Info.plist');
if (fs.existsSync(widgetInfo)) {
  const source = fs.readFileSync(widgetInfo, 'utf8');
  const version = source.match(
    /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/
  )?.[1];
  const build = source.match(/<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
  if (version !== versions.appVersion || build !== String(versions.appBuild)) {
    throw new Error('Widget extension version/build mismatch; regenerate native projects.');
  }
}

const releaseDir = path.resolve(process.cwd(), 'data/whatsNew');
const compare = (a, b) => {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) {
      return left[i] - right[i];
    }
  }

  return 0;
};

const newest = fs.existsSync(releaseDir)
  ? fs
      .readdirSync(releaseDir)
      .filter((name) => /^\d+\.\d+\.\d+\.json$/.test(name))
      .map((name) => name.replace(/\.json$/, ''))
      .sort(compare)
      .at(-1)
  : undefined;
if (newest && compare(newest, versions.appVersion) > 0) {
  console.warn(
    `What's new ${newest} is newer than ${versions.appVersion}: this announcement won't show in this release.`
  );
}
