const fs = require('fs');
const path = require('path');

const DIRNAME = path.resolve(process.cwd());

function bumpBuildNumber(buildNumber) {
  return (parseInt(buildNumber, 10) + 1).toString();
}

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

  if (hasMajor) {
    return 'major';
  }

  if (hasMinor) {
    return 'minor';
  }

  return 'patch';
}

function bumpVersion(version, bumpType) {
  const versionParts = version.split('.').map((part) => Number.parseInt(part, 10));

  if (versionParts.length !== 3 || versionParts.some(Number.isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }

  if (bumpType === 'major') {
    versionParts[0] += 1;
  } else if (bumpType === 'minor') {
    versionParts[1] += 1;
  } else {
    versionParts[2] += 1;
  }

  return versionParts.join('.');
}

function bumpVersionCode(versionCode) {
  return parseInt(versionCode, 10) + 1;
}

function updateVersion(filePath, bumpType) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const oldVersion = data.version || (data.expo && data.expo.version);
  const newVersion = bumpVersion(oldVersion, bumpType);

  if (data.version) {
    data.version = newVersion;
  } else if (data.expo && data.expo.version) {
    data.expo.version = newVersion;
  }

  if (data.expo) {
    if (data.expo.ios && data.expo.ios.buildNumber) {
      data.expo.ios.buildNumber = bumpBuildNumber(data.expo.ios.buildNumber);
    }

    if (data.expo.android && data.expo.android.versionCode) {
      data.expo.android.versionCode = bumpVersionCode(data.expo.android.versionCode);
    }
  }

  const isPackLock = filePath.endsWith('package-lock.json');
  if (isPackLock && data.packages && data.packages['']) {
    data.packages[''].version = newVersion;
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log(`${path.relative(DIRNAME, filePath)}: ${oldVersion} → ${newVersion}`);
}

const doTask = () => {
  const bumpType = parseBumpType(process.argv.slice(2));
  const packageJsonPath = path.join(DIRNAME, 'package.json');
  const packageLockJsonPath = path.join(DIRNAME, 'package-lock.json');
  const appJsonPath = path.join(DIRNAME, 'app.json');

  updateVersion(packageJsonPath, bumpType);

  if (fs.existsSync(packageLockJsonPath)) {
    updateVersion(packageLockJsonPath, bumpType);
  } else {
    console.log(`${path.relative(DIRNAME, packageLockJsonPath)} not found, skipping`);
  }

  updateVersion(appJsonPath, bumpType);
};

doTask();
