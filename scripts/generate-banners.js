#!/usr/bin/env node
/* eslint-disable no-undef */

// Renders the promotional banner once per supported language.
//
//   node scripts/generate-banners.js [locale ...]      (default: every Play locale)
//   npm run generate-banners
//
// Input:
//   assets/banner-background.svg   the artwork (icon, Loggy, phone frame, English copy)
//   assets/banner-copy.json        the headline and the four bullets for each locale
//   screenshots/google-play/phone/<locale>/01-home.png   the home screen shown inside the phone
//                                  (written by `npm run screenshots:google-play-phone:capture`)
// Output: screenshots/banner/<locale>/banner.png, 1920x905.
//
// The artwork is edited by hand, so the script only touches what it has to, found by id:
//   #banner-headline   a <text> holding exactly two <tspan>s (the two headline lines)
//   #banner-bullets    a <g> holding exactly four <text>s (the bullets, each with its own x/y)
//   #phone-screen      a <rect> that marks the phone's screen; it is replaced by the screenshot,
//                      clipped to the same rounded rectangle
// A missing id or a different count is an error, never a silent skip.
//
// Long translations are fitted, not cut: each block is measured with the real renderer and the font
// size drops (letter spacing with it) until its widest line fits beside the phone. Below a floor
// the script stops and names the line instead of printing something unreadable.
//
// Text is drawn by librsvg through sharp, so the font comes from the machine: the SVG asks for
// Manrope and falls back to Noto Sans (which also covers Cyrillic). Install Manrope for the
// designed look.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const BACKGROUND_SVG = path.join(ROOT, 'assets', 'banner-background.svg');
const COPY_JSON = path.join(ROOT, 'assets', 'banner-copy.json');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots', 'google-play', 'phone');
const OUTPUT_DIR = path.join(ROOT, 'screenshots', 'banner');
const HOME_SCREENSHOT = '01-home.png';

// Locales come from the Play listing: the same five the app and the store ship.
const LOCALES = ['en-US', 'es-ES', 'nl-NL', 'pt-BR', 'ru-RU'];
const HEADLINE_LINES = 2;
const BULLET_COUNT = 4;

// Where text must stop, in the SVG's 1920x905 units: the phone frame starts at x=1460.
const TEXT_RIGHT_LIMIT = 1410;
const MIN_HEADLINE_SIZE = 44;
const MIN_BULLET_SIZE = 22;
// The screenshot is shrunk to this width before it is embedded (the screen is about 340 units wide
// in the banner, so this is close to 2x and keeps the SVG a sensible size).
const EMBEDDED_SCREENSHOT_WIDTH = 640;

function fail(message) {
  throw new Error(`generate-banners: ${message}`);
}

function escapeXml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Checks the copy file once, so a typo fails here and not as a half-drawn banner. */
function validateCopy(copy, locales = LOCALES) {
  const problems = [];
  for (const locale of locales) {
    const entry = copy[locale];
    if (!entry) {
      problems.push(`${locale}: no copy`);
      continue;
    }

    const lists = [
      ['headline', HEADLINE_LINES],
      ['bullets', BULLET_COUNT],
    ];
    for (const [key, count] of lists) {
      const list = entry[key];
      if (!Array.isArray(list) || list.length !== count) {
        problems.push(`${locale}.${key}: expected ${count} lines`);
      } else if (list.some((line) => typeof line !== 'string' || line.trim() === '')) {
        problems.push(`${locale}.${key}: empty line`);
      }
    }
  }

  return problems;
}

function readCopy(file = COPY_JSON, locales = LOCALES) {
  const copy = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = validateCopy(copy, locales);
  if (problems.length > 0) {
    fail(`${path.relative(ROOT, file)}:\n  ${problems.join('\n  ')}`);
  }

  return copy;
}

function attribute(tag, name) {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
  return match ? match[1] : null;
}

function findElement(svg, tagName, id) {
  const open = new RegExp(`<${tagName}\\s[^>]*\\bid="${id}"[^>]*>`).exec(svg);
  if (!open) {
    fail(`assets/banner-background.svg has no <${tagName} id="${id}">`);
  }

  const start = open.index;
  const close = svg.indexOf(`</${tagName}>`, start + open[0].length);
  if (close === -1) {
    fail(`<${tagName} id="${id}"> is not closed`);
  }

  const end = close + `</${tagName}>`.length;
  return { start, end, open: open[0], inner: svg.slice(start + open[0].length, close) };
}

function setAttribute(tag, name, value) {
  return tag.replace(new RegExp(`(\\s${name}=")[^"]*(")`), `$1${value}$2`);
}

/** The uppercase text the banner shows; the bullets keep the artwork's leading dot. */
function displayText(text, locale) {
  return text.trim().toLocaleUpperCase(locale);
}

function roundSize(size) {
  return Math.floor(size * 10) / 10;
}

/**
 * Widths are linear in font size when the letter spacing scales with it, so one measurement at the
 * artwork's size says what size fits. `measure(text, size)` returns the drawn width in SVG units.
 */
async function fitFontSize({ lines, baseSize, maxWidth, minSize, measure }) {
  let widest = 0;
  let widestLine = lines[0];
  for (const line of lines) {
    const width = await measure(line, baseSize);
    if (width > widest) {
      widest = width;
      widestLine = line;
    }
  }

  if (widest <= maxWidth) {
    return baseSize;
  }

  const size = roundSize((baseSize * maxWidth) / widest);
  if (size < minSize) {
    fail(`"${widestLine}" needs ${size}px, below the ${minSize}px floor; shorten the copy`);
  }

  return size;
}

function scaledSpacing(spacing, baseSize, size) {
  return Number.parseFloat(((spacing * size) / baseSize).toFixed(3));
}

/** The banner's text blocks as the artwork defines them. */
function readLayout(svg) {
  const headline = findElement(svg, 'text', 'banner-headline');
  const bullets = findElement(svg, 'g', 'banner-bullets');
  const family = /font-family="([^"]*)"/.exec(svg);
  const tspans = [...headline.inner.matchAll(/<tspan\s[^>]*>/g)].map((match) => match[0]);
  const texts = [...bullets.inner.matchAll(/<text\s[^>]*>/g)].map((match) => match[0]);
  if (tspans.length !== HEADLINE_LINES) {
    fail(`#banner-headline needs ${HEADLINE_LINES} <tspan>s, found ${tspans.length}`);
  }

  if (texts.length !== BULLET_COUNT) {
    fail(`#banner-bullets needs ${BULLET_COUNT} <text>s, found ${texts.length}`);
  }

  return {
    headline,
    bullets,
    fontFamily: family ? family[1] : 'sans-serif',
    headlineSize: Number.parseFloat(attribute(headline.open, 'font-size')),
    headlineSpacing: Number.parseFloat(attribute(headline.open, 'letter-spacing') ?? '0'),
    headlineWeight: attribute(headline.open, 'font-weight') ?? '400',
    headlineX: Number.parseFloat(attribute(tspans[0], 'x')),
    bulletSize: Number.parseFloat(attribute(bullets.open, 'font-size')),
    bulletSpacing: Number.parseFloat(attribute(bullets.open, 'letter-spacing') ?? '0'),
    bulletWeight: attribute(bullets.open, 'font-weight') ?? '400',
    bulletX: Number.parseFloat(attribute(texts[0], 'x')),
    tspans,
    texts,
  };
}

/** Draws `text` alone and trims it: the width the renderer really gives it. */
async function measureWithRenderer(text, { family, size, weight, spacing }) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="4000" height="${Math.ceil(size * 2)}">` +
    `<text x="20" y="${Math.ceil(size * 1.4)}" font-family="${family}" font-size="${size}" ` +
    `font-weight="${weight}" letter-spacing="${spacing}" fill="#fff">${escapeXml(text)}</text></svg>`;
  const { info } = await sharp(Buffer.from(svg)).trim().toBuffer({ resolveWithObject: true });
  return info.width;
}

/**
 * Returns the banner's SVG with one locale's copy in place. `measure(text, {family, size, weight,
 * spacing})` defaults to the real renderer; tests pass a fake.
 */
async function applyCopy(svg, entry, locale, measure = measureWithRenderer) {
  const layout = readLayout(svg);
  const headlineLines = entry.headline.map((line) => displayText(line, locale));
  const bulletLines = entry.bullets.map((line) => `• ${displayText(line, locale)}`);

  const headlineSize = await fitFontSize({
    lines: headlineLines,
    baseSize: layout.headlineSize,
    maxWidth: TEXT_RIGHT_LIMIT - layout.headlineX,
    minSize: MIN_HEADLINE_SIZE,
    measure: (text, size) =>
      measure(text, {
        family: layout.fontFamily,
        size,
        weight: layout.headlineWeight,
        spacing: scaledSpacing(layout.headlineSpacing, layout.headlineSize, size),
      }),
  });
  const bulletSize = await fitFontSize({
    lines: bulletLines,
    baseSize: layout.bulletSize,
    maxWidth: TEXT_RIGHT_LIMIT - layout.bulletX,
    minSize: MIN_BULLET_SIZE,
    measure: (text, size) =>
      measure(text, {
        family: layout.fontFamily,
        size,
        weight: layout.bulletWeight,
        spacing: scaledSpacing(layout.bulletSpacing, layout.bulletSize, size),
      }),
  });

  let headlineOpen = setAttribute(layout.headline.open, 'font-size', String(headlineSize));
  headlineOpen = setAttribute(
    headlineOpen,
    'letter-spacing',
    String(scaledSpacing(layout.headlineSpacing, layout.headlineSize, headlineSize))
  );
  const remainingHeadline = [...headlineLines];
  const headlineInner = layout.headline.inner.replace(
    /(<tspan\s[^>]*>)[^<]*(<\/tspan>)/g,
    (_match, open, close) => `${open}${escapeXml(remainingHeadline.shift())}${close}`
  );

  let bulletsOpen = setAttribute(layout.bullets.open, 'font-size', String(bulletSize));
  bulletsOpen = setAttribute(
    bulletsOpen,
    'letter-spacing',
    String(scaledSpacing(layout.bulletSpacing, layout.bulletSize, bulletSize))
  );
  const remainingBullets = [...bulletLines];
  const bulletsInner = layout.bullets.inner.replace(
    /(<text\s[^>]*>)[^<]*(<\/text>)/g,
    (_match, open, close) => `${open}${escapeXml(remainingBullets.shift())}${close}`
  );

  // Replace the later element first so the earlier one's offsets stay valid.
  const blocks = [
    { ...layout.bullets, replacement: `${bulletsOpen}${bulletsInner}</g>` },
    { ...layout.headline, replacement: `${headlineOpen}${headlineInner}</text>` },
  ].sort((a, b) => b.start - a.start);
  let result = svg;
  for (const block of blocks) {
    result = result.slice(0, block.start) + block.replacement + result.slice(block.end);
  }

  return { svg: result, headlineSize, bulletSize };
}

/** Puts the screenshot where the artwork's #phone-screen rectangle is, clipped to its shape. */
function embedScreenshot(svg, dataUri) {
  const match = /<rect\s[^>]*\bid="phone-screen"[^>]*\/>/.exec(svg);
  if (!match) {
    fail('assets/banner-background.svg has no <rect id="phone-screen">');
  }

  const rect = match[0];
  const x = attribute(rect, 'x');
  const y = attribute(rect, 'y');
  const width = attribute(rect, 'width');
  const height = attribute(rect, 'height');
  const radius = attribute(rect, 'rx') ?? '0';
  const replacement =
    `<clipPath id="phone-screen-clip"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" /></clipPath>` +
    `<image x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" ` +
    `clip-path="url(#phone-screen-clip)" href="${dataUri}" />`;
  return svg.replace(rect, () => replacement);
}

/** librsvg sizes a root of width/height 100% from nothing, so give it the viewBox's size. */
function withExplicitSize(svg) {
  const viewBox = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (!viewBox) {
    fail('assets/banner-background.svg has no viewBox');
  }

  const [, , width, height] = viewBox[1].trim().split(/\s+/).map(Number);
  return svg.replace(
    /(<svg\s[^>]*?)\swidth="100%"\s+height="100%"/,
    `$1 width="${width}" height="${height}"`
  );
}

async function screenshotDataUri(file) {
  if (!fs.existsSync(file)) {
    fail(
      `missing ${path.relative(ROOT, file)}; capture it with npm run screenshots:google-play-phone:capture`
    );
  }

  const png = await sharp(file).resize({ width: EMBEDDED_SCREENSHOT_WIDTH }).png().toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}

/**
 * Builds one locale's banner PNG. `options` lets tests point at other files:
 * { background, copy, screenshotsDir, outputDir, measure }.
 */
async function generateBanner(locale, options = {}) {
  const background = options.background ?? BACKGROUND_SVG;
  const copy = options.copy ?? readCopy(options.copyFile ?? COPY_JSON);
  const screenshotsDir = options.screenshotsDir ?? SCREENSHOTS_DIR;
  const outputDir = options.outputDir ?? OUTPUT_DIR;
  const entry = copy[locale];
  if (!entry) {
    fail(`no copy for ${locale}`);
  }

  const source = fs.readFileSync(background, 'utf8');
  const {
    svg: withCopy,
    headlineSize,
    bulletSize,
  } = await applyCopy(source, entry, locale, options.measure);
  const dataUri = await screenshotDataUri(path.join(screenshotsDir, locale, HOME_SCREENSHOT));
  const finalSvg = withExplicitSize(embedScreenshot(withCopy, dataUri));

  const output = path.join(outputDir, locale, 'banner.png');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  await sharp(Buffer.from(finalSvg)).png().toFile(output);
  return { locale, output, headlineSize, bulletSize };
}

async function main(argv) {
  const requested = argv.length > 0 ? argv : LOCALES;
  const unknown = requested.filter((locale) => !LOCALES.includes(locale));
  if (unknown.length > 0) {
    fail(`unknown locale ${unknown.join(', ')} (supported: ${LOCALES.join(', ')})`);
  }

  const copy = readCopy();
  for (const locale of requested) {
    const { output, headlineSize, bulletSize } = await generateBanner(locale, { copy });
    console.log(
      `${locale}: ${path.relative(ROOT, output)} (headline ${headlineSize}px, bullets ${bulletSize}px)`
    );
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

module.exports = {
  BULLET_COUNT,
  HEADLINE_LINES,
  LOCALES,
  applyCopy,
  displayText,
  embedScreenshot,
  fitFontSize,
  generateBanner,
  readCopy,
  validateCopy,
  withExplicitSize,
};
