#!/usr/bin/env node
/* eslint-disable no-undef */

// Copies the Google Play captures (`screenshots/google-play/<device>/<screen>.png`, written by
// tests/google-play-screenshots.spec.ts) over the listing images in android/play/metadata/en-US/images.
// Every numbered `NN.png` of the two tablet folders is owned by this script: the files named below
// are replaced and any other numbered file there is removed, so the folders hold exactly what a
// command produced (the hand-placed marketing frames that used to sit in sevenInchScreenshots/05 and
// tenInchScreenshots/01 are gone; they were not reproducible). Every other listing image is left
// alone. Publishing them is a separate, deliberate step (`scripts/play.sh up --with-images`).
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
    ['home', '01.png'],
    ['goals', '02.png'],
    ['workout', '03.png'],
    ['food', '04.png'],
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

function sync() {
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

  // A numbered image no target names is a leftover; the folders are this script's alone.
  const wanted = new Set(plan.map(([, target]) => target));
  for (const { folder } of Object.values(DEVICES)) {
    const dir = path.join(LISTING, folder);
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      if (/^\d{2}\.png$/.test(name) && !wanted.has(file)) {
        fs.rmSync(file);
        console.log(`removed ${path.relative(ROOT, file)}`);
      }
    }
  }
}

module.exports = { DEVICES, LISTING, TARGETS, pngSize, sync };

if (require.main === module) {
  sync();
}
