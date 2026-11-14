#!/usr/bin/env node
/* eslint-disable no-undef */

// Builds promo-video/public/ from files the repository already owns, so the video follows the
// store pipeline: re-capture the Play screenshots (npm run screenshots:google-play-phone:capture)
// or the theme shots (npm run screenshots:themes) and the next render picks them up.
//
//   screens/<name>.png  each capture with a status-bar band on top (its own top rows stretched),
//                       so the 3D phone's punch-hole camera sits on plain colour, not the header
//   cards/<name>.png    pieces of a capture that float out of the phones, cut by CARDS below
//   loggy/*.svg         the website's animated Loggy (default theme greens)
//   icon.png            the default theme's app icon
//   backdrop.svg        the Play listing's wave backdrop, panned behind the whole film
//
// Everything in public/ is generated and gitignored. The music (public/music.wav) is written by
// scripts/gen-music.js. Uses the repository's own sharp (resolved from the root node_modules).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PUBLIC = path.join(__dirname, '..', 'public');

const CAPTURES = 'screenshots/google-play/phone/en-US';
// Every capture is drawn at this size; the theme shots (1083 wide) are fitted to it.
const CAPTURE_WIDTH = 1080;
const CAPTURE_HEIGHT = 2340;
// Height of the status-bar band added above each capture (screen textures are 1080x2480).
const STATUS_BAND = 140;

const THEME_IDS = ['depth', 'light', 'shock', 'volt', 'blush', 'scope', 'varia'];

/** Output name (without .png) -> capture, relative to the repository root. */
const SCREENS = {
  '01-home': `${CAPTURES}/01-home.png`,
  '02-workout': `${CAPTURES}/02-workout.png`,
  '03-food-details': `${CAPTURES}/03-food-details.png`,
  '04-food': `${CAPTURES}/04-food.png`,
  '05-progress': `${CAPTURES}/05-progress.png`,
  '06-past-workout': `${CAPTURES}/06-past-workout.png`,
  '07-weekly-review': `${CAPTURES}/07-weekly-review.png`,
  '08-goals': `${CAPTURES}/08-goals.png`,
  ...Object.fromEntries(
    THEME_IDS.map((id) => [
      `theme-kinetic-${id}`,
      `screenshots/themes/musclog-theme-kinetic-${id}.png`,
    ])
  ),
};

/**
 * Card name -> [screen it is cut from, [left, top, right, bottom]] in capture pixels
 * (1080x2340, before the status band). Re-check these when a capture's layout changes.
 */
const CARDS = {
  kcal: ['01-home', [36, 248, 1036, 785]],
  actions: ['01-home', [36, 1045, 1036, 1250]],
  insight: ['02-workout', [40, 395, 1040, 612]],
  setrow: ['02-workout', [30, 1262, 1050, 1800]],
  stepper: ['03-food-details', [40, 200, 1040, 712]],
  breakfast: ['04-food', [36, 255, 1036, 935]],
  weight: ['05-progress', [36, 705, 1036, 2035]],
  muscles: ['06-past-workout', [36, 1225, 1036, 2100]],
  training: ['07-weekly-review', [36, 512, 1036, 1150]],
  records: ['07-weekly-review', [36, 1150, 1036, 1990]],
  target: ['08-goals', [36, 512, 1036, 1320]],
};

const LOGGY_POSES = ['wave', 'lifting', 'reading', 'thinking', 'shrug'];
const LOGGY_DIR = 'public/images/loggy/kinetic-depth';

/** Output file -> source, copied as they are. */
const FILES = {
  'icon.png': 'assets/theme-icons/icon-bg-kinetic-depth.png',
  'backdrop.svg': 'screenshots/google-play/phone-background.svg',
  ...Object.fromEntries(
    LOGGY_POSES.map((pose) => [`loggy/loggy-${pose}.svg`, `${LOGGY_DIR}/loggy-${pose}.svg`])
  ),
};

/** Every file prepare() writes under public/, relative to it. */
const outputs = () => [
  ...Object.keys(SCREENS).map((name) => `screens/${name}.png`),
  ...Object.keys(CARDS).map((name) => `cards/${name}.png`),
  ...Object.keys(FILES),
];

/** Every repository file prepare() reads, relative to the root. */
const sources = () => [...new Set([...Object.values(SCREENS), ...Object.values(FILES)])];

const fitCapture = (sharp, file) =>
  sharp(path.join(ROOT, file))
    .removeAlpha()
    .resize(CAPTURE_WIDTH, CAPTURE_HEIGHT, { fit: 'fill' })
    .png()
    .toBuffer();

async function prepare() {
  const sharp = require('sharp');
  const missing = sources().filter((file) => !fs.existsSync(path.join(ROOT, file)));
  if (missing.length > 0) {
    throw new Error(
      `Missing source files:\n  ${missing.join('\n  ')}\n` +
        'Capture them first (npm run screenshots:google-play-phone:capture, npm run screenshots:themes).'
    );
  }

  for (const dir of ['screens', 'cards', 'loggy']) {
    fs.mkdirSync(path.join(PUBLIC, dir), { recursive: true });
  }

  const captures = {};
  for (const [name, file] of Object.entries(SCREENS)) {
    const capture = await fitCapture(sharp, file);
    captures[name] = capture;
    const band = await sharp(capture)
      .extract({ left: 0, top: 2, width: CAPTURE_WIDTH, height: 4 })
      .resize(CAPTURE_WIDTH, STATUS_BAND, { fit: 'fill' })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: CAPTURE_WIDTH,
        height: CAPTURE_HEIGHT + STATUS_BAND,
        channels: 3,
        background: '#000000',
      },
    })
      .composite([
        { input: band, left: 0, top: 0 },
        { input: capture, left: 0, top: STATUS_BAND },
      ])
      .png()
      .toFile(path.join(PUBLIC, 'screens', `${name}.png`));
  }

  for (const [name, [screen, [left, top, right, bottom]]] of Object.entries(CARDS)) {
    await sharp(captures[screen])
      .extract({ left, top, width: right - left, height: bottom - top })
      .png()
      .toFile(path.join(PUBLIC, 'cards', `${name}.png`));
  }

  for (const [out, file] of Object.entries(FILES)) {
    fs.copyFileSync(path.join(ROOT, file), path.join(PUBLIC, out));
  }

  console.log(`prepared ${outputs().length} files in ${path.relative(ROOT, PUBLIC)}/`);
}

module.exports = {
  CAPTURE_WIDTH,
  CAPTURE_HEIGHT,
  CARDS,
  FILES,
  LOGGY_POSES,
  SCREENS,
  THEME_IDS,
  outputs,
  sources,
};

if (require.main === module) {
  prepare().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
