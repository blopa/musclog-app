#!/usr/bin/env node
/* eslint-disable no-undef */
'use strict';

/**
 * Publishes the animated Loggy SVGs the public website draws, once per theme palette:
 * `assets/avatars/loggy-animated/loggy-<pose>.svg` -> `public/images/loggy/<palette>/loggy-<pose>.svg`,
 * plus `loggy-<pose>-still.svg`, the same file with its animation switched off.
 *
 * The website does not use `components/LoggyPose.tsx`: that component compiles every pose into
 * react-native-svg and reads the app's settings, while a browser plays the CSS keyframes inside
 * these SVGs by itself. Only the poses named in `WEBSITE_POSES` are published: the generated
 * still is 200 KB and `default` alone is 210 KB, so the public bundle ships what a page uses,
 * not the whole set.
 *
 * Each palette gets its own copy because an `<img>` or a CSS background cannot read the page's
 * theme: Loggy's three greens are written into the file (`constants/loggyTheme.js` says what they
 * are in each theme), and a stylesheet (`components/website/websiteLoggyAssets.ts`) chooses the
 * copy for the visitor's theme. Themes drawn in the same greens share one directory, named for the
 * first of them in the registry (`loggyPaletteId`).
 *
 * The copies are generated, never edited: `npm run generate-loggy` runs this after the SVGs are
 * rebuilt, and `components/website/__tests__/websiteLoggy.test.ts` fails when one is stale. The same
 * run writes `components/website/websiteLoggyPoses.json`, the pose set and each pose's `viewBox`
 * size, which `websiteLoggyAssets.ts` reads: the set of poses and their proportions are named here
 * once, not copied into the TypeScript.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  applyLoggyColors,
  loggyColorsForTheme,
  loggyPaletteId,
} = require('../constants/loggyTheme');
const { THEME_IDS } = require('../theme.registry');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'avatars', 'loggy-animated');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'loggy');
const POSES_FILE = path.join(ROOT, 'components', 'website', 'websiteLoggyPoses.json');

/** The poses the website uses, in alphabetical order: each is one spot in `WebsiteLoggy`'s callers. */
const WEBSITE_POSES = ['lifting', 'reading', 'shrug', 'thinking', 'wave'];

/** One directory per distinct palette, named for the first theme that uses it. */
const PALETTE_IDS = [...new Set(THEME_IDS.map(loggyPaletteId))];

/** `loggy-wave.svg` is the animated file; `loggy-wave-still.svg` is the same drawing, not moving. */
function fileName(pose, still = false) {
  return `loggy-${pose}${still ? '-still' : ''}.svg`;
}

/** Where a palette's file is, relative to `OUTPUT_DIR`, with forward slashes. */
function relativeFile(paletteId, pose, still = false) {
  return `${paletteId}/${fileName(pose, still)}`;
}

/**
 * The animated SVG with every animation switched off: each layer opens on the still's own frame,
 * so this is the drawn pose. It is the animated file plus one rule rather than a second drawing
 * (the generated still keeps all fifty faces and is five times the size), so it can never differ
 * from the animation it replaces. A page serves it to a visitor who asked for reduced motion
 * (`websiteLoggyCss`), so that visitor never downloads the animated file at all.
 */
function stillSvg(animatedSvg) {
  const marker = '</style>';
  if (!animatedSvg.includes(marker)) {
    throw new Error('the animated Loggy SVG has no <style> block to hold the still rule');
  }

  return animatedSvg.replace(marker, `\t* { animation: none !important; }\n\t${marker}`);
}

/** The width and height of a pose's `viewBox`, so a page can reserve its box before the file loads. */
function viewBoxSize(pose) {
  const source = fs.readFileSync(path.join(SOURCE_DIR, fileName(pose)), 'utf8');
  const [, , width, height] = (/viewBox="([^"]+)"/.exec(source)?.[1] ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  if (!(width > 0 && height > 0)) {
    throw new Error(`loggy-${pose}.svg has no usable viewBox`);
  }

  return { width, height };
}

/** The contents of `websiteLoggyPoses.json`: every website pose and its `viewBox` size. */
function generatePoses() {
  const poses = Object.fromEntries(WEBSITE_POSES.map((pose) => [pose, viewBoxSize(pose)]));

  return `${JSON.stringify(poses, null, 2)}\n`;
}

/** Every published file's path (relative to `OUTPUT_DIR`) and contents, without writing anything. */
function generateAll() {
  const files = {};

  for (const pose of WEBSITE_POSES) {
    const source = path.join(SOURCE_DIR, fileName(pose));
    if (!fs.existsSync(source)) {
      throw new Error(`${path.relative(ROOT, source)} is missing: run npm run generate-loggy`);
    }

    const artwork = fs.readFileSync(source, 'utf8');

    for (const paletteId of PALETTE_IDS) {
      const animated = applyLoggyColors(artwork, loggyColorsForTheme(paletteId));

      files[relativeFile(paletteId, pose)] = animated;
      files[relativeFile(paletteId, pose, true)] = stillSvg(animated);
    }
  }

  return files;
}

/** Every `.svg` under `directory`, relative to it, with forward slashes. */
function listPublished(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
    .map((entry) =>
      path.relative(directory, path.join(entry.parentPath, entry.name)).split(path.sep).join('/')
    )
    .sort();
}

/** Publishes the website's poses (animated and still, per palette) and removes anything else. */
function syncWebsiteLoggy() {
  const files = generateAll();

  for (const stale of listPublished(OUTPUT_DIR)) {
    if (!(stale in files)) {
      fs.rmSync(path.join(OUTPUT_DIR, stale));
    }
  }

  // A directory a removed palette left behind is empty now.
  for (const entry of fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : []) {
    const directory = path.join(OUTPUT_DIR, entry);

    if (fs.statSync(directory).isDirectory() && fs.readdirSync(directory).length === 0) {
      fs.rmdirSync(directory);
    }
  }

  for (const [relative, contents] of Object.entries(files)) {
    const target = path.join(OUTPUT_DIR, relative);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, contents);
  }

  fs.writeFileSync(POSES_FILE, generatePoses());

  return Object.keys(files).sort();
}

if (require.main === module) {
  const files = syncWebsiteLoggy();
  console.log(`[sync-website-loggy] ${files.length} files -> ${path.relative(ROOT, OUTPUT_DIR)}`);
}

module.exports = {
  OUTPUT_DIR,
  PALETTE_IDS,
  POSES_FILE,
  SOURCE_DIR,
  WEBSITE_POSES,
  fileName,
  generateAll,
  generatePoses,
  listPublished,
  relativeFile,
  stillSvg,
  syncWebsiteLoggy,
};
