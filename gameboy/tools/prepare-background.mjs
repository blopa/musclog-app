// Converts the full-screen title art (assets/gb_background.png, 160x144 truecolor)
// into a Game Boy-ready background: 160x144 (= 20x18 tiles) quantized to 4 colors
// (one CGB background palette), with no dithering so the tile count stays low
// enough for png2asset to dedupe into the 256 tile indices addressable by the
// start screen. The ROM build allows flipped-tile dedupe for this background.
//
// The output (gameboy/assets/gb_background.png) is committed so the ROM build
// itself does not depend on `sharp`. Re-run with `npm run gb:prepare-bg` if the
// source art changes.

import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const src = join(repoRoot, 'assets', 'gb_background.png');
const out = join(repoRoot, 'gameboy', 'assets', 'gb_background.png');

// The Game Boy screen is exactly 160x144; the source art is authored at that size.
const WIDTH = 160;
const HEIGHT = 144;
const COLORS = 4; // a single Game Boy Color background palette holds 4 colors

await sharp(src)
    .resize(WIDTH, HEIGHT, { kernel: 'nearest', fit: 'cover', position: 'center' })
    .flatten({ background: { r: 0, g: 0, b: 0 } })
    // dither: 0 keeps flat color regions flat so png2asset dedupes tiles aggressively
    // (a dithered image explodes the unique-tile count past the 256-tile limit).
    .png({ palette: true, colors: COLORS, dither: 0 })
    .toFile(out);

console.log(`Wrote ${out} (${WIDTH}x${HEIGHT}, ${COLORS} colors).`);
