#!/usr/bin/env node

const path = require('path');

const { assertReleaseVersionsMatch } = require('./bump');

const versions = assertReleaseVersionsMatch(path.resolve(process.cwd()));
console.log(`Release versions match: ${versions.appVersion} (${versions.appBuild})`);
