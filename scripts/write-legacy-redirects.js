#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * Every public page now lives under a language prefix (`/en/tools/x`). The site is static files, so
 * an old unprefixed address (`/tools/x`, `/blog`, a search result, a bookmark) gets a tiny
 * self-contained page that forwards the browser to the same page in English, query and hash kept.
 * Never overwrites an existing file; a collision is an error. `/open`, `/test` and `/app` get none.
 */
const fs = require('node:fs');
const path = require('node:path');

const { legacyForwardPath, localizedPath } = require('../components/website/localeRoutes');
const { SITE_ORIGIN, sitemapLogicalPaths } = require('./generate-web-seo-files');

/** Escapes text for an HTML attribute value. */
function escapeAttribute(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function legacyHtml(target) {
  const url = `${SITE_ORIGIN}${target}`;
  const script = JSON.stringify(target).replace(/</g, '\\u003c');
  return (
    '<!doctype html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>Musclog</title>\n' +
    '<meta name="robots" content="index, follow">\n' +
    `<link rel="canonical" href="${escapeAttribute(url)}">\n` +
    `<meta http-equiv="refresh" content="0; url=${escapeAttribute(target)}">\n` +
    `<script>location.replace(${script} + location.search + location.hash);</script>\n` +
    '</head>\n' +
    '<body>\n' +
    `<p><a href="${escapeAttribute(target)}">${escapeAttribute(url)}</a></p>\n` +
    '</body>\n' +
    '</html>\n'
  );
}

/** `{ file, html }[]`, `file` relative to dist (`tools/protein-calculator.html`, `home.html`). */
function legacyPages() {
  const pages = [{ file: 'home.html', html: legacyHtml(localizedPath('/', 'en')) }];
  const seen = new Set(['/home']);

  for (const logicalPath of sitemapLogicalPaths()) {
    if (logicalPath === '/' || seen.has(logicalPath)) {
      continue;
    }

    const target = legacyForwardPath(logicalPath);
    if (!target) {
      continue;
    }

    seen.add(logicalPath);
    pages.push({ file: `${logicalPath.slice(1)}.html`, html: legacyHtml(target) });
  }

  return pages;
}

function writeLegacyRedirects(distDir) {
  const written = [];
  const collisions = [];

  for (const { file, html } of legacyPages()) {
    const target = path.join(distDir, file);
    if (fs.existsSync(target)) {
      collisions.push(file);
      continue;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html);
    written.push(file);
  }

  if (collisions.length > 0) {
    throw new Error(
      `write-legacy-redirects: refusing to overwrite existing files: ${collisions.join(', ')}`
    );
  }

  return written;
}

function main() {
  const written = writeLegacyRedirects(path.join(__dirname, '..', 'dist'));
  console.log(`write-legacy-redirects: wrote ${written.length} forwarding pages in dist`);
}

if (require.main === module) {
  main();
}

module.exports = { legacyHtml, legacyPages, main, writeLegacyRedirects };
