#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Copies assets/phone-wrapper.png → public/musclog-app/images/phone-wrapper.png
 * so dev and export serve it at /musclog-app/images/... (matches experiments.baseUrl).
 * The public/musclog-app folder is gitignored; run via prestart or before web/export.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'assets', 'phone-wrapper.png');
const destDir = path.join(root, 'public', 'musclog-app', 'images');
const dest = path.join(destDir, 'phone-wrapper.png');

function main() {
  if (!fs.existsSync(src)) {
    console.warn('[sync-web-phone-frame] Skip: source not found:', src);
    process.exit(0);
  }
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[sync-web-phone-frame]', path.relative(root, dest));
}

main();
