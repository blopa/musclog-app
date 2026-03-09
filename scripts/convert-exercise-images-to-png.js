#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Directory containing exercise images
const EXERCISES_DIR = path.join(__dirname, '..', 'assets', 'exercises');
// Directory to store converted PNG images
const OUTPUT_DIR = path.join(__dirname, '..', 'assets', 'exercises');

/**
 * Converts all .webp files in assets/exercises/ to .png format
 * This avoids expo-asset plugin limitations with .webp files
 */
async function convertWebpToPng() {
  console.log('🔄 Converting .webp images to .png format...');

  if (!fs.existsSync(EXERCISES_DIR)) {
    console.error('❌ Exercises directory not found:', EXERCISES_DIR);
    process.exit(1);
  }

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const files = fs.readdirSync(EXERCISES_DIR);
  const webpFiles = files.filter((file) => file.endsWith('.webp'));

  if (webpFiles.length === 0) {
    console.log('ℹ️  No .webp files found to convert');
    return;
  }

  console.log(`📁 Found ${webpFiles.length} .webp files to convert`);

  for (const file of webpFiles) {
    const inputPath = path.join(EXERCISES_DIR, file);
    const outputPath = path.join(OUTPUT_DIR, file.replace('.webp', '.png'));

    try {
      console.log(`🔄 Converting ${file} to PNG...`);
      await sharp(inputPath).png().toFile(outputPath);

      console.log(`✅ Converted: ${file} → ${file.replace('.webp', '.png')}`);
    } catch (error) {
      console.error(`❌ Error converting ${file}:`, error.message);
    }
  }

  console.log('✅ Conversion complete!');
}

// Update the exerciseImage.ts file to use .png instead of .webp
function updateExerciseImageImports() {
  const exerciseImagePath = path.join(__dirname, '..', 'utils', 'exerciseImage.ts');

  if (!fs.existsSync(exerciseImagePath)) {
    console.error('❌ exerciseImage.ts not found:', exerciseImagePath);
    return;
  }

  let content = fs.readFileSync(exerciseImagePath, 'utf8');

  // Replace all .webp references with .png
  content = content.replace(/\.webp/g, '.png');

  fs.writeFileSync(exerciseImagePath, content);
  console.log('✅ Updated exerciseImage.ts to use .png format');
}

// Main execution
async function main() {
  await convertWebpToPng();
  updateExerciseImageImports();

  console.log('🎉 All done! Your exercise images are now in .png format.');
  console.log('');
  console.log('📝 Next steps:');
  console.log('   1. Run: npx expo prebuild --clean');
  console.log('   2. Test your production build');
  console.log('   3. Exercise images should now work correctly!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  convertWebpToPng,
  updateExerciseImageImports,
};
