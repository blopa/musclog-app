#!/usr/bin/env node
/* eslint-disable no-undef */

// Composes the Google Play phone screenshots (android/play/metadata/<locale>/images/phoneScreenshots)
// with the Open Screenshot Generator CLI (https://github.com/dotnetdreamer/open-screenshot-generator,
// MIT), which drives that editor headlessly in Chromium.
//
// The design is an Open Screenshot Generator project committed at
// screenshots/google-play/phone.osg.json: one artboard per screenshot, a 3D phone, a headline and a
// subheadline, with every other language as an overlay (`localized`) on the English boards. The
// editor only reads images it is handed, so the committed file names them instead of embedding them:
// any string `musclog:<path>` is a file under screenshots/ (the captures written by
// tests/google-play-phone-screenshots.spec.ts and the backdrop). Before each run they are inlined as
// data URLs into a temporary copy of the project; the fonts are embedded the same way.
//
//   node scripts/google-play-phone-screenshots.js render   writes the listing images
//   node scripts/google-play-phone-screenshots.js studio   opens the editor on the design in a
//                                                          browser window; every edit is saved back
//                                                          into phone.osg.json until it closes
//
// Which CLI runs: the checkout in OSG_DIR (default ../open-screenshot-generator, built with
// `npm install && npm run cli:build`), or, when it has no build, the published package
// open-screenshot-generator@OSG_VERSION through npx. Rendering needs the network: the 3D phone model
// is fetched by the CLI on first use (then cached) and the fonts come from Google Fonts.
const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DESIGN = path.join(ROOT, 'screenshots', 'google-play', 'phone.osg.json');
const LISTING = path.join(ROOT, 'android', 'play', 'metadata');
const REFS_DIR = path.join(ROOT, 'screenshots');
const REF_PREFIX = 'musclog:';
const DEFAULT_OSG_DIR = path.join(ROOT, '..', 'open-screenshot-generator');
// The published version used when there is no built checkout; the design was made with it.
const DEFAULT_OSG_VERSION = '1.0.8';
const FONT_CACHE = path.join(ROOT, 'node_modules', '.cache', 'google-play-phone-screenshots');

// Project locale (the editor's store locale codes) -> Play listing locale.
const PLAY_LOCALES = {
  'en-US': 'en-US',
  'es-ES': 'es-ES',
  'nl-NL': 'nl-NL',
  'pt-BR': 'pt-BR',
  ru: 'ru-RU',
};

// Play's phone screenshot rules: each side 320–3840 px, the long side at most twice the short one.
// 9:16 at 1080 px or more is what makes a listing eligible for promotion.
const PLAY_MIN_SIDE = 320;
const PLAY_MAX_SIDE = 3840;
const PLAY_MAX_RATIO = 2;
const MAX_PHONE_SCREENSHOTS = 8;
// The listing images' width. The 3D phone renders in software WebGL without antialiasing, so the
// design is authored at a multiple of this (2160 wide) and each render is scaled down to it,
// which smooths the phone's edges.
const OUTPUT_WIDTH = 1080;

// An embedded font has no weight range, so each weight is its own family. They are Google Fonts'
// static instances (its v1 CSS API serves static TrueType files), fetched once and cached. The v1
// API sends only the Latin subset unless asked, and the Russian listing needs Cyrillic.
const FONT_SUBSETS = 'latin,latin-ext,cyrillic,cyrillic-ext';
const FONT_SOURCES = {
  'Manrope ExtraBold': { family: 'Manrope', weight: 800 },
  'Manrope SemiBold': { family: 'Manrope', weight: 600 },
};

// The screen of each 3D phone the design may use, in its own pixels, and how far down its front
// camera reaches as a share of the screen height. The captures are a phone screen without a status
// bar, so a capture is fitted to its screen before it is placed: a band copied from its top row
// holds the camera (otherwise the punch hole sits on the app's header), and its sides are copied
// outwards to the screen's proportions instead of being cropped. A device not listed gets the
// capture as it is.
const SCREEN_SHAPES = {
  'pixel-10-pro': { width: 1280, height: 2856, cameraBottom: 0.064 },
};

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function fail(message) {
  console.error(`google-play-phone-screenshots: ${message}`);
  process.exit(1);
}

/** Resolves a path inside `base`, or null when it would leave it. */
function safeJoin(base, relative) {
  const resolved = path.resolve(base, relative);
  return resolved.startsWith(base + path.sep) ? resolved : null;
}

/** The file a `musclog:<path>` reference names, or null when it is not one or leaves screenshots/. */
function refFile(ref) {
  return typeof ref === 'string' && ref.startsWith(REF_PREFIX)
    ? safeJoin(REFS_DIR, ref.slice(REF_PREFIX.length))
    : null;
}

/** Calls `visit(value, key, parent)` for every string in a JSON value; the return replaces it. */
function mapStrings(value, visit, key = null, parent = null) {
  if (typeof value === 'string') {
    return visit(value, key, parent);
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => mapStrings(item, visit, index, value));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [name, mapStrings(item, visit, name, value)])
    );
  }

  return value;
}

function boards(design) {
  return Array.isArray(design.projectData) ? design.projectData : [];
}

/** Every `musclog:` reference in the design, in order. */
function designRefs(design) {
  const refs = [];
  mapStrings(design.projectData ?? [], (value) => {
    if (value.startsWith(REF_PREFIX)) {
      refs.push(value);
    }

    return value;
  });
  return refs;
}

/** The base locale first, then the others, as the editor numbers its exports. */
function designLocales(design) {
  const localization = boards(design)[0]?.localization;
  if (!localization?.baseLocale) {
    return [];
  }

  return [localization.baseLocale, ...(localization.locales ?? []).map((entry) => entry.code)];
}

/** Why this design cannot be rendered faithfully, if it cannot; checked before a browser starts. */
function designProblems(design) {
  const problems = [];
  const list = boards(design);
  if (list.length === 0) {
    problems.push('the design has no artboards');
  }

  if (list.length > MAX_PHONE_SCREENSHOTS) {
    problems.push(`Play takes at most ${MAX_PHONE_SCREENSHOTS} phone screenshots`);
  }

  list.forEach((board, index) => {
    const { width, height } = board.size ?? {};
    if (!(width >= OUTPUT_WIDTH) || !(height > 0)) {
      problems.push(`artboard ${index + 1} must be at least ${OUTPUT_WIDTH} px wide`);
      return;
    }

    const outputHeight = Math.round((height * OUTPUT_WIDTH) / width);
    const short = Math.min(OUTPUT_WIDTH, outputHeight);
    const long = Math.max(OUTPUT_WIDTH, outputHeight);
    if (short < PLAY_MIN_SIDE || long > PLAY_MAX_SIDE || long > short * PLAY_MAX_RATIO) {
      problems.push(
        `artboard ${index + 1} renders at ${OUTPUT_WIDTH}x${outputHeight}, which breaks Play's phone screenshot size rules`
      );
    }
  });

  const locales = designLocales(design);
  if (locales.length === 0) {
    problems.push('the design has no languages (localization.baseLocale)');
  }

  const [base, ...others] = locales;
  for (const locale of locales) {
    if (!PLAY_LOCALES[locale]) {
      problems.push(`language "${locale}" has no Play locale in PLAY_LOCALES`);
    }
  }

  list.forEach((board, index) => {
    for (const element of board.elements ?? []) {
      if (element.type === 'device' && !refFile(element.screenshotSrc)) {
        problems.push(
          `artboard ${index + 1}: phone "${element.id}" shows no capture (musclog:...)`
        );
      }

      for (const locale of others) {
        const override = board.localized?.[locale]?.[element.id];
        if (element.type === 'text' && !override?.content) {
          problems.push(`artboard ${index + 1}: "${element.id}" has no "${locale}" text`);
        }

        if (element.type === 'device' && !override?.screenshotSrc) {
          problems.push(`artboard ${index + 1}: phone "${element.id}" has no "${locale}" capture`);
        }
      }
    }
  });
  if (base && list.some((board) => board.localization?.baseLocale !== base)) {
    problems.push('every artboard must carry the same localization');
  }

  for (const font of design.fonts ?? []) {
    if (!FONT_SOURCES[font.family]) {
      problems.push(`font "${font.family}" has no source in FONT_SOURCES`);
    }
  }

  const missing = designRefs(design).filter((ref) => {
    const file = refFile(ref);
    return !file || !fs.existsSync(file);
  });
  if (missing.length > 0) {
    problems.push(
      `missing files (captures come from npm run screenshots:google-play-phone:capture):\n${missing
        .map((ref) => `  ${ref}`)
        .join('\n')}`
    );
  }

  return problems;
}

/**
 * How many pixels to add to each edge of a `width` x `height` capture so it has `shape`'s
 * proportions with the top band clear of the camera. Sides take what the band leaves over; when the
 * capture is already wider than the screen, the bottom grows instead.
 */
function screenPadding(width, height, shape) {
  const ratio = shape.width / shape.height;
  // The band is a share of the padded height: top = cameraBottom * (height + top).
  const top = Math.ceil((shape.cameraBottom * height) / (1 - shape.cameraBottom));
  const paddedHeight = height + top;
  const sides = Math.round(paddedHeight * ratio) - width;
  if (sides >= 0) {
    const left = Math.floor(sides / 2);
    return { top, bottom: 0, left, right: sides - left };
  }

  return { top, bottom: Math.round(width / ratio) - paddedHeight, left: 0, right: 0 };
}

/** The device elements of a board by id, to know which phone a localized capture belongs to. */
function devicesById(board) {
  return new Map(
    (board.elements ?? [])
      .filter((element) => element.type === 'device')
      .map((element) => [element.id, element])
  );
}

async function captureDataUrl(file, deviceType) {
  const shape = SCREEN_SHAPES[deviceType];
  const sharp = require('sharp');
  const image = sharp(file);
  let bytes;
  if (shape) {
    const { width, height } = await image.metadata();
    bytes = await image
      .extend({ ...screenPadding(width, height, shape), extendWith: 'copy' })
      .png()
      .toBuffer();
  } else {
    bytes = fs.readFileSync(file);
  }

  return `data:image/png;base64,${bytes.toString('base64')}`;
}

function fileDataUrl(file) {
  const mime = MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

function sha256(dataUrl) {
  const payload = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return crypto.createHash('sha256').update(Buffer.from(payload, 'base64')).digest('hex');
}

/**
 * The design with every `musclog:` reference replaced by a data URL. `refsByHash` maps each
 * inlined image's bytes back to its reference, which is how the studio's saves are turned back
 * into the committed form.
 */
async function inlineDesign(design) {
  const urls = new Map();
  const refsByHash = new Map();
  // Resolve each reference once; a capture is padded for the phone that shows it.
  const resolve = async (ref, deviceType) => {
    const id = `${deviceType ?? ''}|${ref}`;
    if (!urls.has(id)) {
      const file = refFile(ref);
      const url = deviceType ? await captureDataUrl(file, deviceType) : fileDataUrl(file);
      urls.set(id, url);
      refsByHash.set(sha256(url), ref);
    }

    return urls.get(id);
  };

  const projectData = [];
  for (const board of boards(design)) {
    const devices = devicesById(board);
    const elements = [];
    for (const element of board.elements ?? []) {
      elements.push(
        await inlineValue(element, element.type === 'device' ? element.deviceType : null, resolve)
      );
    }

    // A localized capture belongs to the phone its override is keyed by.
    const localized = {};
    for (const [locale, overrides] of Object.entries(board.localized ?? {})) {
      localized[locale] = {};
      for (const [id, override] of Object.entries(overrides)) {
        localized[locale][id] = await inlineValue(
          override,
          devices.get(id)?.deviceType ?? null,
          resolve
        );
      }
    }

    projectData.push({
      ...(await inlineValue({ ...board, elements: [], localized: {} }, null, resolve)),
      elements,
      ...(board.localized ? { localized } : {}),
    });
  }

  return { project: { ...design, projectData }, refsByHash };
}

/** Inlines the references in one element or override; `screenshotSrc` is fitted to `deviceType`. */
async function inlineValue(value, deviceType, resolve) {
  const pending = [];
  mapStrings(value, (text, key) => {
    if (refFile(text)) {
      pending.push(resolve(text, key === 'screenshotSrc' ? deviceType : null));
    }

    return text;
  });
  const urls = await Promise.all(pending);
  let next = 0;
  return mapStrings(value, (text) => (refFile(text) ? urls[next++] : text));
}

// The override keys that always apply to a language (src/lib/i18n/project.ts in the editor); any
// other key in an override applies only when the override lists it in `detached`.
const ALWAYS_LOCALIZED = ['content', 'fontFamily', 'screenshotSrc', 'imageSrc', 'mediaId'];

/**
 * The project as `locale` sees it, with that language as its only one: each element takes its
 * override (`hidden` drops it) and the overlay is gone. The CLI renders every language this way, as
 * the base language: switching an 8-board project to another language reloads all eight 3D phones
 * at once, and the first board was captured before its screen arrived (a black phone). The cost is
 * the editor's auto-shrink of overflowing translations, which runs only in the overlay; a
 * translation too long for its box is clipped, so check the renders.
 */
function projectForLocale(project, locale) {
  const projectData = boards(project).map((board) => {
    const overrides = board.localized?.[locale] ?? {};
    const elements = (board.elements ?? [])
      .filter((element) => !overrides[element.id]?.hidden)
      .map((element) => {
        const override = overrides[element.id];
        if (!override) {
          return element;
        }

        const keys = [...ALWAYS_LOCALIZED, ...(override.detached ?? [])];
        const applied = Object.fromEntries(
          keys.filter((key) => override[key] !== undefined).map((key) => [key, override[key]])
        );
        return { ...element, ...applied };
      });
    const { localized, ...rest } = board;
    return { ...rest, elements, localization: { baseLocale: locale, locales: [] } };
  });
  return { ...project, projectData };
}

/**
 * The committed form of a project the editor saved: inlined images back to their references, the
 * embedded font bytes dropped. Returns the design and how many images stayed embedded (an image
 * added in the studio by hand has no reference).
 */
function deinlineProject(project, refsByHash) {
  let embedded = 0;
  const projectData = mapStrings(project.projectData ?? [], (value) => {
    if (!value.startsWith('data:')) {
      return value;
    }

    const ref = refsByHash.get(sha256(value));
    if (ref) {
      return ref;
    }

    embedded += 1;
    return value;
  });
  const { fontData, mediaData, media, ...rest } = project;
  return {
    design: { ...rest, ...(media?.length ? { media, mediaData } : {}), projectData },
    embedded,
  };
}

async function fetchFont(family, weight) {
  fs.mkdirSync(FONT_CACHE, { recursive: true });
  const cached = path.join(
    FONT_CACHE,
    `${family}-${weight}-${FONT_SUBSETS.replace(/,/g, '+')}.ttf`
  );
  if (!fs.existsSync(cached)) {
    // Without a modern browser user agent, the v1 API answers with static TrueType files.
    const css = await fetch(
      `https://fonts.googleapis.com/css?family=${encodeURIComponent(family)}:${weight}&subset=${FONT_SUBSETS}`
    ).then((response) => {
      if (!response.ok) {
        throw new Error(`Google Fonts answered ${response.status} for ${family} ${weight}`);
      }

      return response.text();
    });
    const url = /url\((https:[^)]+)\)/.exec(css)?.[1];
    if (!url) {
      throw new Error(`Google Fonts sent no file for ${family} ${weight}`);
    }

    const bytes = Buffer.from(await fetch(url).then((response) => response.arrayBuffer()));
    fs.writeFileSync(cached, bytes);
  }

  return fs.readFileSync(cached).toString('base64');
}

/** The design's fonts with their bytes, as the CLI restores them before it opens the project. */
async function embedFonts(project) {
  const fontData = {};
  for (const font of project.fonts ?? []) {
    const source = FONT_SOURCES[font.family];
    fontData[font.id] = await fetchFont(source.family, source.weight);
  }

  return { ...project, fontData };
}

function readDesign() {
  if (!fs.existsSync(DESIGN)) {
    fail(`missing ${path.relative(ROOT, DESIGN)}`);
  }

  const design = JSON.parse(fs.readFileSync(DESIGN, 'utf8'));
  const problems = designProblems(design);
  if (problems.length > 0) {
    fail(problems.join('\n'));
  }

  return design;
}

/**
 * How to run the CLI: the checkout in `dir` when it has a build (`cli/dist/cli.js`, plus the editor
 * that `npm run cli:build` packs), else the published package at `version` through npx.
 */
function resolveOsgCommand(dir, version, exists = fs.existsSync) {
  const cli = path.join(dir, 'cli', 'dist', 'cli.js');
  if (exists(cli)) {
    return { command: process.execPath, args: [cli], source: `the checkout at ${dir}` };
  }

  return {
    command: process.platform === 'win32' ? 'npx.cmd' : 'npx',
    args: ['-y', `open-screenshot-generator@${version}`],
    source: `open-screenshot-generator@${version} from npm (no build at ${cli})`,
  };
}

/** The browser to hand the CLI, if this machine says which; otherwise the CLI finds one. */
function browserPath() {
  if (process.env.MUSCLOG_CHROMIUM_PATH) {
    return process.env.MUSCLOG_CHROMIUM_PATH;
  }

  try {
    const playwright = require('@playwright/test').chromium.executablePath();
    return fs.existsSync(playwright) ? playwright : null;
  } catch {
    return null;
  }
}

function osg(args) {
  const runner = resolveOsgCommand(
    path.resolve(process.env.OSG_DIR ?? DEFAULT_OSG_DIR),
    process.env.OSG_VERSION ?? DEFAULT_OSG_VERSION
  );
  const browser = browserPath();
  const full = [...runner.args, ...args, ...(browser ? ['--browser', browser] : [])];
  return { runner, full };
}

/**
 * Where a file of a one-language render goes: the CLI names it `<NN>_<artboard>_..._<W>x<H>.png`
 * (only a multi-language export prefixes the locale). Returns null for a name it does not recognise.
 */
function listingPathFor(filename, locale) {
  const match = /^(\d{2})_.+\.png$/.exec(filename);
  if (!match || !PLAY_LOCALES[locale]) {
    return null;
  }

  return path.join(LISTING, PLAY_LOCALES[locale], 'images', 'phoneScreenshots', `${match[1]}.png`);
}

/**
 * Renders one language (`project` as projectForLocale leaves it) and returns the files the CLI
 * wrote. One run per language also keeps each export inside the CLI's 5-minute browser protocol
 * timeout, which a single call for all 40 images of this size overran.
 */
function renderLocale(project, work, locale) {
  const file = path.join(work, `project-${locale}.json`);
  fs.writeFileSync(file, JSON.stringify(project));
  const out = path.join(work, `out-${locale}`);
  const { full, runner } = osg([
    'render',
    '--project',
    file,
    '--out',
    out,
    '--formats',
    'as-is',
    '--json',
  ]);
  const result = childProcess.spawnSync(runner.command, full, {
    cwd: work,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    fail(
      `the CLI exited with ${result.status ?? result.signal} rendering ${locale}; nothing in the listing changed`
    );
  }

  return JSON.parse(result.stdout).files;
}

/** The inlined design with its fonts, and a scratch folder for the CLI, which runs from there. */
async function prepareProject(design) {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'musclog-osg-'));
  const { project, refsByHash } = await inlineDesign(design);
  return { work, project: await embedFonts(project), refsByHash };
}

async function render() {
  const design = readDesign();
  const locales = designLocales(design);
  const count = boards(design).length;
  const { work, project } = await prepareProject(design);
  console.log(`Rendering with ${osg([]).runner.source}.`);
  const outputs = [];
  for (const locale of locales) {
    for (const written of renderLocale(projectForLocale(project, locale), work, locale)) {
      const target = listingPathFor(written.filename, locale);
      if (!target) {
        fail(`unexpected output ${written.filename}; nothing in the listing changed`);
      }

      outputs.push({ source: written.path, target });
    }
  }

  const targets = new Set(outputs.map((output) => output.target));
  if (targets.size !== count * locales.length) {
    fail(
      `expected ${count * locales.length} screenshots, the CLI wrote ${targets.size}; nothing in the listing changed`
    );
  }

  const sharp = require('sharp');
  const images = [];
  for (const { source, target } of outputs) {
    images.push({
      target,
      png: await sharp(source)
        .resize({ width: OUTPUT_WIDTH, kernel: 'lanczos3' })
        // Play takes JPEG or 24-bit PNG without an alpha channel.
        .flatten({ background: '#000000' })
        .png({ compressionLevel: 9 })
        .toBuffer(),
    });
  }

  // Everything rendered: only now touch the listing, so a failure never leaves it half updated.
  for (const locale of locales) {
    const dir = path.join(LISTING, PLAY_LOCALES[locale], 'images', 'phoneScreenshots');
    fs.mkdirSync(dir, { recursive: true });
    // A shorter set than before must not leave the old tail behind.
    for (const name of fs.readdirSync(dir)) {
      const number = /^(\d{2})\.png$/.exec(name);
      if (number && Number(number[1]) > count) {
        fs.rmSync(path.join(dir, name));
        console.log(`removed ${path.relative(ROOT, path.join(dir, name))}`);
      }
    }
  }

  for (const { target, png } of images) {
    fs.writeFileSync(target, png);
    console.log(`wrote ${path.relative(ROOT, target)}`);
  }

  fs.rmSync(work, { recursive: true, force: true });
}

async function studio() {
  const design = readDesign();
  const { work, project, refsByHash } = await prepareProject(design);
  const file = path.join(work, 'project.json');
  fs.writeFileSync(file, JSON.stringify(project));
  const { runner, full } = osg(['studio', '--project', file]);
  console.log(
    `Editing ${path.relative(ROOT, DESIGN)} with ${runner.source}. Changes are saved as you make ` +
      'them; close the window when done, then run npm run screenshots:google-play-phone:render.'
  );

  let saved = JSON.stringify(design, null, 2);
  const save = () => {
    let project;
    try {
      project = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return; // mid-write; the next poll reads it
    }

    const { design: next, embedded } = deinlineProject(project, refsByHash);
    const text = JSON.stringify(next, null, 2);
    if (text !== saved) {
      fs.writeFileSync(DESIGN, `${text}\n`);
      saved = text;
      console.log(
        `saved ${path.relative(ROOT, DESIGN)}` +
          (embedded > 0
            ? ` (${embedded} image(s) added by hand are embedded; prefer a musclog: capture path)`
            : '')
      );
    }
  };

  // The CLI writes the project back while the window is open and once more when it closes.
  fs.watchFile(file, { interval: 1000 }, save);
  const child = childProcess.spawn(runner.command, full, { cwd: work, stdio: 'inherit' });
  await new Promise((resolve) => child.on('exit', resolve));
  fs.unwatchFile(file);
  save();
  fs.rmSync(work, { recursive: true, force: true });
}

module.exports = {
  DESIGN,
  OUTPUT_WIDTH,
  PLAY_LOCALES,
  SCREEN_SHAPES,
  deinlineProject,
  designLocales,
  designProblems,
  designRefs,
  inlineDesign,
  listingPathFor,
  projectForLocale,
  resolveOsgCommand,
  screenPadding,
};

if (require.main === module) {
  const mode = process.argv[2] ?? 'render';
  const run = { render, studio }[mode];
  if (!run) {
    fail(`unknown mode "${mode}"; use render or studio`);
  }

  run().catch((error) => fail(error.stack ?? error.message));
}
