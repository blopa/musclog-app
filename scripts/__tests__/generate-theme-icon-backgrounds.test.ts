import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

const { THEME_DEFINITIONS, THEME_IDS } = require('../../theme.registry') as {
  THEME_DEFINITIONS: Record<string, { palette: Record<string, string> }>;
  THEME_IDS: string[];
};
const { generateThemeIconBackgrounds, recolorPixels } =
  require('../generate-theme-icon-backgrounds') as {
    generateThemeIconBackgrounds: (options: {
      glassEffectPath: string;
      logger: { log: (message: string) => void };
      outputDirectory: string;
      sourcePath: string;
      textPath: string;
    }) => Promise<string[]>;
    recolorPixels: (
      data: Buffer,
      width: number,
      height: number,
      palette: Record<string, string>
    ) => Buffer;
  };

describe('generate-theme-icon-backgrounds', () => {
  it('recolors the base silhouette without using its grayscale values', () => {
    const width = 64;
    const height = 64;
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const shade = y === 30 || y === 31 ? 255 : 100;
        pixels[offset] = shade;
        pixels[offset + 1] = shade;
        pixels[offset + 2] = shade;
        pixels[offset + 3] = 255;
      }
    }
    recolorPixels(pixels, width, height, {
      brandBright: '#50a0dc',
      statusInfo: '#50a0dc',
    });

    expect(pixels[(30 * width + 32) * 4]).toBe(pixels[(31 * width + 32) * 4]);
    expect([...pixels.subarray((30 * width + 32) * 4, (30 * width + 32) * 4 + 3)]).toEqual([
      80, 160, 220,
    ]);
  });

  it('uses source alpha as a mask while applying a theme gradient', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'musclog-icon-gradient-'));
    const sourcePath = path.join(directory, 'source.png');
    const glassEffectPath = path.join(directory, 'glass.png');
    const textPath = path.join(directory, 'text.png');
    const outputDirectory = path.join(directory, 'output');
    const width = 24;
    const height = 20;
    const pixels = Buffer.alloc(width * height * 4);
    const glassPixels = Buffer.alloc(width * height * 4);
    const textPixels = Buffer.alloc(width * height * 4);

    for (let y = 2; y < height - 2; y += 1) {
      for (let x = 2; x < width - 2; x += 1) {
        const offset = (y * width + x) * 4;
        const shade = 145 - y * 2 + (x === 2 || x === width - 3 ? 18 : 0);
        pixels[offset] = shade;
        pixels[offset + 1] = shade;
        pixels[offset + 2] = shade;
        pixels[offset + 3] = 255;
      }
    }
    const highlightOffset = (9 * width + 12) * 4;
    glassPixels[highlightOffset] = 255;
    glassPixels[highlightOffset + 1] = 255;
    glassPixels[highlightOffset + 2] = 255;
    glassPixels[highlightOffset + 3] = 160;
    const wordmarkOffset = (11 * width + 12) * 4;
    textPixels[wordmarkOffset] = 255;
    textPixels[wordmarkOffset + 1] = 255;
    textPixels[wordmarkOffset + 2] = 255;
    textPixels[wordmarkOffset + 3] = 255;
    await sharp(pixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(sourcePath);
    await sharp(glassPixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(glassEffectPath);
    await sharp(textPixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(textPath);

    try {
      const [generatedPath] = await generateThemeIconBackgrounds({
        glassEffectPath,
        logger: { log: () => undefined },
        outputDirectory,
        sourcePath,
        textPath,
      });
      const { data, info } = await sharp(generatedPath).raw().toBuffer({ resolveWithObject: true });

      expect(info).toMatchObject({ channels: 4, height, width });
      expect(data[3]).toBe(0);
      expect(data[(10 * width + 10) * 4 + 3]).toBe(255);
      const glassOnlyRed = data[highlightOffset];
      const baseOnlyRed = data[(9 * width + 11) * 4];
      expect(glassOnlyRed).toBeGreaterThan(baseOnlyRed);
      expect(glassOnlyRed).toBeLessThan(255);
      expect([...data.subarray(wordmarkOffset, wordmarkOffset + 3)]).toEqual([255, 255, 255]);
      const topColor = [...data.subarray((3 * width + 12) * 4, (3 * width + 12) * 4 + 3)];
      const bottomColor = [...data.subarray((16 * width + 12) * 4, (16 * width + 12) * 4 + 3)];
      expect(topColor).not.toEqual(bottomColor);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });

  it('uses two distinct theme colors at the visible top and bottom edges', () => {
    const width = 4;
    const height = 4;
    const pixels = Buffer.alloc(width * height * 4);
    for (let index = 0; index < width * height; index += 1) {
      pixels[index * 4] = 128;
      pixels[index * 4 + 1] = 128;
      pixels[index * 4 + 2] = 128;
      pixels[index * 4 + 3] = 255;
    }
    const palette = THEME_DEFINITIONS['kinetic-depth'].palette;

    recolorPixels(pixels, width, height, palette);

    const toRgb = (hex: string) =>
      [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
    const topCenterOffset = Math.floor(width / 2) * 4;
    const topCenterColor = [...pixels.subarray(topCenterOffset, topCenterOffset + 3)];
    const topPaletteColor = toRgb(palette.brandBright);
    expect(topCenterColor).toEqual(topPaletteColor);
    const bottomOffset = (height - 1) * width * 4;
    const bottomColor = [...pixels.subarray(bottomOffset, bottomOffset + 3)];
    const bottomPaletteColor = toRgb(palette.statusInfo);
    expect(bottomColor).toEqual(bottomPaletteColor);
  });

  it('writes a transparent, theme-specific PNG for every registered theme', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'musclog-theme-icon-backgrounds-'));
    const sourcePath = path.join(directory, 'source.png');
    const glassEffectPath = path.join(directory, 'glass.png');
    const textPath = path.join(directory, 'text.png');
    const outputDirectory = path.join(directory, 'output');
    const width = 12;
    const height = 8;
    const pixels = Buffer.alloc(width * height * 4);
    const glassPixels = Buffer.alloc(width * height * 4);
    const textPixels = Buffer.alloc(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const shade = 90 + y * 8 + (x % 2) * 24;
        pixels[offset] = shade;
        pixels[offset + 1] = shade;
        pixels[offset + 2] = shade;
        pixels[offset + 3] = x === 0 ? 0 : x === 1 ? 128 : 255;
      }
    }
    await sharp(pixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(sourcePath);
    await sharp(glassPixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(glassEffectPath);
    await sharp(textPixels, { raw: { channels: 4, height, width } })
      .png()
      .toFile(textPath);

    try {
      const generated = await generateThemeIconBackgrounds({
        glassEffectPath,
        logger: { log: () => undefined },
        outputDirectory,
        sourcePath,
        textPath,
      });

      expect(generated.map((file) => path.basename(file))).toEqual(
        THEME_IDS.map((themeId) => `icon-bg-${themeId}.png`)
      );

      const sampleColors: number[][] = [];
      for (const file of generated) {
        const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
        expect(info).toMatchObject({ channels: 4, height, width });
        expect(data[3]).toBe(0);
        expect(data[7]).toBe(128);
        sampleColors.push([...data.subarray((4 * width + 6) * 4, (4 * width + 6) * 4 + 3)]);

        const top = [...data.subarray((1 * width + 6) * 4, (1 * width + 6) * 4 + 3)];
        const bottom = [...data.subarray((6 * width + 6) * 4, (6 * width + 6) * 4 + 3)];
        expect(top).not.toEqual(bottom);
      }

      expect(new Set(sampleColors.map((color) => color.join(','))).size).toBe(THEME_IDS.length);
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
