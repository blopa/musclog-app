#!/usr/bin/env node
/* eslint-disable no-undef */
'use strict';

/**
 * Publishes the animated Loggy SVGs the public website draws as plain `<img>` files:
 * `assets/avatars/loggy-animated/loggy-<pose>.svg` -> `public/images/loggy/loggy-<pose>.svg`,
 * plus `loggy-<pose>-still.svg`, the same file with its animation switched off.
 *
 * The website does not use `components/LoggyPose.tsx`: that component compiles every pose into
 * react-native-svg and reads the app's settings, while a browser plays the CSS keyframes inside
 * these SVGs by itself. Only the poses named in `WEBSITE_POSES` are published: the generated
 * still is 200 KB and `default` alone is 210 KB, so the public bundle ships what a page uses,
 * not the whole set.
 *
 * The copies are generated, never edited: `npm run generate-loggy` runs this after the SVGs are
 * rebuilt, and `components/website/__tests__/websiteLoggy.test.ts` fails when one is stale or when
 * `WEBSITE_LOGGY_POSES` in `WebsiteLoggy.tsx` names a different set.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'avatars', 'loggy-animated');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'loggy');

/** The poses the website uses, in alphabetical order: each is one spot in `WebsiteLoggy`'s callers. */
const WEBSITE_POSES = ['lifting', 'reading', 'shrug', 'thinking', 'wave'];

/** `loggy-wave.svg` is the animated file; `loggy-wave-still.svg` is the same drawing, not moving. */
function fileName(pose, still = false) {
  return `loggy-${pose}${still ? '-still' : ''}.svg`;
}

/**
 * The animated SVG with every animation switched off: each layer opens on the still's own frame,
 * so this is the drawn pose. It is the animated file plus one rule rather than a second drawing
 * (the generated still keeps all fifty faces and is five times the size), so it can never differ
 * from the animation it replaces. A page serves it to a visitor who asked for reduced motion
 * (`<picture>` in `WebsiteLoggy`), so that visitor never downloads the animated file at all.
 */
function stillSvg(animatedSvg) {
  const marker = '</style>';
  if (!animatedSvg.includes(marker)) {
    throw new Error('the animated Loggy SVG has no <style> block to hold the still rule');
  }

  return animatedSvg.replace(marker, `\t* { animation: none !important; }\n\t${marker}`);
}

/** Publishes the website's poses (animated and still) and removes any other `loggy-*.svg`. */
function syncWebsiteLoggy() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const wanted = new Set(WEBSITE_POSES.flatMap((pose) => [fileName(pose), fileName(pose, true)]));
  for (const file of fs.readdirSync(OUTPUT_DIR)) {
    if (/^loggy-.*\.svg$/.test(file) && !wanted.has(file)) {
      fs.rmSync(path.join(OUTPUT_DIR, file));
    }
  }

  for (const pose of WEBSITE_POSES) {
    const source = path.join(SOURCE_DIR, fileName(pose));
    if (!fs.existsSync(source)) {
      throw new Error(`${path.relative(ROOT, source)} is missing: run npm run generate-loggy`);
    }

    const animated = fs.readFileSync(source, 'utf8');
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName(pose)), animated);
    fs.writeFileSync(path.join(OUTPUT_DIR, fileName(pose, true)), stillSvg(animated));
  }

  return [...wanted].sort();
}

if (require.main === module) {
  const files = syncWebsiteLoggy();
  console.log(`[sync-website-loggy] ${files.length} files -> ${path.relative(ROOT, OUTPUT_DIR)}`);
}

module.exports = { OUTPUT_DIR, SOURCE_DIR, WEBSITE_POSES, fileName, stillSvg, syncWebsiteLoggy };
