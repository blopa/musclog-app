#!/usr/bin/env node
/* eslint-disable no-undef */

// Copies the freshly captured theme screenshots over the legacy store folders
// (screenshots/app-store/{portrait-6.5,portrait-6.7,main}) so they stay on the same theme.
// Files are matched by screen name because the modal number prefix shifts between runs; legacy
// files with no counterpart in the new set are left untouched.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'screenshots', 'app-store');
const THEME = process.env.MUSCLOG_SCREENSHOT_THEME || 'kinetic-depth';
const TARGETS = [
  ['portrait-6.5', 'portrait-6.5'],
  ['portrait-6.7', 'portrait-6.7'],
  ['main', 'portrait-6.7'],
];

const slug = (file) => file.replace(/^modal-\d+-/, 'modal-');

let copied = 0;
const untouched = [];

for (const [legacyDir, device] of TARGETS) {
  const sourceDir = path.join(ROOT, THEME, device);
  const legacyPath = path.join(ROOT, legacyDir);
  if (!fs.existsSync(sourceDir) || !fs.existsSync(legacyPath)) {
    console.error(`Skipping ${legacyDir}: missing ${sourceDir} or ${legacyPath}`);
    process.exitCode = 1;
    continue;
  }

  const fresh = new Map(fs.readdirSync(sourceDir).map((file) => [slug(file), file]));
  for (const file of fs.readdirSync(legacyPath)) {
    const match = fresh.get(slug(file));
    if (match) {
      fs.copyFileSync(path.join(sourceDir, match), path.join(legacyPath, file));
      copied++;
    } else {
      untouched.push(`${legacyDir}/${file}`);
    }
  }
}

console.log(`Updated ${copied} legacy screenshots from ${THEME}.`);
if (untouched.length) {
  console.log(`No new capture for: ${untouched.join(', ')}`);
}
