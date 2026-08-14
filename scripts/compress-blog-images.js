#!/usr/bin/env node
/* eslint-disable no-undef */

const fs = require('fs');
const path = require('path');

const sharp = require('sharp');

const REPOSITORY_ROOT = path.resolve(__dirname, '..');
const BLOG_POSTS_DIRECTORY = path.join(REPOSITORY_ROOT, 'app', '(website)', 'posts');
const PUBLIC_DIRECTORY = path.join(REPOSITORY_ROOT, 'public');
const BLOG_IMAGE_URL_PREFIX = '/images/blog/';
const MARKDOWN_EXTENSION = /\.md$/i;
const CONVERTIBLE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png']);
const TARGET_WIDTH = 1792;
const WEBP_OPTIONS = { effort: 6, quality: 85, smartSubsample: true };

function discoverMarkdownFiles(directory) {
  const files = [];

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...discoverMarkdownFiles(entryPath));
    } else if (entry.isFile() && MARKDOWN_EXTENSION.test(entry.name)) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function findBlogImageUrls(markdown) {
  const imagePattern =
    /!\[[^\]\r\n]*\]\(\s*(\/images\/blog\/[^\s)]+?\.(?:jpe?g|png|webp))(?=\s|\))/gi;

  return [...markdown.matchAll(imagePattern)].map((match) => match[1]);
}

function resolveBlogImagePath(publicDirectory, imageUrl) {
  if (!imageUrl.startsWith(BLOG_IMAGE_URL_PREFIX)) {
    throw new Error(`Not a local blog image URL: ${imageUrl}`);
  }

  const blogImagesDirectory = path.resolve(publicDirectory, 'images', 'blog');
  const imagePath = path.resolve(publicDirectory, imageUrl.slice(1));
  const relativePath = path.relative(blogImagesDirectory, imagePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Blog image URL escapes public/images/blog: ${imageUrl}`);
  }

  return imagePath;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

async function compressBlogImages({
  postsDirectory = BLOG_POSTS_DIRECTORY,
  publicDirectory = PUBLIC_DIRECTORY,
  logger = console,
} = {}) {
  const posts = discoverMarkdownFiles(postsDirectory).map((filePath) => {
    const markdown = fs.readFileSync(filePath, 'utf8');
    return { filePath, imageUrls: findBlogImageUrls(markdown), markdown };
  });
  const imageUrls = [...new Set(posts.flatMap((post) => post.imageUrls))].sort();
  const candidates = [];
  const outputOwners = new Map();

  for (const imageUrl of imageUrls) {
    const sourcePath = resolveBlogImagePath(publicDirectory, imageUrl);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Blog image does not exist: ${imageUrl}`);
    }

    const extension = path.extname(sourcePath).toLowerCase();
    if (!CONVERTIBLE_EXTENSIONS.has(extension)) {
      continue;
    }

    const outputUrl = imageUrl.replace(/\.(?:jpe?g|png)$/i, '.webp');
    const outputPath = resolveBlogImagePath(publicDirectory, outputUrl);
    const existingOwner = outputOwners.get(outputPath);
    if (existingOwner) {
      throw new Error(`${existingOwner} and ${imageUrl} would both produce ${outputUrl}`);
    }
    if (fs.existsSync(outputPath)) {
      throw new Error(`Refusing to overwrite existing blog image: ${outputUrl}`);
    }

    outputOwners.set(outputPath, imageUrl);
    candidates.push({ imageUrl, outputPath, outputUrl, sourcePath });
  }

  const conversions = [];
  const skipped = [];

  for (const candidate of candidates) {
    const originalSize = fs.statSync(candidate.sourcePath).size;
    const { data, info } = await sharp(candidate.sourcePath)
      .rotate()
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp(WEBP_OPTIONS)
      .toBuffer({ resolveWithObject: true });

    if (data.length >= originalSize) {
      skipped.push({ imageUrl: candidate.imageUrl, originalSize, outputSize: data.length });
      logger.log(
        `[compress-blog-images] kept ${candidate.imageUrl} ` +
          `(${formatBytes(originalSize)}; WebP would be ${formatBytes(data.length)})`
      );
      continue;
    }

    conversions.push({ ...candidate, data, height: info.height, originalSize, width: info.width });
  }

  for (const conversion of conversions) {
    fs.writeFileSync(conversion.outputPath, conversion.data, { flag: 'wx' });
  }

  for (const post of posts) {
    let updatedMarkdown = post.markdown;
    for (const conversion of conversions) {
      updatedMarkdown = updatedMarkdown.replaceAll(conversion.imageUrl, conversion.outputUrl);
    }
    if (updatedMarkdown !== post.markdown) {
      fs.writeFileSync(post.filePath, updatedMarkdown);
    }
  }

  for (const conversion of conversions) {
    fs.unlinkSync(conversion.sourcePath);
    const reduction = ((1 - conversion.data.length / conversion.originalSize) * 100).toFixed(1);
    logger.log(
      `[compress-blog-images] ${conversion.imageUrl} -> ${conversion.outputUrl} ` +
        `(${formatBytes(conversion.originalSize)} -> ${formatBytes(conversion.data.length)}, ` +
        `${reduction}% smaller, ${conversion.width}x${conversion.height})`
    );
  }

  const originalBytes = conversions.reduce((total, image) => total + image.originalSize, 0);
  const compressedBytes = conversions.reduce((total, image) => total + image.data.length, 0);
  logger.log(
    `[compress-blog-images] converted ${conversions.length}, skipped ${skipped.length}, ` +
      `already WebP ${imageUrls.length - candidates.length}` +
      (conversions.length > 0 ? `; saved ${formatBytes(originalBytes - compressedBytes)}` : '')
  );

  return { conversions, imageCount: imageUrls.length, skipped };
}

if (require.main === module) {
  compressBlogImages().catch((error) => {
    console.error(`[compress-blog-images] ${error.message}`);
    process.exit(1);
  });
}

module.exports = {
  TARGET_WIDTH,
  compressBlogImages,
  discoverMarkdownFiles,
  findBlogImageUrls,
  resolveBlogImagePath,
};
