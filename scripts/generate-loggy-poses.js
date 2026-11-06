/**
 * Renders every Loggy pose in `assets/avatars/loggy-poses/*.svg` to a PNG beside it. The SVGs stay
 * the source of truth; the app ships the PNGs because Metro has no SVG transformer, and a plain
 * image also survives the native view capture behind the share card.
 *
 * Run after adding or redrawing a pose: `npm run generate-loggy-poses`.
 */
const { readdirSync } = require('fs');
const { join, resolve } = require('path');
const sharp = require('sharp');

// npm runs scripts from the project root.
const POSES_DIR = resolve('assets', 'avatars', 'loggy-poses');
/** Tall enough for the largest use (about 320pt on a 3x screen), still around 30 KB per pose. */
const OUTPUT_HEIGHT = 900;
const RENDER_DENSITY = 144;

async function main() {
  const poses = readdirSync(POSES_DIR).filter((name) => name.endsWith('.svg'));

  for (const name of poses) {
    const output = join(POSES_DIR, name.replace(/\.svg$/, '.png'));
    const { size } = await sharp(join(POSES_DIR, name), { density: RENDER_DENSITY })
      .resize({ height: OUTPUT_HEIGHT })
      .png({ palette: true, quality: 90, compressionLevel: 9 })
      .toFile(output);
    console.log(`${name} -> ${Math.round(size / 1024)} KB`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
