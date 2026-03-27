import sharp from 'sharp';
import { readdirSync } from 'fs';
import { join, extname } from 'path';

const EXERCISES_DIR = new URL('../assets/exercises', import.meta.url).pathname;
const TARGET_SIZE = 1024;
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const files = readdirSync(EXERCISES_DIR).filter((f) =>
    IMAGE_EXTENSIONS.has(extname(f).toLowerCase())
);

let resized = 0;
let skipped = 0;

for (const file of files) {
    const filePath = join(EXERCISES_DIR, file);
    const image = sharp(filePath);
    const { width, height } = await image.metadata();

    if (width === TARGET_SIZE && height === TARGET_SIZE) {
        console.log(`[skip]   ${file} (already ${TARGET_SIZE}x${TARGET_SIZE})`);
        skipped++;
        continue;
    }

    await image
        .resize(TARGET_SIZE, TARGET_SIZE, { fit: 'cover', position: 'center' })
        .toFile(filePath + '.tmp');

    const { rename } = await import('fs/promises');
    await rename(filePath + '.tmp', filePath);

    console.log(`[resize] ${file} (${width}x${height} -> ${TARGET_SIZE}x${TARGET_SIZE})`);
    resized++;
}

console.log(`\nDone. Resized: ${resized}, Skipped: ${skipped}.`);
