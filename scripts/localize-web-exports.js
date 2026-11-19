#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Post-export pass over dist/ for the language-prefixed website:
 *  1. stamps `<html lang="…">` with each locale's hreflang in dist/<prefix>/**.html and the flat
 *     dist/<prefix>.html (the export renders every page with lang="en");
 *  2. deletes the export's template pages for the `[locale]` segment itself (dist/[locale]/…: the
 *     page rendered for the literal "[locale]", which no address reaches), and any page generated
 *     for a non-English locale although it has no translation (a safety net: the blog is English
 *     only and lives in app/(website)/en/blog, so none is expected).
 * Idempotent. Run before flatten-web-indexes.js so the flat copies carry the stamped lang.
 */
const fs = require('node:fs');
const path = require('node:path');

const {
  DEFAULT_LOCALE_PREFIX,
  WEBSITE_LOCALES,
  localeScopeOf,
} = require('../components/website/localeRoutes');

const HTML_LANG = /<html\b([^>]*?)\blang="[^"]*"/i;

function walkHtml(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkHtml(entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(entryPath);
    }
  }

  return files;
}

/** The logical path of a file under dist/<prefix>/ (`blog/x/index.html` -> `/blog/x`). */
function logicalPathOf(relativeToLocale) {
  const withoutExtension = relativeToLocale
    .split(path.sep)
    .join('/')
    .replace(/\.html$/, '')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');
  return `/${withoutExtension}`;
}

function localizeWebExports(distDir) {
  let stamped = 0;
  let removed = 0;

  for (const template of ['[locale]', '[locale].html']) {
    const templatePath = path.join(distDir, template);
    if (fs.existsSync(templatePath)) {
      fs.rmSync(templatePath, { recursive: true, force: true });
      removed += 1;
    }
  }

  for (const locale of WEBSITE_LOCALES) {
    const localeDir = path.join(distDir, locale.prefix);
    const files = [];
    if (fs.existsSync(localeDir)) {
      walkHtml(localeDir, files);
    }

    const flat = path.join(distDir, `${locale.prefix}.html`);
    if (fs.existsSync(flat)) {
      files.push(flat);
    }

    for (const file of files) {
      const relative = path.relative(localeDir, file);
      const isFlatRoot = file === flat;
      if (!isFlatRoot && locale.prefix !== DEFAULT_LOCALE_PREFIX) {
        if (localeScopeOf(logicalPathOf(relative)) === 'en') {
          fs.rmSync(file, { force: true });
          removed += 1;
          continue;
        }
      }

      const html = fs.readFileSync(file, 'utf8');
      const next = html.replace(HTML_LANG, `<html$1lang="${locale.hreflang}"`);
      if (next !== html) {
        fs.writeFileSync(file, next);
        stamped += 1;
      }
    }

    // Drop directories the removals left empty (and the English-only ones nothing else lives in).
    if (locale.prefix !== DEFAULT_LOCALE_PREFIX && fs.existsSync(localeDir)) {
      pruneEmpty(localeDir);
    }
  }

  return { stamped, removed };
}

function pruneEmpty(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      pruneEmpty(path.join(directory, entry.name));
    }
  }

  if (fs.readdirSync(directory).length === 0) {
    fs.rmdirSync(directory);
  }
}

/** The languages whose home page is missing from an export: a sign it stopped half way. */
function missingLocaleHomes(distDir) {
  return WEBSITE_LOCALES.filter(
    (locale) =>
      !fs.existsSync(path.join(distDir, locale.prefix, 'index.html')) &&
      !fs.existsSync(path.join(distDir, `${locale.prefix}.html`))
  ).map((locale) => locale.prefix);
}

function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  const missing = missingLocaleHomes(distDir);
  if (missing.length > 0) {
    // Fail the build: every later step would run on a half-empty export and look like it worked.
    console.error(`localize-web-exports: no home page exported for: ${missing.join(', ')}`);
    process.exit(1);
  }

  const { stamped, removed } = localizeWebExports(distDir);
  console.log(
    `localize-web-exports: stamped lang on ${stamped} pages, removed ${removed} untranslated pages in dist`
  );
}

if (require.main === module) {
  main();
}

module.exports = { localizeWebExports, main, missingLocaleHomes };
