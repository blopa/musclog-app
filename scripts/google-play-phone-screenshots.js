#!/usr/bin/env node
/* eslint-disable no-undef */

// Composes the Google Play phone screenshots (android/play/metadata/<locale>/images/phoneScreenshots)
// by driving appscreen (https://github.com/YUZU-Hub/appscreen, a browser app with 3D phone models)
// in Chromium. appscreen has no library or CLI entry point, so this script serves an appscreen
// checkout, loads a project into it and calls the app's own render path for every screenshot and
// language, exactly as its "Export all" does.
//
// The project is a SNAPSHOT in appscreen's own project format, committed at
// screenshots/google-play/phone.appscreen.json. Its images are not embedded: each `src` is a URL
// relative to the local server, `musclog/screenshots/google-play/phone/<locale>/<screen>.png`, the
// real captures written by tests/google-play-phone-screenshots.spec.ts. appscreen loads them with
// `new Image()` and saves `src` back unchanged, so the snapshot stays small and diffable.
//
//   node scripts/google-play-phone-screenshots.js render   writes the listing images
//   node scripts/google-play-phone-screenshots.js studio   opens appscreen on the snapshot in a
//                                                          browser window; every edit is saved back
//                                                          into the snapshot until the window closes
//
// Which appscreen runs: the checkout in APPSCREEN_DIR (default: ../appscreen next to this repo), or,
// when there is none, the hosted copy at APPSCREEN_URL (default https://yuzu-hub.github.io/appscreen/).
// The hosted page cannot reach this repository, so the browser answers its requests for
// `musclog/screenshots/...` from disk (same origin as far as the page can tell, so the canvas is not
// tainted and can still be exported). A hosted copy may be newer than the snapshot; a checkout pins
// the version. Three.js and the headline font load from their CDNs, so rendering needs the network.
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SNAPSHOT = path.join(ROOT, 'screenshots', 'google-play', 'phone.appscreen.json');
const LISTING = path.join(ROOT, 'android', 'play', 'metadata');
const DEFAULT_APPSCREEN_DIR = path.join(ROOT, '..', 'appscreen');
const DEFAULT_APPSCREEN_URL = 'https://yuzu-hub.github.io/appscreen/';
// What the local server exposes of this repository: the captures, nothing else.
const SERVED_REPO_PREFIX = '/musclog/screenshots/';
const SERVED_REPO_DIR = path.join(ROOT, 'screenshots');
const PROJECT_ID = 'musclog-google-play-phone';
const PROJECT_NAME = 'Musclog: Google Play phone';

// appscreen language code -> Play listing locale.
const PLAY_LOCALES = {
  en: 'en-US',
  es: 'es-ES',
  nl: 'nl-NL',
  'pt-br': 'pt-BR',
  ru: 'ru-RU',
};

// Play's phone screenshot rules: each side 320–3840 px, the long side at most twice the short one.
// 9:16 at 1080 px or more is what makes a listing eligible for promotion.
const PLAY_MIN_SIDE = 320;
const PLAY_MAX_SIDE = 3840;
const PLAY_MAX_RATIO = 2;
const MAX_PHONE_SCREENSHOTS = 8;
// The listing images' width. appscreen renders its WebGL phone without antialiasing, so the
// snapshot is authored at a multiple of this (2160 wide) and each render is scaled down to it,
// which smooths the phone's edges.
const OUTPUT_WIDTH = 1080;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.mjs': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.webp': 'image/webp',
};

function fail(message) {
  console.error(`google-play-phone-screenshots: ${message}`);
  process.exit(1);
}

/** Resolves a request path inside `base`, or null when it would leave it. */
function safeJoin(base, requestPath) {
  const resolved = path.resolve(base, `.${requestPath}`);
  return resolved === base || resolved.startsWith(base + path.sep) ? resolved : null;
}

/**
 * Where appscreen comes from: the checkout in `dir` when it holds an index.html, else the hosted
 * copy at `url`. `reason` says why the hosted copy was chosen.
 */
function resolveAppscreenSource(
  dir,
  url,
  hasIndex = (candidate) => fs.existsSync(path.join(candidate, 'index.html'))
) {
  if (hasIndex(dir)) {
    return { kind: 'local', dir };
  }

  return { kind: 'remote', url, reason: `no appscreen checkout at ${dir}` };
}

/** A file under the served `captures` folder for a path that follows its `/musclog/screenshots` prefix. */
function repoFile(pathname) {
  return safeJoin(SERVED_REPO_DIR, pathname.slice(SERVED_REPO_PREFIX.length - 1));
}

/**
 * Makes appscreen reachable and returns its page URL, `close` and whether the browser must serve
 * this repository's files itself (the hosted page cannot reach them).
 */
async function startAppscreen(source) {
  if (source.kind === 'remote') {
    console.log(`Using the hosted appscreen at ${source.url} (${source.reason}).`);
    return { pageUrl: source.url, serveRepo: true, close: () => undefined };
  }

  const server = await startServer(source.dir);
  return {
    pageUrl: `http://127.0.0.1:${server.address().port}/index.html`,
    serveRepo: false,
    close: () => server.close(),
  };
}

function startServer(appscreenDir) {
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = pathname.startsWith(SERVED_REPO_PREFIX)
      ? repoFile(pathname)
      : safeJoin(appscreenDir, pathname === '/' ? '/index.html' : pathname);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(file).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function readSnapshot() {
  if (!fs.existsSync(SNAPSHOT)) {
    fail(`missing ${path.relative(ROOT, SNAPSHOT)}`);
  }

  return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'));
}

/** Every repository file a snapshot loads: each localized image and each graphic element. */
function snapshotSources(snapshot) {
  return snapshot.screenshots.flatMap((screenshot) => [
    ...Object.values(screenshot.localizedImages ?? {}).map((image) => image.src),
    ...(screenshot.elements ?? []).filter((el) => el.type === 'graphic').map((el) => el.src),
  ]);
}

/** The repository file a served `musclog/screenshots/...` URL names, or null. */
function servedFile(src) {
  const prefix = SERVED_REPO_PREFIX.slice(1);
  return src.startsWith(prefix) ? safeJoin(SERVED_REPO_DIR, `/${src.slice(prefix.length)}`) : null;
}

/** Why this snapshot cannot be rendered faithfully, if it cannot; checked before a browser starts. */
function snapshotProblems(snapshot) {
  const problems = [];
  const screenshots = Array.isArray(snapshot.screenshots) ? snapshot.screenshots : [];
  if (screenshots.length === 0) {
    problems.push('the snapshot has no screenshots');
  }

  if (screenshots.length > MAX_PHONE_SCREENSHOTS) {
    problems.push(`Play takes at most ${MAX_PHONE_SCREENSHOTS} phone screenshots`);
  }

  const { outputDevice, customWidth: width, customHeight: height } = snapshot;
  if (outputDevice !== 'custom' || !(width >= OUTPUT_WIDTH) || !(height > 0)) {
    problems.push(`author the snapshot at a custom size at least ${OUTPUT_WIDTH} px wide`);
  } else {
    const outputHeight = Math.round((height * OUTPUT_WIDTH) / width);
    const short = Math.min(OUTPUT_WIDTH, outputHeight);
    const long = Math.max(OUTPUT_WIDTH, outputHeight);
    if (short < PLAY_MIN_SIDE || long > PLAY_MAX_SIDE || long > short * PLAY_MAX_RATIO) {
      problems.push(`${OUTPUT_WIDTH}x${outputHeight} breaks Play's phone screenshot size rules`);
    }
  }

  const languages = snapshot.projectLanguages ?? [];
  for (const lang of languages) {
    if (!PLAY_LOCALES[lang]) {
      problems.push(`language "${lang}" has no Play locale in PLAY_LOCALES`);
    }

    screenshots.forEach((screenshot, index) => {
      if (!screenshot.localizedImages?.[lang]?.src) {
        problems.push(`screenshot ${index + 1} has no "${lang}" image`);
      }

      if (screenshot.text?.headlineEnabled !== false && !screenshot.text?.headlines?.[lang]) {
        problems.push(`screenshot ${index + 1} has no "${lang}" headline`);
      }
    });
  }

  // An uploaded image is embedded as a data URL and needs no file.
  const missing = snapshotSources(snapshot)
    .filter((src) => src && !src.startsWith('data:'))
    .filter((src) => {
      const file = servedFile(src);
      return !file || !fs.existsSync(file);
    });
  if (missing.length > 0) {
    problems.push(
      `missing files (captures come from npm run screenshots:google-play-phone:capture):\n${missing
        .map((src) => `  ${src}`)
        .join('\n')}`
    );
  }

  return problems;
}

function checkSnapshot(snapshot) {
  const problems = snapshotProblems(snapshot);
  if (problems.length > 0) {
    fail(problems.join('\n'));
  }
}

async function launch({ headless }) {
  const { chromium } = require('@playwright/test');
  return chromium.launch({
    headless,
    executablePath: process.env.MUSCLOG_CHROMIUM_PATH || undefined,
    // WebGL in headless Chromium runs on SwiftShader.
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  });
}

/** Answers the hosted page's requests for this repository's captures from disk. */
async function serveRepoInBrowser(page, pageUrl) {
  const base = new URL('.', pageUrl);
  const prefix = `${base.pathname}${SERVED_REPO_PREFIX.slice(1)}`;
  await page.route(
    (url) => url.origin === base.origin && url.pathname.startsWith(prefix),
    (route) => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
      const file = safeJoin(SERVED_REPO_DIR, pathname.slice(prefix.length - 1));
      if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        return route.fulfill({ status: 404, body: 'Not Found' });
      }

      return route.fulfill({
        path: file,
        contentType: MIME_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  );
}

/** Opens appscreen with the snapshot as its current project. */
async function openProject(browser, appscreen, snapshot, viewport) {
  const page = await browser.newPage({ viewport });
  page.on('pageerror', (error) => console.error(`appscreen: ${error.message}`));
  if (appscreen.serveRepo) {
    await serveRepoInBrowser(page, appscreen.pageUrl);
  }

  await page.goto(appscreen.pageUrl);
  await page
    .waitForFunction(() => typeof db !== 'undefined' && db !== null, null, { timeout: 60000 })
    .catch(() => {
      throw new Error(
        `${appscreen.pageUrl} did not become appscreen (no IndexedDB handle "db"). ` +
          'Check the URL, or use a checkout (APPSCREEN_DIR).'
      );
    });

  // Write the project and make it current, the way appscreen's own project switcher does.
  await page.evaluate(
    async ({ record, id, name }) => {
      const tx = db.transaction(['projects', 'meta'], 'readwrite');
      tx.objectStore('projects').put({ ...record, id });
      tx.objectStore('meta').put({
        key: 'projects',
        value: [{ id, name, screenshotCount: record.screenshots.length }],
      });
      tx.objectStore('meta').put({ key: 'currentProject', value: id });
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    },
    { record: snapshot, id: PROJECT_ID, name: PROJECT_NAME }
  );

  await page.reload();
  await page.waitForFunction(
    (count) =>
      typeof state !== 'undefined' &&
      state.screenshots.length === count &&
      state.screenshots.every(Boolean),
    snapshot.screenshots.length,
    { timeout: 120000 }
  );
  return page;
}

/** Loads every Google Font the snapshot's text uses. */
async function loadFonts(page) {
  await page.evaluate(async () => {
    const fonts = new Set();
    for (const screenshot of state.screenshots) {
      fonts.add(screenshot.text?.headlineFont);
      fonts.add(screenshot.text?.subheadlineFont);
    }

    // appscreen stores a Google Font as "'Name', fallback"; system fonts carry no quoted name.
    for (const font of fonts) {
      const name = /'([^']+)'/.exec(font ?? '')?.[1];
      if (name) {
        await loadGoogleFont(name);
      }
    }

    await document.fonts.ready;
  });
}

/** Renders screenshot `index` in `lang` and returns the PNG. */
async function renderScreenshot(page, index, lang) {
  await page.evaluate(
    ({ index, lang }) => {
      state.currentLanguage = lang;
      for (const screenshot of state.screenshots) {
        screenshot.text.currentHeadlineLang = lang;
        screenshot.text.currentSubheadlineLang = lang;
      }

      state.selectedIndex = index;
      // Selecting a screenshot is what initialises Three.js and swaps the phone model.
      syncUIWithState();
    },
    { index, lang }
  );

  const uses3D = await page.evaluate(() => Boolean(getScreenshotSettings().use3D));
  if (uses3D) {
    await page.waitForFunction(
      () =>
        phoneModelLoaded &&
        !phoneModelLoading &&
        currentDeviceModel === (getScreenshotSettings().device3D || 'iphone'),
      null,
      { timeout: 120000 }
    );
  }

  const dataUrl = await page.evaluate(() => {
    const ss = getScreenshotSettings();
    if (ss.use3D && ss.frameColor) {
      setPhoneFrameColor(ss.frameColor, currentDeviceModel);
    }

    updateCanvas();
    return canvas.toDataURL('image/png');
  });
  const sharp = require('sharp');
  return (
    sharp(Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64'))
      .resize({ width: OUTPUT_WIDTH, kernel: 'lanczos3' })
      // Play takes JPEG or 24-bit PNG without an alpha channel.
      .flatten({ background: '#000000' })
      .png({ compressionLevel: 9 })
      .toBuffer()
  );
}

async function render() {
  const snapshot = readSnapshot();
  checkSnapshot(snapshot);
  const appscreen = await startAppscreen(appscreenSource());
  const browser = await launch({ headless: true });
  const outputs = [];
  try {
    const page = await openProject(browser, appscreen, snapshot, { width: 1400, height: 900 });
    await loadFonts(page);
    for (const lang of snapshot.projectLanguages) {
      for (let index = 0; index < snapshot.screenshots.length; index++) {
        const png = await renderScreenshot(page, index, lang);
        const file = path.join(
          LISTING,
          PLAY_LOCALES[lang],
          'images',
          'phoneScreenshots',
          `${String(index + 1).padStart(2, '0')}.png`
        );
        outputs.push({ file, png });
        console.log(`rendered ${path.relative(ROOT, file)}`);
      }
    }
  } finally {
    await browser.close();
    appscreen.close();
  }

  // Everything rendered: only now touch the listing, so a failure never leaves it half updated.
  for (const lang of snapshot.projectLanguages) {
    const dir = path.join(LISTING, PLAY_LOCALES[lang], 'images', 'phoneScreenshots');
    fs.mkdirSync(dir, { recursive: true });
    // A shorter set than before must not leave the old tail behind.
    for (const name of fs.readdirSync(dir)) {
      const number = /^(\d{2})\.png$/.exec(name);
      if (number && Number(number[1]) > snapshot.screenshots.length) {
        fs.rmSync(path.join(dir, name));
        console.log(`removed ${path.relative(ROOT, path.join(dir, name))}`);
      }
    }
  }

  for (const { file, png } of outputs) {
    fs.writeFileSync(file, png);
  }
}

async function studio() {
  const snapshot = readSnapshot();
  checkSnapshot(snapshot);
  const appscreen = await startAppscreen(appscreenSource());
  const browser = await launch({ headless: false });
  const page = await openProject(browser, appscreen, snapshot, null);
  await loadFonts(page);
  console.log(
    `Editing ${path.relative(ROOT, SNAPSHOT)} in appscreen. Changes are saved as you make them; ` +
      'close the window when done, then run npm run screenshots:google-play-phone:render.'
  );

  let saved = JSON.stringify(snapshot, null, 2);
  const save = async () => {
    const record = await page.evaluate(
      (id) =>
        new Promise((resolve) => {
          const request = db.transaction(['projects'], 'readonly').objectStore('projects').get(id);
          request.onsuccess = () => resolve(request.result ?? null);
          request.onerror = () => resolve(null);
        }),
      PROJECT_ID
    );
    if (!record) {
      return;
    }

    delete record.id;
    const next = JSON.stringify(record, null, 2);
    if (next !== saved) {
      fs.writeFileSync(SNAPSHOT, `${next}\n`);
      saved = next;
      const embedded = snapshotSources(record).filter((src) => src?.startsWith('data:'));
      console.log(
        `saved ${path.relative(ROOT, SNAPSHOT)}` +
          (embedded.length > 0
            ? ` (${embedded.length} uploaded image(s) are embedded; prefer a capture path)`
            : '')
      );
    }
  };

  await new Promise((resolve) => {
    const timer = setInterval(() => {
      save().catch(() => undefined);
    }, 1500);
    page.on('close', () => {
      clearInterval(timer);
      resolve();
    });
  });
  await browser.close().catch(() => undefined);
  appscreen.close();
}

/** The appscreen to drive, from APPSCREEN_DIR / APPSCREEN_URL (see the header). */
function appscreenSource() {
  return resolveAppscreenSource(
    path.resolve(process.env.APPSCREEN_DIR ?? DEFAULT_APPSCREEN_DIR),
    process.env.APPSCREEN_URL ?? DEFAULT_APPSCREEN_URL
  );
}

module.exports = {
  OUTPUT_WIDTH,
  PLAY_LOCALES,
  SNAPSHOT,
  resolveAppscreenSource,
  snapshotProblems,
  snapshotSources,
};

if (require.main === module) {
  const mode = process.argv[2] ?? 'render';
  const run = { render, studio }[mode];
  if (!run) {
    fail(`unknown mode "${mode}"; use render or studio`);
  }

  run().catch((error) => fail(error.stack ?? error.message));
}
