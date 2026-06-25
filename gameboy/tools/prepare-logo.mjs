// Converts the app icon (assets/icon-pixel.png, 36x36 paletted) into a Game Boy-ready
// logo: 64x64 (= 8x8 tiles) quantized to 4 colors (one CGB background palette).
//
// The output (gameboy/assets/logo.png) is committed so the ROM build itself does not
// depend on `sharp`. Re-run with `npm run gb:prepare-logo` if the source icon changes.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const repoRoot = join(fileURLToPath(import.meta.url), '..', '..', '..');
const src = join(repoRoot, 'assets', 'icon-pixel.png');
const outDir = join(repoRoot, 'gameboy', 'assets');
const out = join(outDir, 'logo.png');

// 64x64 keeps the pixel-art crisp (nearest-neighbour) and maps to a clean 8x8 tile block.
const SIZE = 64;
const COLORS = 4; // a single Game Boy Color background palette holds 4 colors

mkdirSync(outDir, { recursive: true });

await sharp(src)
    .resize(SIZE, SIZE, { kernel: 'nearest', fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .png({ palette: true, colors: COLORS, dither: 0 })
    .toFile(out);

console.log(`Wrote ${out} (${SIZE}x${SIZE}, ${COLORS} colors).`);
