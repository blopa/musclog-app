#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Every public page lives under a language prefix (`/en/tools/x`), but an address with no prefix
 * (`/tools/x`, `/blog`, `/`, a search result, a bookmark, a link someone pasted into a chat) must
 * still show the page, not a "taking you to the right page" screen: a link-preview bot reads the
 * HTML at that address and does not run a script, and a visitor should see content at once.
 *
 * The site is static files, so this step runs after the export and copies the finished English
 * page of every public address to its unprefixed twin (`dist/en/tools/x.html` ->
 * `dist/tools/x.html`, `dist/en/index.html` -> `dist/index.html` and `dist/home.html`). The copy
 * keeps its canonical and `hreflang` set pointing at the `/en/…` URL, so search engines fold the
 * duplicate onto it, and it gets ONE inline script as the first thing in `<head>` that settles the
 * address before the app's bundle boots (the router reads `location` while it hydrates, so this is
 * not cosmetic):
 *
 * - no stored language, or English: `history.replaceState` to the `/en/…` URL, in place, no reload;
 *   the English HTML and the router then agree and hydration is normal;
 * - a stored non-English language (`musclog_lang` in `localStorage`, written by the language
 *   picker): `location.replace` to that language's own static page. It cannot be patched in place,
 *   because the copy is English HTML and a Spanish first render would not match it.
 *
 * Query and hash are kept either way. A page with no translation (the blog) has no language table
 * and always lands on `/en/…`. Never overwrites an existing file except the export's own
 * `index.html` (the bare `/`); a missing English source or any other collision is an error.
 * `/open`, `/test` and `/app` get no copy.
 */
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_LOCALE_PREFIX,
  LANGUAGE_STORAGE_KEY,
  WEBSITE_LOCALES,
  legacyForwardPath,
  localePrefixesFor,
  localizedPath,
} = require('../components/website/localeRoutes');
const { sitemapLogicalPaths } = require('./generate-web-seo-files');

/** The language picker's storage key (shared with `WebsitePreferences.tsx`); the only language readable pre-boot. */
const STORED_LANGUAGE_KEY = LANGUAGE_STORAGE_KEY;
const SCRIPT_ID = 'musclog-unprefixed';

/** `{ 'es-es': '/es/tools/x', … }`: the non-English pages this logical path is published in. */
function languageTargets(logicalPath) {
  const available = localePrefixesFor(logicalPath);
  const targets = {};

  for (const locale of WEBSITE_LOCALES) {
    if (locale.prefix !== DEFAULT_LOCALE_PREFIX && available.includes(locale.prefix)) {
      targets[locale.language.toLowerCase()] = localizedPath(logicalPath, locale.prefix);
    }
  }

  return targets;
}

/**
 * The inline script (plain ES5, one `<script>` body) for a logical path. The targets are written
 * into it rather than computed from `location`, so `/tools`, `/tools/` and `/tools.html` all land
 * on the same address.
 */
function forwardScript(logicalPath) {
  const english = JSON.stringify(localizedPath(logicalPath, DEFAULT_LOCALE_PREFIX));
  const targets = JSON.stringify(languageTargets(logicalPath));
  const key = JSON.stringify(STORED_LANGUAGE_KEY);

  return (
    '(function(){' +
    `var e=${english},t=${targets},s=location.search+location.hash,u=e,m=false;` +
    `try{var l=localStorage.getItem(${key});` +
    'if(l){l=t[l.toLowerCase()];if(typeof l==="string"){u=l;m=true}}}catch(x){}' +
    'if(m){location.replace(u+s)}else{' +
    'try{history.replaceState(null,"",u+s)}catch(x){location.replace(u+s)}}' +
    '})();'
  ).replace(/</g, '\\u003c');
}

/** Puts the script after the charset declaration (which must stay in the first 1024 bytes). */
function unprefixedHtml(sourceHtml, logicalPath) {
  const tag = `<script id="${SCRIPT_ID}">${forwardScript(logicalPath)}</script>`;
  const charset = /<meta\s+charset="utf-8"\s*\/?>/i.exec(sourceHtml);

  if (charset) {
    const at = charset.index + charset[0].length;
    return `${sourceHtml.slice(0, at)}${tag}${sourceHtml.slice(at)}`;
  }

  const head = /<head[^>]*>/i.exec(sourceHtml);
  if (!head) {
    throw new Error('write-unprefixed-pages: the English page has no <head>');
  }

  const at = head.index + head[0].length;
  return `${sourceHtml.slice(0, at)}${tag}${sourceHtml.slice(at)}`;
}

/** Where the export (or the flatten step, once it has run) put the English page of a logical path. */
function englishSourceCandidates(distDir, logicalPath) {
  const english = path.join(distDir, DEFAULT_LOCALE_PREFIX);

  // The home page is `en/index.html` (and `en.html` once flattened); every other page is either a
  // directory index (`en/tools/index.html`, `en/tools.html` once flattened) or a leaf file.
  return logicalPath === '/'
    ? [path.join(english, 'index.html'), `${english}.html`]
    : [path.join(english, logicalPath, 'index.html'), `${path.join(english, logicalPath)}.html`];
}

function readEnglishPage(distDir, logicalPath) {
  const candidates = englishSourceCandidates(distDir, logicalPath);
  const source = candidates.find(
    (candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
  );

  if (!source) {
    throw new Error(
      `write-unprefixed-pages: no English page for ${logicalPath} (looked for ${candidates
        .map((candidate) => path.relative(distDir, candidate))
        .join(', ')})`
    );
  }

  return fs.readFileSync(source, 'utf8');
}

/**
 * `{ file, logicalPath }[]`, `file` relative to dist (`tools/protein-calculator.html`, `index.html`,
 * `home.html`). `/home` is an old address of the home page, so it is the home page too.
 */
function unprefixedTargets() {
  const targets = [
    { file: 'index.html', logicalPath: '/' },
    { file: 'home.html', logicalPath: '/' },
  ];
  const seen = new Set(['/', '/home']);

  for (const logicalPath of sitemapLogicalPaths()) {
    if (seen.has(logicalPath) || !legacyForwardPath(logicalPath)) {
      continue;
    }

    seen.add(logicalPath);
    targets.push({ file: `${logicalPath.slice(1)}.html`, logicalPath });
  }

  return targets;
}

/** `{ file, html }[]` for a built `dist`; throws when an English page is missing from it. */
function unprefixedPages(distDir) {
  return unprefixedTargets().map(({ file, logicalPath }) => ({
    file,
    html: unprefixedHtml(readEnglishPage(distDir, logicalPath), logicalPath),
  }));
}

/** The export's own bare-`/` page: the one file this step replaces on purpose. */
const REPLACED_FILES = new Set(['index.html']);

function writeUnprefixedPages(distDir) {
  const pages = unprefixedPages(distDir);
  const collisions = pages
    .map(({ file }) => file)
    .filter((file) => !REPLACED_FILES.has(file) && fs.existsSync(path.join(distDir, file)));

  if (collisions.length > 0) {
    throw new Error(
      `write-unprefixed-pages: refusing to overwrite existing files: ${collisions.join(', ')}`
    );
  }

  for (const { file, html } of pages) {
    const target = path.join(distDir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
  }

  return pages.map(({ file }) => file);
}

function main() {
  const written = writeUnprefixedPages(path.join(__dirname, '..', 'dist'));
  console.log(
    `write-unprefixed-pages: wrote ${written.length} English pages at unprefixed addresses`
  );
}

if (require.main === module) {
  main();
}

module.exports = {
  SCRIPT_ID,
  STORED_LANGUAGE_KEY,
  forwardScript,
  languageTargets,
  main,
  unprefixedHtml,
  unprefixedPages,
  unprefixedTargets,
  writeUnprefixedPages,
};
