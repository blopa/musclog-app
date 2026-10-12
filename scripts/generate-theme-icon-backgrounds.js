'use strict';

const { mkdir } = require('node:fs/promises');
const { Buffer } = require('node:buffer');
const path = require('node:path');
const sharp = require('sharp');

const { THEME_DEFINITIONS, THEME_IDS } = require('../theme.registry');

const RECOLOR_STOPS = [
  { at: 0, token: 'brandBright' },
  { at: 1, token: 'statusInfo' },
];
function parseHexColor(hex) {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function interpolateColor(stops, position) {
  const upperIndex = stops.findIndex((stop) => stop.at >= position);
  if (upperIndex <= 0) {
    return stops[Math.max(0, upperIndex)].color;
  }

  const lower = stops[upperIndex - 1];
  const upper = stops[upperIndex];
  const mix = (position - lower.at) / (upper.at - lower.at);
  return lower.color.map((channel, index) =>
    Math.round(channel + (upper.color[index] - channel) * mix)
  );
}

function recolorPixels(data, width, height, palette) {
  const stops = RECOLOR_STOPS.map(({ at, token }) => ({
    at,
    color: parseHexColor(palette[token]),
  }));
  const visibleRows = new Uint8Array(height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] > 0) {
        visibleRows[y] = 1;
      }
    }
  }

  let firstVisibleRow = visibleRows.findIndex((visible) => visible === 1);
  if (firstVisibleRow === -1) {
    firstVisibleRow = 0;
  }
  let lastVisibleRow = height - 1;
  while (lastVisibleRow > firstVisibleRow && visibleRows[lastVisibleRow] === 0) {
    lastVisibleRow -= 1;
  }
  const visibleHeight = Math.max(1, lastVisibleRow - firstVisibleRow);
  for (let y = 0; y < height; y += 1) {
    const position = visibleHeight > 0 ? (y - firstVisibleRow) / visibleHeight : 0;
    const color = interpolateColor(stops, Math.max(0, Math.min(1, position)));
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (data[offset + 3] === 0) {
        continue;
      }

      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = color[channel];
      }
    }
  }

  return data;
}

async function generateThemeIconBackgrounds(options = {}) {
  const repositoryRoot = path.dirname(require.resolve('../theme.registry'));
  const sourcePath = options.sourcePath ?? path.join(repositoryRoot, 'assets', 'icon-bg-color.png');
  const glassEffectPath =
    options.glassEffectPath ?? path.join(repositoryRoot, 'assets', 'icon-bg-glass-effect.png');
  const textPath = options.textPath ?? path.join(repositoryRoot, 'assets', 'icon-bg-text.png');
  const outputDirectory =
    options.outputDirectory ?? path.join(repositoryRoot, 'assets', 'theme-icons');
  const logger = options.logger ?? console;
  const { data, info } = await sharp(sourcePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (info.channels !== 4) {
    throw new Error(`Expected RGBA source pixels, received ${info.channels} channels.`);
  }
  const glassInfo = await sharp(glassEffectPath).metadata();
  if (glassInfo.width !== info.width || glassInfo.height !== info.height) {
    throw new Error(
      `Glass effect image must be ${info.width}x${info.height}; received ${glassInfo.width}x${glassInfo.height}.`
    );
  }
  const textInfo = await sharp(textPath).metadata();
  if (textInfo.width !== info.width || textInfo.height !== info.height) {
    throw new Error(
      `Text image must be ${info.width}x${info.height}; received ${textInfo.width}x${textInfo.height}.`
    );
  }

  await mkdir(outputDirectory, { recursive: true });
  const generated = [];
  for (const themeId of THEME_IDS) {
    const outputPath = path.join(outputDirectory, `icon-bg-${themeId}.png`);
    const pixels = Buffer.from(data);
    recolorPixels(pixels, info.width, info.height, THEME_DEFINITIONS[themeId].palette);
    await sharp(pixels, { raw: { channels: 4, height: info.height, width: info.width } })
      .composite([
        { input: glassEffectPath, blend: 'over' },
        { input: textPath, blend: 'over' },
      ])
      .png()
      .toFile(outputPath);
    generated.push(outputPath);
  }

  logger.log(`Generated ${generated.length} theme icon backgrounds in ${outputDirectory}.`);
  return generated;
}

if (require.main === module) {
  generateThemeIconBackgrounds().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { generateThemeIconBackgrounds, interpolateColor, recolorPixels };
