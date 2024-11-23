const fs = require('fs');
const path = require('path');
// const { execSync } = require('child_process');

const DIRNAME = __dirname;

function bumpBuildNumber(buildNumber) {
    return (parseInt(buildNumber, 10) + 1).toString();
}

function bumpVersion(version) {
    const versionParts = version.split('.').map(Number);
    versionParts[2] += 1;
    if (versionParts[2] >= 10) {
        versionParts[2] = 0;
        versionParts[1] += 1;
    }
    if (versionParts[1] >= 10) {
        versionParts[1] = 0;
        versionParts[0] += 1;
    }
    return versionParts.join('.');
}

function bumpVersionCode(versionCode) {
    return parseInt(versionCode, 10) + 1;
}

function updateVersion(filePath) {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const oldVersion = data.version || (data.expo && data.expo.version);
    const newVersion = bumpVersion(oldVersion);

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

    fs.writeFileSync(filePath, JSON.stringify(
        data,
        null,
        // isPackLock ? 2 : 4
        2
    ));
    console.log(`${filePath} updated from version ${oldVersion} to ${newVersion}`);
}

const doTask = () => {
    const packageJsonPath = path.resolve(DIRNAME, '..', 'package.json');
    const packageLockJsonPath = path.resolve(DIRNAME, '..', 'package-lock.json');
    const appJsonPath = path.resolve(DIRNAME, '..', 'app.json');

    updateVersion(packageJsonPath);
    updateVersion(packageLockJsonPath);
    updateVersion(appJsonPath);

    // execSync('npm run build-android-preview');
};

doTask();
