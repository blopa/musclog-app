#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Directory containing app store screenshots
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots', 'app-store');

// Supported image extensions
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp'];

/**
 * Recursively get all image files from a directory
 * @param {string} dir - Directory to search
 * @returns {string[]} - Array of file paths
 */
function getImageFiles(dir) {
  const files = [];

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...getImageFiles(fullPath));
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(ext)) {
        files.push(fullPath);
      }
    }
  }

  return files;
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted size
 */
function formatFileSize(bytes) {
  if (bytes === 0) {
    return '0 Bytes';
  }
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Compress a PNG image with maximum compression (lossless)
 * @param {string} inputPath - Path to input image
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressPng(inputPath) {
  return sharp(inputPath)
    .png({
      compressionLevel: 9, // Maximum compression (0-9)
      adaptiveFiltering: true,
      palette: true, // Use palette-based PNG for better compression
      effort: 10, // Maximum compression effort (0-10)
    })
    .toBuffer();
}

/**
 * Compress a JPEG image with high quality (near-lossless)
 * @param {string} inputPath - Path to input image
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressJpeg(inputPath) {
  return sharp(inputPath)
    .jpeg({
      quality: 92, // High quality (0-100)
      mozjpeg: true, // Use mozjpeg encoder for better compression
      progressive: true, // Progressive JPEG for better web loading
    })
    .toBuffer();
}

/**
 * Compress a WebP image with high quality (near-lossless)
 * @param {string} inputPath - Path to input image
 * @returns {Promise<Buffer>} - Compressed image buffer
 */
async function compressWebp(inputPath) {
  return sharp(inputPath)
    .webp({
      quality: 92, // High quality (0-100)
      effort: 6, // Maximum compression effort (0-6)
      lossless: false, // Near-lossless for better compression
      nearLossless: 60, // Near-lossless quality (0-100, lower = smaller)
    })
    .toBuffer();
}

/**
 * Compress a single image based on its format
 * @param {string} inputPath - Path to input image
 * @returns {Promise<Buffer|null>} - Compressed image buffer or null if failed
 */
async function compressImage(inputPath) {
  const ext = path.extname(inputPath).toLowerCase();

  try {
    switch (ext) {
      case '.png':
        return await compressPng(inputPath);
      case '.jpg':
      case '.jpeg':
        return await compressJpeg(inputPath);
      case '.webp':
        return await compressWebp(inputPath);
      default:
        console.warn(`⚠️  Unsupported format: ${ext}`);
        return null;
    }
  } catch (error) {
    console.error(`❌ Error compressing ${path.basename(inputPath)}:`, error.message);
    return null;
  }
}

/**
 * Main compression function
 */
async function compressScreenshots() {
  console.log('🖼️  App Store Screenshots Compression');
  console.log('=====================================\n');

  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    console.error('❌ Screenshots directory not found:', SCREENSHOTS_DIR);
    process.exit(1);
  }

  // Get all image files
  const imageFiles = getImageFiles(SCREENSHOTS_DIR);

  if (imageFiles.length === 0) {
    console.log('ℹ️  No image files found in', SCREENSHOTS_DIR);
    return;
  }

  console.log(`📁 Found ${imageFiles.length} image(s) to compress\n`);

  let totalOriginalSize = 0;
  let totalCompressedSize = 0;
  let processedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const filePath of imageFiles) {
    const fileName = path.relative(SCREENSHOTS_DIR, filePath);
    const originalSize = fs.statSync(filePath).size;

    try {
      // Compress the image
      const compressedBuffer = await compressImage(filePath);

      if (!compressedBuffer) {
        errorCount++;
        continue;
      }

      const compressedSize = compressedBuffer.length;
      const savings = originalSize - compressedSize;
      const savingsPercent = ((savings / originalSize) * 100).toFixed(1);

      // Only replace if the compressed version is smaller
      if (compressedSize < originalSize) {
        fs.writeFileSync(filePath, compressedBuffer);
        processedCount++;
        totalOriginalSize += originalSize;
        totalCompressedSize += compressedSize;

        console.log(`✅ ${fileName}`);
        console.log(
          `   ${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)} (${savingsPercent}% smaller)\n`
        );
      } else {
        skippedCount++;
        console.log(`⏭️  ${fileName}`);
        console.log(`   Already optimized (skipped)\n`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ ${fileName}`);
      console.error(`   Error: ${error.message}\n`);
    }
  }

  // Print summary
  console.log('=====================================');
  console.log('📊 Compression Summary');
  console.log('=====================================');
  console.log(`✅ Processed: ${processedCount}`);
  console.log(`⏭️  Skipped:   ${skippedCount}`);
  console.log(`❌ Errors:    ${errorCount}`);

  if (processedCount > 0 && totalOriginalSize > 0) {
    const totalSavings = totalOriginalSize - totalCompressedSize;
    const totalSavingsPercent = ((totalSavings / totalOriginalSize) * 100).toFixed(1);
    console.log(
      `\n💾 Total size reduction: ${formatFileSize(totalOriginalSize)} → ${formatFileSize(totalCompressedSize)} (${totalSavingsPercent}%)`
    );
  }

  console.log('\n🎉 Done!');
}

// Main execution
if (require.main === module) {
  compressScreenshots().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  compressScreenshots,
  getImageFiles,
  compressImage,
  formatFileSize,
};
