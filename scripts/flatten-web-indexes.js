#!/usr/bin/env node
/* eslint-disable no-undef */
/**
 * GitHub Pages answers a directory URL (`/blog`) with a 301 to `http://…/blog/` (Cloudflare reaches
 * the origin over http), which contradicts the slash-less https canonical and sitemap. A flat
 * `blog.html` next to `blog/` is served with a 200, so after the static export every
 * `X/index.html` also ships as `X.html`. Never overwrites an existing file.
 */
const fs = require('node:fs');
const path = require('node:path');

const SKIPPED_TOP_LEVEL = new Set(['assets', 'images', 'musclog-app']);

function isSkippedSegment(segment) {
  return segment.startsWith('(') || segment.startsWith('_');
}

function flattenDirectoryIndexes(distDir) {
  const written = [];

  function walk(relDir) {
    const absDir = path.join(distDir, relDir);

    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      if (isSkippedSegment(entry.name) || (relDir === '' && SKIPPED_TOP_LEVEL.has(entry.name))) {
        continue;
      }

      const rel = path.join(relDir, entry.name);
      const index = path.join(distDir, rel, 'index.html');
      const flat = path.join(distDir, `${rel}.html`);

      if (fs.existsSync(index) && !fs.existsSync(flat)) {
        fs.copyFileSync(index, flat);
        written.push(`${rel.split(path.sep).join('/')}.html`);
      }

      walk(rel);
    }
  }

  if (fs.existsSync(distDir)) {
    walk('');
  }

  return written;
}

function main() {
  const distDir = path.join(__dirname, '..', 'dist');
  const written = flattenDirectoryIndexes(distDir);

  console.log(`flatten-web-indexes: wrote ${written.length} flat .html files in dist`);
}

if (require.main === module) {
  main();
}

module.exports = { flattenDirectoryIndexes, main };
