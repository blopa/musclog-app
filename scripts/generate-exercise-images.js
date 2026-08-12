#!/usr/bin/env node
/* eslint-disable no-undef */

/**
 * Re-encodes the exercise photos that the website serves at
 * `https://musclog.app/images/exercises/...` and the app downloads on demand.
 *
 * Usage:
 *   node scripts/generate-exercise-images.js [path-to-free-exercise-db]
 *   node scripts/generate-exercise-images.js --legacy
 *
 * Default mode reads `data/exercisesData.json` and, for every `__freeExerciseDbId`,
 * converts `<free-exercise-db>/exercises/<slug>/{0,1}.jpg` into
 * `public/images/exercises/<slug>/{0,1}.webp`. Frame 0 is the start position and
 * frame 1 the end position; `utils/exerciseImage.ts` stores frame 0 as an
 * exercise's `image_url` and derives frame 1 from it by convention.
 *
 * `--legacy` converts the retired AI illustrations in `assets/exercises/` into
 * `public/images/exercises/legacy/exercise<N>.webp`. Those are kept only so that
 * exercises cloned out of the pre-free-exercise-db catalogue (see
 * `LegacyExerciseCatalogueMigration`) keep their picture. It is a one-shot
 * conversion — `assets/exercises/` is deleted afterwards.
 *
 * Like the Game Boy asset tools, this runs locally and its output is committed, so
 * `sharp` stays an optionalDependency that CI never has to build.
 */

const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const repoRoot = path.join(__dirname, '..');
const outputRoot = path.join(repoRoot, 'public', 'images', 'exercises');

// 512px/q65 measured at ~13 KB per image, ~22 MB for all 1746. The whole directory is
// re-pushed to the gh-pages orphan branch on every deploy, so size is a running cost.
const TARGET_WIDTH = 512;
const WEBP_OPTIONS = { effort: 6, quality: 65 };

async function encode(sourcePath, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  await sharp(sourcePath)
    .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
    .webp(WEBP_OPTIONS)
    .toFile(destPath);
  return fs.statSync(destPath).size;
}

async function generateCatalogueImages(sourceRepo) {
  const exercisesDir = path.join(sourceRepo, 'exercises');
  if (!fs.existsSync(exercisesDir)) {
    throw new Error(`free-exercise-db images not found at ${exercisesDir}`);
  }

  const catalogue = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'exercisesData.json'), 'utf8')
  );

  let written = 0;
  let bytes = 0;
  const missing = [];

  for (const exercise of catalogue) {
    const slug = exercise.__freeExerciseDbId;
    for (const frame of [0, 1]) {
      const sourcePath = path.join(exercisesDir, slug, `${frame}.jpg`);
      if (!fs.existsSync(sourcePath)) {
        missing.push(`${slug}/${frame}.jpg`);
        continue;
      }
      bytes += await encode(sourcePath, path.join(outputRoot, slug, `${frame}.webp`));
      written += 1;
    }
  }

  console.log(
    `Wrote ${written} images (${(bytes / 1048576).toFixed(1)} MB) to public/images/exercises/`
  );
  if (missing.length > 0) {
    console.warn(`Missing source images (${missing.length}): ${missing.slice(0, 10).join(', ')}`);
  }
}

async function generateLegacyImages() {
  const legacyDir = path.join(repoRoot, 'assets', 'exercises');
  if (!fs.existsSync(legacyDir)) {
    throw new Error(
      `assets/exercises/ no longer exists — the legacy conversion has already been run and committed`
    );
  }

  const files = fs.readdirSync(legacyDir).filter((file) => /^exercise\d+\.png$/i.test(file));

  let bytes = 0;
  for (const file of files) {
    const destName = `${path.basename(file, path.extname(file))}.webp`;
    bytes += await encode(path.join(legacyDir, file), path.join(outputRoot, 'legacy', destName));
  }

  console.log(
    `Wrote ${files.length} legacy images (${(bytes / 1048576).toFixed(1)} MB) to public/images/exercises/legacy/`
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--legacy')) {
    await generateLegacyImages();
    return;
  }

  const sourceRepo = args[0] || path.join(repoRoot, '..', 'free-exercise-db');
  await generateCatalogueImages(sourceRepo);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
