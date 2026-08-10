const fs = require('fs');
const path = require('path');

function parseBumpType(argv) {
  const allowedFlags = new Set(['--major', '--minor']);
  const unknownFlags = argv.filter((arg) => !allowedFlags.has(arg));

  if (unknownFlags.length > 0) {
    throw new Error(`Unknown flag(s): ${unknownFlags.join(', ')}`);
  }

  const hasMajor = argv.includes('--major');
  const hasMinor = argv.includes('--minor');
  if (hasMajor && hasMinor) {
    throw new Error('Use only one of --major or --minor at a time');
  }
  return hasMajor ? 'major' : hasMinor ? 'minor' : 'patch';
}

function bumpVersion(version, bumpType) {
  const parts = version.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some(Number.isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  if (bumpType === 'major') {
    parts[0] += 1;
  } else if (bumpType === 'minor') {
    parts[1] += 1;
  } else {
    parts[2] += 1;
  }
  return parts.join('.');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readRequiredMatch(content, pattern, label) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Could not read ${label}`);
  }
  return match[1];
}

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Could not update ${label}`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

function releasePaths(projectDir) {
  return {
    android: path.join(projectDir, 'android/app/build.gradle'),
    app: path.join(projectDir, 'app.json'),
    ios: path.join(projectDir, 'ios/MusclogLiftLogRepeat/Info.plist'),
    lock: path.join(projectDir, 'package-lock.json'),
    package: path.join(projectDir, 'package.json'),
  };
}

function readReleaseVersions(projectDir) {
  const files = releasePaths(projectDir);
  const app = readJson(files.app);
  const packageJson = readJson(files.package);
  const packageLock = fs.existsSync(files.lock) ? readJson(files.lock) : undefined;
  const android = fs.readFileSync(files.android, 'utf8');
  const ios = fs.readFileSync(files.ios, 'utf8');

  return {
    androidBuild: Number(
      readRequiredMatch(android, /\bversionCode\s+(\d+)/, 'Android versionCode')
    ),
    androidVersion: readRequiredMatch(android, /\bversionName\s+"([^"]+)"/, 'Android versionName'),
    appBuild: Number(app.expo.android.versionCode),
    appIosBuild: String(app.expo.ios.buildNumber),
    appVersion: app.expo.version,
    iosBuild: readRequiredMatch(
      ios,
      /<key>CFBundleVersion<\/key>\s*<string>([^<]+)<\/string>/,
      'iOS CFBundleVersion'
    ),
    iosVersion: readRequiredMatch(
      ios,
      /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/,
      'iOS CFBundleShortVersionString'
    ),
    hasLock: Boolean(packageLock),
    lockRootVersion: packageLock?.packages?.['']?.version,
    lockVersion: packageLock?.version,
    packageVersion: packageJson.version,
  };
}

function assertReleaseVersionsMatch(projectDir) {
  const versions = readReleaseVersions(projectDir);
  const versionValues = [
    versions.packageVersion,
    versions.androidVersion,
    versions.iosVersion,
    ...(versions.hasLock ? [versions.lockVersion, versions.lockRootVersion] : []),
  ];
  const buildValues = [versions.appIosBuild, String(versions.androidBuild), versions.iosBuild];
  if (versionValues.some((version) => version !== versions.appVersion)) {
    throw new Error(`Release version mismatch: ${JSON.stringify(versions)}`);
  }
  if (buildValues.some((build) => build !== String(versions.appBuild))) {
    throw new Error(`Release build-number mismatch: ${JSON.stringify(versions)}`);
  }
  return versions;
}

function bumpProjectVersions(projectDir, bumpType) {
  const current = assertReleaseVersionsMatch(projectDir);
  const files = releasePaths(projectDir);
  const nextVersion = bumpVersion(current.appVersion, bumpType);
  const nextBuild = current.appBuild + 1;
  const packageJson = readJson(files.package);
  const app = readJson(files.app);
  const packageLock = fs.existsSync(files.lock) ? readJson(files.lock) : undefined;

  packageJson.version = nextVersion;
  app.expo.version = nextVersion;
  app.expo.android.versionCode = nextBuild;
  app.expo.ios.buildNumber = String(nextBuild);
  if (packageLock) {
    packageLock.version = nextVersion;
    if (packageLock.packages?.['']) {
      packageLock.packages[''].version = nextVersion;
    }
  }

  let android = fs.readFileSync(files.android, 'utf8');
  android = replaceRequired(
    android,
    /\bversionCode\s+\d+/,
    `versionCode ${nextBuild}`,
    'Android versionCode'
  );
  android = replaceRequired(
    android,
    /\bversionName\s+"[^"]+"/,
    `versionName "${nextVersion}"`,
    'Android versionName'
  );

  let ios = fs.readFileSync(files.ios, 'utf8');
  ios = replaceRequired(
    ios,
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${nextVersion}$2`,
    'iOS CFBundleShortVersionString'
  );
  ios = replaceRequired(
    ios,
    /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${nextBuild}$2`,
    'iOS CFBundleVersion'
  );

  fs.writeFileSync(files.package, `${JSON.stringify(packageJson, null, 2)}\n`);
  fs.writeFileSync(files.app, `${JSON.stringify(app, null, 2)}\n`);
  if (packageLock) {
    fs.writeFileSync(files.lock, `${JSON.stringify(packageLock, null, 2)}\n`);
  }
  fs.writeFileSync(files.android, android);
  fs.writeFileSync(files.ios, ios);
  assertReleaseVersionsMatch(projectDir);
  return { build: nextBuild, version: nextVersion };
}

if (require.main === module) {
  const projectDir = path.resolve(process.cwd());
  const result = bumpProjectVersions(projectDir, parseBumpType(process.argv.slice(2)));
  console.log(`Release: ${result.version} (${result.build})`);
}

module.exports = {
  assertReleaseVersionsMatch,
  bumpProjectVersions,
  bumpVersion,
  parseBumpType,
  readReleaseVersions,
};
