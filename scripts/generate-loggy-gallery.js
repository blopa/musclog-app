/* eslint-disable no-undef */
'use strict';

/**
 * Writes `assets/avatars/index.html`, a page that shows everything Loggy is made of: every pose as
 * a still and animated, every face, every part of the library, the palette, and each theme's
 * greens. Open the file straight from disk; it needs no server and no network.
 *
 * Everything the page draws comes from the same sources and the same composer as the real
 * outputs (`generate-loggy-svgs.js`'s `buildStill`/`buildAnimated` over `loggy-parts/`, and
 * `constants/loggyTheme.js` for the greens), so the page cannot show a Loggy the app does not.
 * The SVG text is embedded as JSON, because a page opened from `file://` may not `fetch` its
 * neighbours. The browser half is `scripts/loggy-gallery/gallery.js` and `gallery.css`, inlined.
 *
 * The page is generated and git-ignored: `npm run generate-loggy` rewrites it after the SVGs, and
 * `npm run generate-loggy-gallery` rewrites only it.
 */

const fs = require('node:fs');
const path = require('node:path');

const {
  FACE_TOKEN,
  buildAnimated,
  buildStill,
  loadLibrary,
  serializeNode,
} = require('./generate-loggy-svgs');
const { LOGGY_CLASSIC, loggyColorsForTheme } = require('../constants/loggyTheme');
const { THEME_DEFINITIONS, THEME_IDS } = require('../theme.registry');

const ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'assets', 'avatars', 'index.html');
const GALLERY_DIR = path.join(__dirname, 'loggy-gallery');
/** Folders of `loggy-parts/` that are not parts. */
const NOT_PARTS = new Set(['animations', 'faces']);

/** The palette classes in file order, each with its declarations and the comment after it. */
function readPaletteEntries(partsDir) {
  const text = fs.readFileSync(path.join(partsDir, 'palette.css'), 'utf8');
  const entries = [];
  const rule = /\.(s\d+)\s*\{([^}]*)\}(?:\s*\/\*\s*([^*]*?)\s*\*\/)?/g;

  for (const [, cls, body, note] of text.matchAll(rule)) {
    const declarations = Object.fromEntries(
      body
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const colon = declaration.indexOf(':');

          return [declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim()];
        })
    );

    entries.push({ cls, fill: declarations.fill ?? '', stroke: declarations.stroke ?? '', note });
  }

  return { text, entries };
}

/** The layer tree of a pose as the page lists it: `{ id, ref?, face?, children? }`. */
function layerTree(layers) {
  return layers.map((layer) => {
    if (layer === FACE_TOKEN) {
      return { id: FACE_TOKEN, face: true };
    }

    if (typeof layer === 'string') {
      return { id: layer.split('/')[0], ref: layer };
    }

    return { id: layer.group, children: layerTree(layer.children) };
  });
}

function partRefs(layers) {
  return layers.flatMap((layer) => {
    if (typeof layer === 'string') {
      return layer === FACE_TOKEN ? [] : [layer];
    }

    return partRefs(layer.children);
  });
}

function themeLabel(id) {
  const name = id.replace(/^kinetic-/, '');

  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Everything the page needs, as plain data. */
function buildGalleryData(library = loadLibrary()) {
  const { manifest, partsDir } = library;
  const palette = readPaletteEntries(partsDir);
  const usedBy = new Map();

  const poses = Object.entries(manifest.poses).map(([name, spec]) => {
    // Only the pose's own face is drawn; the page swaps faces itself, so the 49 hidden copies the
    // real files carry would only make the page heavier.
    const still = buildStill(library, name, { ...spec, alternateFaces: false });
    const animated = buildAnimated(library, name, {
      ...spec,
      animated: { ...spec.animated, alternateFaces: false },
    });
    const refs = partRefs(spec.layers);

    for (const ref of refs) {
      usedBy.set(ref, [...(usedBy.get(ref) ?? []), name]);
    }

    const cssFile = path.join(partsDir, 'animations', `${name}.css`);

    return {
      name,
      viewBox: spec.viewBox,
      face: spec.face,
      alternateFaces: Boolean(spec.alternateFaces),
      upper: spec.animated?.upper ?? [],
      layers: layerTree(spec.layers),
      refs,
      css: fs.readFileSync(cssFile, 'utf8').trim(),
      still,
      animated,
    };
  });

  const partDirs = fs
    .readdirSync(partsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !NOT_PARTS.has(entry.name))
    .map((entry) => entry.name)
    .sort();

  const parts = partDirs.map((id) => ({
    id,
    variants: fs
      .readdirSync(path.join(partsDir, id))
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.replace(/\.svg$/, ''))
      .sort()
      .map((variant) => {
        const ref = `${id}/${variant}`;

        return {
          variant,
          ref,
          markup: serializeNode(library.part(ref), 1),
          usedBy: usedBy.get(ref) ?? [],
        };
      }),
  }));

  const faces = manifest.faceOrder.map((name) => {
    const node = library.face(name);

    return {
      name,
      id: node.id,
      markup: serializeNode(node, 1),
      ownPoses: poses.filter((pose) => pose.face === name).map((pose) => pose.name),
    };
  });

  const themes = THEME_IDS.map((id) => {
    const { mode, palette: colors } = THEME_DEFINITIONS[id];

    return {
      id,
      label: themeLabel(id),
      mode,
      loggy: loggyColorsForTheme(id),
      page: {
        base: colors.surfaceBase,
        card: colors.surfaceCard,
        raised: colors.surfaceRaised,
        border: colors.borderHairline,
        text: colors.textPrimary,
        textSecondary: colors.textSecondary,
        brand: colors.brandPrimary,
      },
    };
  });

  return {
    classic: LOGGY_CLASSIC,
    palette: palette.entries,
    paletteCss: palette.text,
    poses,
    parts,
    faces,
    themes,
  };
}

/** JSON that is safe inside a `<script>` element: no `<` survives, so nothing can close it. */
function scriptSafeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildGalleryHtml(data = buildGalleryData()) {
  const css = fs.readFileSync(path.join(GALLERY_DIR, 'gallery.css'), 'utf8');
  const js = fs.readFileSync(path.join(GALLERY_DIR, 'gallery.js'), 'utf8');

  if (/<\/script/i.test(js) || /<\/style/i.test(css)) {
    throw new Error('scripts/loggy-gallery/ must not contain a closing script or style tag');
  }

  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<title>Loggy: every pose, face and part</title>',
    "<!-- Generated by scripts/generate-loggy-gallery.js. Do not edit: run `npm run generate-loggy-gallery`. Loggy's artwork is public domain (CC0 1.0). -->",
    `<style>${css}</style>`,
    '</head>',
    '<body>',
    '<div id="app"></div>',
    `<script id="loggy-data" type="application/json">${scriptSafeJson(data)}</script>`,
    `<script>${js}</script>`,
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

function main() {
  const html = buildGalleryHtml();

  fs.writeFileSync(OUTPUT_FILE, html);
  console.log(`wrote ${path.relative(ROOT, OUTPUT_FILE)} (${Math.round(html.length / 1024)} KB)`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { OUTPUT_FILE, buildGalleryData, buildGalleryHtml, scriptSafeJson };
