#!/usr/bin/env node
/* eslint-disable no-undef */

// Draws the link-preview image (Open Graph and Twitter card) once per website language.
//
//   node scripts/generate-seo-images.js [prefix ...]     (default: every website locale)
//   npm run generate-seo-images
//
// Output: public/images/seo/<prefix>.jpg, 1200x630 (git-ignored: it is rebuilt by `npm run web`
// and `npm run build-android-web`, so no picture lives in the history and it can never go stale).
//
// Inputs, all already in the repository:
//   screenshots/google-play/phone/<language>/01-home.png  the Home screen shown in the phone (a
//                                  language without its own capture uses en-US's)
//   lang/locales/<language>/website.json  `website.seo.image`: the headline, the line under it and
//                                  four short items, so the text is translated like the rest of the site
//   assets/phone-wrapper.png       the device frame (the one the website's desktop shell draws);
//                                  its screen is transparent, so the capture goes underneath it
//   assets/fonts/manrope/*.ttf     Manrope (SIL OFL), registered with fontconfig, so the
//                                  result does not depend on which fonts the build machine has
//   lucide-react-native icons      the line icons beside the four items, read from the package
//
// Text is laid out by pango through sharp (`text` inputs: word wrap, Cyrillic, Turkish and Polish
// letters included) and measured, never guessed: when the stack of text is taller than the image the
// whole block shrinks a step at a time until it fits, and below a floor the script stops and names
// the language instead of printing something unreadable.
const fs = require('fs');
const os = require('os');
const path = require('path');

const { WEBSITE_LOCALES } = require('../components/website/localeRoutes');

const ROOT = path.join(__dirname, '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'images', 'seo');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots', 'google-play', 'phone');
const HOME_SCREENSHOT = '01-home.png';
const FALLBACK_LANGUAGE = 'en-US';
const FONT_DIR = path.join(ROOT, 'assets', 'fonts', 'manrope');
const FONTS = {
  bold: { family: 'Manrope ExtraBold', file: path.join(FONT_DIR, 'Manrope-ExtraBold.ttf') },
  regular: { family: 'Manrope SemiBold', file: path.join(FONT_DIR, 'Manrope-SemiBold.ttf') },
};

// Both Manrope weights are made known to fontconfig through a throw-away config that also includes
// the machine's own, set before sharp first draws text (a `fontfile` option holds one file per text
// input, and the second weight was then drawn in a fallback font).
function registerBundledFonts() {
  const config = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'musclog-fonts-')), 'fonts.conf');
  fs.writeFileSync(
    config,
    `<?xml version="1.0"?>\n<!DOCTYPE fontconfig SYSTEM "fonts.dtd">\n<fontconfig>\n` +
      `  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>\n` +
      `  <dir>${FONT_DIR}</dir>\n</fontconfig>\n`
  );
  process.env.FONTCONFIG_FILE = config;
  process.on('exit', () => fs.rmSync(path.dirname(config), { recursive: true, force: true }));
}

registerBundledFonts();
const sharp = require('sharp');

const WIDTH = 1200;
const HEIGHT = 630;
const BACKGROUND = '#ffffff';
const INK = '#0c0f0d';
const MUTED = '#626a66';
const TILE = '#eff1f0';
const ICON_INK = '#1c2420';

// The device frame and its transparent screen, in the frame file's own pixels.
const FRAME_FILE = path.join(ROOT, 'assets', 'phone-wrapper.png');
const FRAME_SIZE = { width: 1438, height: 2976 };
const FRAME_SCREEN = { left: 103, top: 83, width: 1249, height: 2805 };
// Where the frame sits in the image: big, its bottom running off the edge, so the eye lands on the
// top of the Home screen (the day's summary and the two big actions).
const PHONE = { left: 52, top: 24, scale: 0.375 };
// The screen's corner radius in the frame file's pixels (the cut-out is a rounded rectangle).
const FRAME_SCREEN_RADIUS = 150;
// The captures have no status bar; one is drawn above them, as tall as Android's is wide-relative.
const STATUS_BAR_SHARE = 0.068;

const TEXT_LEFT = 668;
const TEXT_RIGHT = WIDTH - 52;
const TEXT_MIN_TOP = 44;
const TEXT_MAX_BOTTOM = HEIGHT - 40;
// Sizes in pixels at scale 1; every block shrinks together.
const SIZES = {
  headline: 42,
  subline: 18,
  itemTitle: 18,
  itemDescription: 15.5,
  tile: 44,
  icon: 22,
};
const GAPS = {
  afterHeadline: 18,
  afterSubline: 34,
  insideItem: 4,
  betweenItems: 26,
  tileToText: 16,
};
const MIN_SCALE = 0.7;
const SCALE_STEP = 0.04;
const ITEM_KEYS = ['workouts', 'food', 'progress', 'privacy'];
// The lucide icon drawn in each item's tile.
const ITEM_ICONS = {
  workouts: 'dumbbell',
  food: 'scan-barcode',
  progress: 'chart-line',
  privacy: 'shield-check',
};
const LUCIDE_ICONS_DIR = path.join(
  ROOT,
  'node_modules',
  'lucide-react-native',
  'dist',
  'esm',
  'icons'
);

function fail(message) {
  throw new Error(`generate-seo-images: ${message}`);
}

function escapeMarkup(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** `lang/locales/<language>/website.json` -> its `website.seo.image` block. */
function imageCopyFor(language, readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))) {
  const file = path.join(ROOT, 'lang', 'locales', language.toLowerCase(), 'website.json');
  return readJson(file)?.website?.seo?.image;
}

/** Names every missing or empty string, so a typo fails here and not as a half-drawn image. */
function copyProblems(copy, language) {
  const problems = [];
  const need = (value, label) => {
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${language}: ${label} is missing or empty`);
    }
  };

  need(copy?.headline, 'seo.image.headline');
  need(copy?.subline, 'seo.image.subline');
  for (const key of ITEM_KEYS) {
    need(copy?.items?.[key]?.title, `seo.image.items.${key}.title`);
    need(copy?.items?.[key]?.description, `seo.image.items.${key}.description`);
  }

  return problems;
}

/** The capture for a language, or the English one when that language has none yet. */
function screenshotFor(language, exists = fs.existsSync) {
  const own = path.join(SCREENSHOTS_DIR, language, HOME_SCREENSHOT);
  return exists(own) ? own : path.join(SCREENSHOTS_DIR, FALLBACK_LANGUAGE, HOME_SCREENSHOT);
}

/** One block of wrapped text as an RGBA buffer, with the size pango actually laid out. */
async function textBlock(text, { font, size, color, width, leading }) {
  const markup = `<span foreground="${color}">${escapeMarkup(text)}</span>`;
  const { data, info } = await sharp({
    text: {
      text: markup,
      rgba: true,
      font: `${font.family} ${size}`,
      width,
      wrap: 'word',
      spacing: Math.round(size * leading),
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { input: data, width: info.width, height: info.height };
}

/**
 * A lucide icon's elements as SVG markup, read from the package's module text (the icon data is a
 * plain list of `[tag, { attributes }]` pairs; the package itself is ESM and React-bound).
 */
function lucideIconMarkup(name, readFile = (file) => fs.readFileSync(file, 'utf8')) {
  const source = readFile(path.join(LUCIDE_ICONS_DIR, `${name}.mjs`));
  const elements = [
    ...source.matchAll(
      /\[\s*"(path|circle|rect|line|polyline|polygon|ellipse)",\s*\{([^}]*)\}\s*\]/g
    ),
  ];
  if (elements.length === 0) {
    fail(`lucide icon "${name}" has no drawable elements`);
  }

  return elements
    .map(([, tag, body]) => {
      const attributes = [...body.matchAll(/(\w+):\s*"([^"]*)"/g)]
        .filter(([, key]) => key !== 'key')
        .map(([, key, value]) => `${key}="${value}"`)
        .join(' ');
      return `<${tag} ${attributes}/>`;
    })
    .join('');
}

/** A rounded tile with the item's icon centred in it, as an SVG buffer. */
function iconTile(name, scale) {
  const size = Math.round(SIZES.tile * scale);
  const icon = SIZES.icon * scale;
  const offset = (size - icon) / 2;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">` +
      `<rect width="${size}" height="${size}" rx="${Math.round(size * 0.24)}" fill="${TILE}"/>` +
      `<g transform="translate(${offset} ${offset}) scale(${icon / 24})" fill="none" stroke="${ICON_INK}" ` +
      `stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${lucideIconMarkup(name)}</g></svg>`
  );
}

/**
 * The headline wrapped to the same number of lines as at full width, but as narrow as that allows,
 * so a short headline does not leave one word alone on its second line.
 */
async function balancedHeadline(text, size, width) {
  const options = { font: FONTS.bold, size, color: INK, leading: 0.06 };
  const full = await textBlock(text, { ...options, width });
  for (let share = 0.5; share < 1; share += 0.05) {
    const block = await textBlock(text, { ...options, width: Math.round(width * share) });
    if (block.height <= full.height) {
      return block;
    }
  }

  return full;
}

/**
 * Lays the text column out at one scale, starting at y = 0. Returns the pieces with their offsets
 * and the column's height; the caller centres it.
 */
async function layoutText(copy, scale) {
  const width = TEXT_RIGHT - TEXT_LEFT;
  const px = (name) => Math.round(SIZES[name] * scale);
  const gap = (name) => Math.round(GAPS[name] * scale);
  const pieces = [];
  let y = 0;

  const headline = await balancedHeadline(copy.headline, px('headline'), width);
  pieces.push({ input: headline.input, left: TEXT_LEFT, top: y });
  y += headline.height + gap('afterHeadline');

  const subline = await textBlock(copy.subline, {
    font: FONTS.regular,
    size: px('subline'),
    color: MUTED,
    width,
    leading: 0.3,
  });
  pieces.push({ input: subline.input, left: TEXT_LEFT, top: y });
  y += subline.height + gap('afterSubline');

  const tile = px('tile');
  const textLeft = TEXT_LEFT + tile + gap('tileToText');
  const textWidth = TEXT_RIGHT - textLeft;
  const rows = [];
  for (const key of ITEM_KEYS) {
    const item = copy.items[key];
    const title = await textBlock(item.title, {
      font: FONTS.bold,
      size: px('itemTitle'),
      color: INK,
      width: textWidth,
      leading: 0.1,
    });
    const description = await textBlock(item.description, {
      font: FONTS.regular,
      size: px('itemDescription'),
      color: MUTED,
      width: textWidth,
      leading: 0.3,
    });
    rows.push({ key, title, description });
  }

  rows.forEach(({ key, title, description }, index) => {
    if (index > 0) {
      y += gap('betweenItems');
    }

    // pango trims each block to its own ink, so the title gets a fixed line box: otherwise a title
    // with no ascender sits closer to its description than one with.
    const titleBox = Math.max(title.height, Math.round(px('itemTitle') * 1.32));
    const textHeight = titleBox + gap('insideItem') + description.height;
    const rowHeight = Math.max(tile, textHeight);
    pieces.push({ input: iconTile(ITEM_ICONS[key], scale), left: TEXT_LEFT, top: y });
    const textTop = y + Math.max(0, Math.round((tile - textHeight) / 2));
    pieces.push({ input: title.input, left: textLeft, top: textTop });
    pieces.push({
      input: description.input,
      left: textLeft,
      top: textTop + titleBox + gap('insideItem'),
    });
    y += rowHeight;
  });

  return { pieces, height: y };
}

/** Shrinks the text column step by step until it fits, then centres it vertically. */
async function fitText(copy, language) {
  const room = TEXT_MAX_BOTTOM - TEXT_MIN_TOP;
  for (let scale = 1; scale >= MIN_SCALE - 1e-9; scale -= SCALE_STEP) {
    const layout = await layoutText(copy, scale);
    if (layout.height <= room) {
      const top = TEXT_MIN_TOP + Math.round((room - layout.height) / 2);
      return {
        scale,
        composites: layout.pieces.map((piece) => ({ ...piece, top: Math.round(piece.top + top) })),
      };
    }
  }

  return fail(
    `${language}: the text does not fit the image even at ${Math.round(MIN_SCALE * 100)}% size; shorten website.seo.image`
  );
}

/** Whether light text reads on this colour (WCAG relative luminance below the midpoint). */
function isDark({ r, g, b }) {
  const channel = (value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b) < 0.18;
}

/** A plain Android-style status bar: the time on the left, signal, Wi-Fi and battery on the right. */
function statusBarSvg(width, height, background) {
  const ink = isDark(background) ? '#f2f4f3' : '#1a1d1b';
  const fill = `rgb(${background.r},${background.g},${background.b})`;
  const mid = height / 2;
  const unit = height / 30;
  const right = width - 18 * unit;
  const battery = `<rect x="${right - 22 * unit}" y="${mid - 6 * unit}" width="20" height="12" rx="3" transform="scale(1)" fill="none" stroke="${ink}" stroke-width="${1.6 * unit}"/>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="${width}" height="${height}" fill="${fill}"/>` +
      `<text x="${22 * unit}" y="${mid + 5 * unit}" font-family="Manrope SemiBold" font-size="${14 * unit}" fill="${ink}">9:41</text>` +
      // Signal: four rising bars.
      [0, 1, 2, 3]
        .map(
          (i) =>
            `<rect x="${right - 70 * unit + i * 4.5 * unit}" y="${mid + (3 - i * 2.6) * unit}" width="${3 * unit}" height="${(3 + i * 2.6) * unit}" rx="${0.8 * unit}" fill="${ink}"/>`
        )
        .join('') +
      // Wi-Fi: a filled quarter fan.
      `<path d="M ${right - 44 * unit} ${mid - 3 * unit} a ${10 * unit} ${10 * unit} 0 0 1 ${16 * unit} 0 l ${-8 * unit} ${9 * unit} z" fill="${ink}"/>` +
      // Battery: a rounded body, its charge, and the terminal.
      battery.replace(
        'width="20" height="12" rx="3" transform="scale(1)"',
        `width="${20 * unit}" height="${12 * unit}" rx="${3 * unit}"`
      ) +
      `<rect x="${right - 20 * unit}" y="${mid - 4 * unit}" width="${12 * unit}" height="${8 * unit}" rx="${1.5 * unit}" fill="${ink}"/>` +
      `<rect x="${right - 1.4 * unit}" y="${mid - 2.5 * unit}" width="${2 * unit}" height="${5 * unit}" rx="${0.8 * unit}" fill="${ink}"/>` +
      `</svg>`
  );
}

/**
 * The phone: the capture (under a drawn status bar, coloured like the capture's top row) placed in
 * the frame's transparent screen, then the frame on top, cut where the image ends.
 */
async function phoneLayers(screenshotFile) {
  const s = PHONE.scale;
  const frameWidth = Math.round(FRAME_SIZE.width * s);
  const frameHeight = Math.round(FRAME_SIZE.height * s);
  // One pixel of overlap on every side, so no white seam shows inside the frame's edge.
  const screen = {
    left: PHONE.left + Math.floor(FRAME_SCREEN.left * s) - 1,
    top: PHONE.top + Math.floor(FRAME_SCREEN.top * s) - 1,
    width: Math.ceil(FRAME_SCREEN.width * s) + 2,
  };
  const visibleScreen = HEIGHT - screen.top;
  const statusHeight = Math.round(screen.width * STATUS_BAR_SHARE);

  const capture = sharp(screenshotFile);
  const { data: topRow } = await capture
    .clone()
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const background = { r: topRow[0], g: topRow[1], b: topRow[2] };
  const shot = await capture
    .clone()
    .resize({ width: screen.width })
    .png()
    .toBuffer({ resolveWithObject: true });
  const shotHeight = Math.min(shot.info.height, visibleScreen - statusHeight);
  const shotCrop = await sharp(shot.data)
    .extract({ left: 0, top: 0, width: screen.width, height: shotHeight })
    .toBuffer();

  // The frame is scaled whole and then cut at the image's bottom edge.
  const frame = await sharp(FRAME_FILE)
    .resize({ width: frameWidth, height: frameHeight })
    .png()
    .toBuffer();
  const frameCrop = await sharp(frame)
    .extract({ left: 0, top: 0, width: frameWidth, height: HEIGHT - PHONE.top })
    .toBuffer();

  // Status bar and capture are joined, then clipped to the screen's rounded corners: the frame's
  // cut-out is rounded but its outline is not opaque past the corners, so a square screen showed.
  const screenHeight = visibleScreen;
  const radius = Math.round(FRAME_SCREEN_RADIUS * s);
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${screen.width}" height="${screenHeight}">` +
      `<rect width="${screen.width}" height="${screenHeight + radius}" rx="${radius}" fill="#fff"/></svg>`
  );
  const screenImage = await sharp({
    create: {
      width: screen.width,
      height: screenHeight,
      channels: 4,
      background: { ...background, alpha: 1 },
    },
  })
    .composite([
      { input: statusBarSvg(screen.width, statusHeight, background), left: 0, top: 0 },
      { input: shotCrop, left: 0, top: statusHeight },
    ])
    .png()
    .toBuffer();
  const roundedScreen = await sharp(screenImage)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  return [
    { input: roundedScreen, left: screen.left, top: screen.top },
    { input: frameCrop, left: PHONE.left, top: PHONE.top },
  ];
}

/** The image for one locale as JPEG bytes. */
async function renderSeoImage({ language, copy, screenshotFile }) {
  const problems = copyProblems(copy, language);
  if (problems.length > 0) {
    fail(problems.join('\n'));
  }

  if (!fs.existsSync(screenshotFile)) {
    fail(`${language}: no Home screenshot at ${path.relative(ROOT, screenshotFile)}`);
  }

  const text = await fitText(copy, language);
  return sharp({
    create: { width: WIDTH, height: HEIGHT, channels: 3, background: BACKGROUND },
  })
    .composite([...(await phoneLayers(screenshotFile)), ...text.composites])
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}

async function main(argv = process.argv.slice(2)) {
  const required = [...Object.values(FONTS).map((font) => font.file), FRAME_FILE];
  for (const file of required) {
    if (!fs.existsSync(file)) {
      fail(`missing ${path.relative(ROOT, file)}`);
    }
  }

  const wanted = argv.length > 0 ? argv : WEBSITE_LOCALES.map((locale) => locale.prefix);
  const unknown = wanted.filter((prefix) => !WEBSITE_LOCALES.some((l) => l.prefix === prefix));
  if (unknown.length > 0) {
    fail(`unknown locale prefix: ${unknown.join(', ')}`);
  }

  // Check every locale's copy before anything is written.
  const jobs = WEBSITE_LOCALES.filter((locale) => wanted.includes(locale.prefix)).map((locale) => ({
    prefix: locale.prefix,
    language: locale.language,
    copy: imageCopyFor(locale.language),
    screenshotFile: screenshotFor(locale.language),
  }));
  const problems = jobs.flatMap((job) => copyProblems(job.copy, job.language));
  if (problems.length > 0) {
    fail(problems.join('\n'));
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const job of jobs) {
    const bytes = await renderSeoImage(job);
    const file = path.join(OUTPUT_DIR, `${job.prefix}.jpg`);
    fs.writeFileSync(file, bytes);
    console.log(
      `[generate-seo-images] ${path.relative(ROOT, file)} (${Math.round(bytes.length / 1024)} KB)`
    );
  }
}

module.exports = {
  HEIGHT,
  ITEM_ICONS,
  ITEM_KEYS,
  WIDTH,
  copyProblems,
  imageCopyFor,
  lucideIconMarkup,
  renderSeoImage,
  screenshotFor,
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
