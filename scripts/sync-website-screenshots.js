#!/usr/bin/env node
/* eslint-disable no-undef */

// Publishes the freshly captured theme screenshots (screenshots/themes/musclog-theme-<id>.png) as
// the WebP files the website and the themes blog post reference. The phone carousel needs no
// step: public/images/phone is a symlink to screenshots/phone.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'screenshots', 'themes');
const TARGETS = [
  (id) => path.join(ROOT, 'public', 'images', 'themes', `${id}.webp`),
  (id) => path.join(ROOT, 'public', 'images', 'blog', '2026', '09', `musclog-theme-${id}.webp`),
];

async function main() {
  const files = fs
    .readdirSync(SOURCE_DIR)
    .map((file) => file.match(/^musclog-theme-(kinetic-[a-z]+)\.png$/))
    .filter(Boolean);

  for (const [file, id] of files) {
    const webp = await sharp(path.join(SOURCE_DIR, file)).webp({ quality: 85 }).toBuffer();
    for (const target of TARGETS) {
      fs.writeFileSync(target(id), webp);
    }

    console.log(`Published ${id}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
