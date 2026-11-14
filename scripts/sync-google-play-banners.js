#!/usr/bin/env node
/* eslint-disable no-undef */

// Turns the promotional banners (`screenshots/banner/<locale>/banner.png`, 1920x905, written by
// `npm run generate-banners`) into each locale's Play feature graphic,
// `android/play/metadata/<locale>/images/featureGraphic.png`.
//
//   node scripts/sync-google-play-banners.js [locale ...]      (default: every Play locale)
//   npm run generate-banners:sync
//
// Play wants exactly 1024x500 and a PNG without alpha (24-bit) or a JPEG. The banner is a little
// wider (2.12:1 against 2.05:1), so it is scaled to the height and the extra width is trimmed evenly
// from both sides (about 33 source px each; the artwork keeps at least 60 px of margin there)
// instead of stretching the text. Everything is checked before anything is written, so a missing or
// differently sized banner never leaves a half-updated listing.
//
// This only rewrites files under android/play/. Publishing them stays a separate, deliberate step:
// `scripts/play.sh up --with-images` (see docs/GOOGLE_PLAY.md).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const BANNER_DIR = path.join(ROOT, 'screenshots', 'banner');
const LISTING_DIR = path.join(ROOT, 'android', 'play', 'metadata');

// The five Play locales (same list as scripts/generate-banners.js).
const LOCALES = ['en-US', 'es-ES', 'nl-NL', 'pt-BR', 'ru-RU'];
const SOURCE_FILE = 'banner.png';
const TARGET_FILE = 'featureGraphic.png';
const TARGET_WIDTH = 1024;
const TARGET_HEIGHT = 500;
// A source wider or narrower than this share of the target ratio would be cropped hard enough to
// cut artwork, so it is refused rather than trimmed.
const MAX_ASPECT_DRIFT = 0.06;
// Flatten onto the banner's own dark base in case an edge pixel is translucent.
const FLATTEN_BACKGROUND = '#1f4d63';

function fail(message) {
  throw new Error(`sync-google-play-banners: ${message}`);
}

/** Whether a banner of this size can become the feature graphic without cutting artwork. */
function aspectProblem(width, height) {
  const ratio = width / height;
  const target = TARGET_WIDTH / TARGET_HEIGHT;
  const drift = Math.abs(ratio - target) / target;

  return drift > MAX_ASPECT_DRIFT
    ? `${width}x${height} is ${ratio.toFixed(2)}:1, the feature graphic is ${target.toFixed(2)}:1`
    : null;
}

/** The feature graphic for one banner: cover-fit to 1024x500, centred, opaque 24-bit PNG. */
async function renderFeatureGraphic(source) {
  return sharp(source)
    .flatten({ background: FLATTEN_BACKGROUND })
    .resize({ width: TARGET_WIDTH, height: TARGET_HEIGHT, fit: 'cover', position: 'centre' })
    .removeAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/** Reads every requested banner and renders it; throws before the caller writes anything. */
async function planSync(locales, { bannerDir = BANNER_DIR, listingDir = LISTING_DIR } = {}) {
  const unknown = locales.filter((locale) => !LOCALES.includes(locale));
  if (unknown.length > 0) {
    fail(`unknown locale ${unknown.join(', ')} (supported: ${LOCALES.join(', ')})`);
  }

  const plan = [];
  for (const locale of locales) {
    const source = path.join(bannerDir, locale, SOURCE_FILE);
    if (!fs.existsSync(source)) {
      fail(`missing ${source}; run npm run generate-banners ${locale}`);
    }

    const { width, height } = await sharp(source).metadata();
    const problem = aspectProblem(width, height);
    if (problem) {
      fail(`${source}: ${problem}`);
    }

    plan.push({
      locale,
      source,
      target: path.join(listingDir, locale, 'images', TARGET_FILE),
      image: await renderFeatureGraphic(source),
    });
  }

  return plan;
}

async function main(argv) {
  const locales = argv.length > 0 ? argv : LOCALES;
  const plan = await planSync(locales);

  for (const { source, target, image } of plan) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, image);
    console.log(`${path.relative(ROOT, source)} -> ${path.relative(ROOT, target)}`);
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  LOCALES,
  TARGET_HEIGHT,
  TARGET_WIDTH,
  aspectProblem,
  planSync,
  renderFeatureGraphic,
};
