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

const LEGACY_TITLE = 'Taking you to the right page';
const LEGACY_DESCRIPTION =
  'Musclog pages now live under a language, so we are sending you to the English version. This only takes a moment.';
const LEGACY_FALLBACK = 'Nothing happening?';

/**
 * Self-contained on purpose: this page must forward at once, so it cannot load the app's bundle or
 * stylesheet and has no header or footer. It borrows the default palettes and Loggy's default-theme
 * animation (a still under reduced motion) so the moment before the forward still looks like Musclog.
 */
const LEGACY_CSS = [
  ':root{color-scheme:light dark;--bg:#fbfcfb;--fg:#0f1a16;--muted:#49534f}',
  '@media(prefers-color-scheme:dark){:root{--bg:#0d1210;--fg:#dce5de;--muted:#a3ada9}}',
  '*{box-sizing:border-box}',
  'body{margin:0;min-height:100vh;display:flex;align-items:center;background:var(--bg);color:var(--fg);font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
  'main{width:100%;max-width:36rem;margin:0 auto;padding:5rem 1rem}',
  '.loggy{display:block;height:9rem;aspect-ratio:512/668;margin-bottom:1.5rem;background:url(/images/loggy/kinetic-depth/loggy-thinking.svg) center/contain no-repeat}',
  '@media(prefers-reduced-motion:reduce){.loggy{background-image:url(/images/loggy/kinetic-depth/loggy-thinking-still.svg)}}',
  'h1{margin:0;font-size:2.25rem;line-height:1.15;font-weight:700;text-wrap:balance}',
  'p{margin:1rem 0 0;font-size:1.125rem;line-height:1.7;color:var(--muted);text-wrap:balance}',
  'p.fallback{margin-top:1.5rem;font-size:.875rem;line-height:1.5}',
  'a{color:var(--fg);font-weight:600;text-decoration:underline;overflow-wrap:anywhere}',
].join('');

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
    `<style>${LEGACY_CSS}</style>\n` +
    '<meta name="robots" content="index, follow">\n' +
    `<link rel="canonical" href="${escapeAttribute(url)}">\n` +
    `<meta http-equiv="refresh" content="0; url=${escapeAttribute(target)}">\n` +
    `<script>location.replace(${script} + location.search + location.hash);</script>\n` +
    '</head>\n' +
    '<body>\n' +
    '<main role="status">\n' +
    '<span class="loggy" aria-hidden="true"></span>\n' +
    `<h1>${LEGACY_TITLE}</h1>\n` +
    `<p>${LEGACY_DESCRIPTION}</p>\n` +
    `<p class="fallback">${LEGACY_FALLBACK} <a href="${escapeAttribute(target)}">${escapeAttribute(url)}</a></p>\n` +
    '</main>\n' +
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
