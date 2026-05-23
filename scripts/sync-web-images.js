#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Keeps the ignored `public/musclog-app/images` path as a symlink mirror of the
 * tracked `public/images` tree so dev and export serve the same files at
 * /images/... and /musclog-app/images/... when experiments.baseUrl is set.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const trackedImagesDir = path.join(root, 'public', 'images');
const mirroredImagesDir = path.join(root, 'public', 'musclog-app', 'images');

function main() {
  fs.mkdirSync(path.dirname(mirroredImagesDir), { recursive: true });

  if (fs.existsSync(mirroredImagesDir)) {
    fs.rmSync(mirroredImagesDir, { recursive: true, force: true });
  }

  fs.symlinkSync(
    path.relative(path.dirname(mirroredImagesDir), trackedImagesDir),
    mirroredImagesDir,
    'dir'
  );
  console.log(
    '[sync-web-images]',
    path.relative(root, mirroredImagesDir),
    '->',
    path.relative(path.dirname(mirroredImagesDir), trackedImagesDir)
  );
}

main();
