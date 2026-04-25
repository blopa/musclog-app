#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Copies assets/phone-wrapper.png and assets/google-play-qrcode.png
 * → public/musclog-app/images/ so dev and export serve them at /musclog-app/images/...
 * (matches experiments.baseUrl).
 * The public/musclog-app folder is gitignored; run via prestart or before web/export.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const destDir = path.join(root, 'public', 'musclog-app', 'images');

const filesToSync = [
  {
    src: path.join(root, 'assets', 'phone-wrapper.png'),
    dest: path.join(destDir, 'phone-wrapper.png'),
  },
  {
    src: path.join(root, 'assets', 'google-play-qrcode.png'),
    dest: path.join(destDir, 'google-play-qrcode.png'),
  },
  {
    src: path.join(root, 'assets', 'app-screenshot.png'),
    dest: path.join(destDir, 'app-screenshot.png'),
  },
  {
    src: path.join(root, 'assets', 'user-avatar.jpg'),
    dest: path.join(destDir, 'user-avatar.jpg'),
  },
];

function main() {
  fs.mkdirSync(destDir, { recursive: true });

  filesToSync.forEach(({ src, dest }) => {
    if (!fs.existsSync(src)) {
      console.warn('[sync-web-phone-frame] Skip: source not found:', src);
      return;
    }
    fs.copyFileSync(src, dest);
    console.log('[sync-web-phone-frame]', path.relative(root, dest));
  });
}

main();
