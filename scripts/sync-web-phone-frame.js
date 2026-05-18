#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Copies static website images into public/ so dev and export serve them at /images/...
 * and /musclog-app/images/... when experiments.baseUrl is set.
 * The public/musclog-app folder is gitignored; run via prestart or before web/export.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const publicImageDirs = [
  path.join(root, 'public', 'images'),
  path.join(root, 'public', 'musclog-app', 'images'),
];

const staticFiles = [
  { src: path.join(root, 'assets', 'phone-wrapper.png'), destName: 'phone-wrapper.png' },
  { src: path.join(root, 'assets', 'download-qrcode.png'), destName: 'download-qrcode.png' },
  { src: path.join(root, 'assets', 'app-screenshot.png'), destName: 'app-screenshot.png' },
  { src: path.join(root, 'assets', 'user-avatar.jpg'), destName: 'user-avatar.jpg' },
];

const screenshotDir = path.join(root, 'screenshots', 'phone');
const screenshotFiles = fs.existsSync(screenshotDir)
  ? fs
      .readdirSync(screenshotDir)
      .filter((file) => file.endsWith('.png'))
      .map((file) => ({
        src: path.join(screenshotDir, file),
        destName: path.join('phone', file),
      }))
  : [];

const filesToSync = staticFiles.concat(screenshotFiles);

function main() {
  publicImageDirs.forEach((dir) => fs.mkdirSync(dir, { recursive: true }));

  filesToSync.forEach(({ src, destName }) => {
    if (!fs.existsSync(src)) {
      console.warn('[sync-web-phone-frame] Skip: source not found:', src);
      return;
    }

    publicImageDirs.forEach((destDir) => {
      const dest = path.join(destDir, destName);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
      console.log('[sync-web-phone-frame]', path.relative(root, dest));
    });
  });
}

main();
