import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import sharp from 'sharp';

const { compressBlogImages, TARGET_WIDTH } = require('../compress-blog-images') as {
  TARGET_WIDTH: number;
  compressBlogImages: (options: {
    logger: { log: (message: string) => void };
    postsDirectory: string;
    publicDirectory: string;
  }) => Promise<{
    conversions: { imageUrl: string; outputUrl: string }[];
    imageCount: number;
    skipped: { imageUrl: string }[];
  }>;
};

describe('compress-blog-images', () => {
  let directory: string;
  let postsDirectory: string;
  let publicDirectory: string;
  let imagesDirectory: string;

  beforeEach(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'musclog-compress-blog-images-'));
    postsDirectory = path.join(directory, 'posts');
    publicDirectory = path.join(directory, 'public');
    imagesDirectory = path.join(publicDirectory, 'images', 'blog', '2026', '08');
    await mkdir(path.join(postsDirectory, '2026', '08'), { recursive: true });
    await mkdir(imagesDirectory, { recursive: true });
  });

  afterEach(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  it('converts worthwhile images, updates every reference, and leaves smaller PNGs alone', async () => {
    const largeImagePath = path.join(imagesDirectory, 'large.png');
    const smallImagePath = path.join(imagesDirectory, 'pixel-art.png');
    await sharp({
      create: {
        background: { b: 80, g: 40, r: 20 },
        channels: 3,
        height: 1000,
        width: 2000,
      },
    })
      .png({ compressionLevel: 0 })
      .toFile(largeImagePath);

    const width = 160;
    const height = 144;
    const pixels = Buffer.alloc(width * height * 3);
    const colors = [
      [15, 56, 15],
      [48, 98, 48],
      [139, 172, 15],
      [155, 188, 15],
    ];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const color = colors[(Math.floor(x / 8) + Math.floor(y / 8)) % colors.length];
        const offset = (y * width + x) * 3;
        pixels[offset] = color[0];
        pixels[offset + 1] = color[1];
        pixels[offset + 2] = color[2];
      }
    }
    await sharp(pixels, { raw: { channels: 3, height, width } })
      .png({ colours: colors.length, compressionLevel: 9, effort: 10, palette: true })
      .toFile(smallImagePath);

    const firstPost = path.join(postsDirectory, '2026', '08', 'first.md');
    const secondPost = path.join(postsDirectory, '2026', '08', 'second.md');
    await writeFile(
      firstPost,
      [
        '![Large](/images/blog/2026/08/large.png)',
        '![Pixel art](/images/blog/2026/08/pixel-art.png)',
      ].join('\n')
    );
    await writeFile(secondPost, '![Large again](/images/blog/2026/08/large.png)\n');

    const result = await compressBlogImages({
      logger: { log: () => undefined },
      postsDirectory,
      publicDirectory,
    });

    expect(result.imageCount).toBe(2);
    expect(result.conversions.map(({ imageUrl }) => imageUrl)).toEqual([
      '/images/blog/2026/08/large.png',
    ]);
    expect(result.skipped.map(({ imageUrl }) => imageUrl)).toEqual([
      '/images/blog/2026/08/pixel-art.png',
    ]);
    await expect(access(largeImagePath)).rejects.toThrow();
    await expect(access(smallImagePath)).resolves.toBeUndefined();

    const outputPath = path.join(imagesDirectory, 'large.webp');
    const metadata = await sharp(outputPath).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: TARGET_WIDTH });
    await expect(readFile(firstPost, 'utf8')).resolves.toContain('/images/blog/2026/08/large.webp');
    await expect(readFile(firstPost, 'utf8')).resolves.toContain(
      '/images/blog/2026/08/pixel-art.png'
    );
    await expect(readFile(secondPost, 'utf8')).resolves.toContain(
      '/images/blog/2026/08/large.webp'
    );

    const secondRun = await compressBlogImages({
      logger: { log: () => undefined },
      postsDirectory,
      publicDirectory,
    });
    expect(secondRun.conversions).toHaveLength(0);
  });

  it('fails when a referenced local image is missing', async () => {
    await writeFile(
      path.join(postsDirectory, '2026', '08', 'broken.md'),
      '![Missing](/images/blog/2026/08/missing.png)\n'
    );

    await expect(
      compressBlogImages({
        logger: { log: () => undefined },
        postsDirectory,
        publicDirectory,
      })
    ).rejects.toThrow('Blog image does not exist: /images/blog/2026/08/missing.png');
  });
});
