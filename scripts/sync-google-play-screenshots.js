#!/usr/bin/env node
/* eslint-disable no-undef */

// Copies the Google Play captures (`screenshots/google-play/<device>/<screen>.png`, written by
// tests/google-play-screenshots.spec.ts) over the listing images in android/play/metadata/en-US/images.
// Only the files named below are replaced; every other listing image is left alone. Publishing
// them is a separate, deliberate step (`scripts/play.sh up --with-images`).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAPTURES = path.join(ROOT, 'screenshots', 'google-play');
const LISTING = path.join(ROOT, 'android', 'play', 'metadata', 'en-US', 'images');

const DEVICES = {
  'tablet-7': { folder: 'sevenInchScreenshots', width: 768, height: 1024 },
  'tablet-10': { folder: 'tenInchScreenshots', width: 1100, height: 1466 },
};

// device -> [capture name, listing file]
const TARGETS = {
  'tablet-7': [
    ['food', '01.png'],
    ['home', '02.png'],
    ['workout', '03.png'],
    ['goals', '04.png'],
  ],
  'tablet-10': [
    ['home', '02.png'],
    ['goals', '03.png'],
    ['workout', '04.png'],
    ['food', '05.png'],
  ],
};

/** Width and height from a PNG's IHDR chunk. */
function pngSize(file) {
  const header = fs.readFileSync(file).subarray(0, 24);
  if (header.toString('latin1', 1, 4) !== 'PNG') {
    throw new Error(`${file} is not a PNG`);
  }

  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

// Check everything before copying anything, so a failed capture never leaves a half-updated listing.
const plan = [];
for (const [device, targets] of Object.entries(TARGETS)) {
  const { folder, width, height } = DEVICES[device];
  for (const [name, file] of targets) {
    const source = path.join(CAPTURES, device, `${name}.png`);
    if (!fs.existsSync(source)) {
      throw new Error(`Missing capture ${source}; run npm run screenshots:google-play:run`);
    }

    const size = pngSize(source);
    if (size.width !== width || size.height !== height) {
      throw new Error(
        `${source} is ${size.width}x${size.height}, the listing expects ${width}x${height}`
      );
    }

    plan.push([source, path.join(LISTING, folder, file)]);
  }
}

for (const [source, target] of plan) {
  fs.copyFileSync(source, target);
  console.log(`${path.relative(ROOT, source)} -> ${path.relative(ROOT, target)}`);
}
