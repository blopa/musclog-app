#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Copies the zxing-wasm reader binary into `public/` so the web build serves it from our own
 * origin.
 *
 * WHY THIS EXISTS AT ALL: `zxing-wasm` defaults to fetching its `.wasm` from a CDN (jsdelivr) on
 * first use. Optical Transfer's entire promise is "no internet, no account, nothing leaves the
 * room" — a receiver that silently needs a CDN to be reachable breaks that on exactly the offline
 * case the feature exists for, and leaks a request telling a third party when a transfer happens.
 * Self-hosting is not an optimisation here, it is the feature working as described.
 *
 * Runs from `postinstall` rather than only from the web build scripts, so the file is present
 * whichever command produces the bundle (`npm run web`, `build-android-web`, a bare
 * `npx expo export -p web`). Copying rather than symlinking: `expo export` follows `public/` into
 * `dist/`, and a symlink into `node_modules` does not survive a deploy artifact.
 *
 * The copy is versioned by `package.json` (zxing-wasm is pinned exactly) and the decoder refuses
 * to fall back to a CDN, so a stale or missing copy fails loudly on the receive screen rather
 * than quietly going online.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const destination = path.join(root, 'public', 'zxing_reader.wasm');

function main() {
  let source;
  try {
    // Resolved through the package's own export map, so a zxing-wasm upgrade that moves the file
    // is a loud failure here rather than a 404 in the browser.
    source = require.resolve('zxing-wasm/reader/zxing_reader.wasm', { paths: [root] });
  } catch {
    console.error(
      '[sync-web-wasm] zxing-wasm is not installed — the web optical receiver cannot decode.'
    );
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);

  console.log(
    '[sync-web-wasm]',
    path.relative(root, destination),
    `<- ${path.relative(root, source)}`
  );
}

main();
