import { readdirSync, statSync } from 'fs';
import { rename, unlink } from 'fs/promises';
import { extname, join } from 'path';
import sharp from 'sharp';

// Compresses exercise PNGs in place using palette quantization, which shrinks
// illustration-style images dramatically. Images stay PNG on purpose: the app's
// expo-asset pipeline has known limitations with .webp (see
// scripts/convert-exercise-images-to-png.js). Safe to re-run — a file is only
// overwritten when the recompressed version is actually smaller, so already
// optimized images are skipped.
const EXERCISES_DIR = new URL('../assets/exercises', import.meta.url).pathname;

// Palette PNGs cap at 256 colors; plenty for these flat illustrations.
const PALETTE_COLORS = 256;
// Only rewrite when we save at least this fraction, so re-runs are no-ops.
const MIN_SAVING_RATIO = 0.02;

const files = readdirSync(EXERCISES_DIR).filter((f) => extname(f).toLowerCase() === '.png');

let compressed = 0;
let skipped = 0;
let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
    const filePath = join(EXERCISES_DIR, file);
    const tmpPath = filePath + '.tmp';
    const beforeBytes = statSync(filePath).size;

    await sharp(filePath)
        .png({ palette: true, colors: PALETTE_COLORS, compressionLevel: 9, effort: 10 })
        .toFile(tmpPath);

    const afterBytes = statSync(tmpPath).size;
    const saved = beforeBytes - afterBytes;

    if (saved <= beforeBytes * MIN_SAVING_RATIO) {
        await unlink(tmpPath);
        console.log(`[skip]     ${file} (${formatKb(beforeBytes)}, already optimized)`);
        totalBefore += beforeBytes;
        totalAfter += beforeBytes;
        skipped++;
        continue;
    }

    await rename(tmpPath, filePath);
    const pct = ((saved / beforeBytes) * 100).toFixed(1);
    console.log(
        `[compress] ${file} (${formatKb(beforeBytes)} -> ${formatKb(afterBytes)}, -${pct}%)`
    );
    totalBefore += beforeBytes;
    totalAfter += afterBytes;
    compressed++;
}

const totalSaved = totalBefore - totalAfter;
const totalPct = totalBefore > 0 ? ((totalSaved / totalBefore) * 100).toFixed(1) : '0.0';
console.log(
    `\nDone. Compressed: ${compressed}, Skipped: ${skipped}. ` +
        `${formatMb(totalBefore)} -> ${formatMb(totalAfter)} (saved ${formatMb(totalSaved)}, -${totalPct}%).`
);

function formatKb(bytes) {
    return `${(bytes / 1024).toFixed(0)} KB`;
}

function formatMb(bytes) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
