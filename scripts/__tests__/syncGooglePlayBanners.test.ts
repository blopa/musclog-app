import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sharp = require('sharp');

const { LOCALES, TARGET_HEIGHT, TARGET_WIDTH, aspectProblem, planSync, renderFeatureGraphic } =
  require('../sync-google-play-banners') as {
    LOCALES: string[];
    TARGET_HEIGHT: number;
    TARGET_WIDTH: number;
    aspectProblem: (width: number, height: number) => string | null;
    planSync: (
      locales: string[],
      options?: { bannerDir: string; listingDir: string }
    ) => Promise<{ locale: string; source: string; target: string; image: Buffer }[]>;
    renderFeatureGraphic: (source: string | Buffer) => Promise<Buffer>;
  };
const { PLAY_LOCALES } = require('../google-play-phone-screenshots') as {
  PLAY_LOCALES: Record<string, string>;
};

const ROOT = path.join(__dirname, '..', '..');

async function solidPng(width: number, height: number, alpha = 1) {
  return sharp({
    create: { width, height, channels: 4, background: { r: 20, g: 120, b: 100, alpha } },
  })
    .png()
    .toBuffer();
}

describe('Play feature graphic from the banner', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'play-banners-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('covers exactly the Play listing locales', () => {
    expect([...LOCALES].sort()).toEqual(Object.values(PLAY_LOCALES).sort());
  });

  it('renders 1024x500 with no alpha channel, even from a translucent source', async () => {
    const image = await renderFeatureGraphic(await solidPng(1920, 905, 0.5));
    const meta = await sharp(image).metadata();

    expect([meta.width, meta.height]).toEqual([TARGET_WIDTH, TARGET_HEIGHT]);
    expect(meta.format).toBe('png');
    expect(meta.hasAlpha).toBe(false);
    expect(meta.channels).toBe(3);
  });

  it('trims the sides evenly instead of stretching', async () => {
    // 1853 px wide at height 905 is exactly 1024:500, so a coloured 100 px edge on each side of a
    // 1920 px source must be cropped away while the middle survives unscaled in proportion.
    const middle = await sharp({
      create: { width: 1720, height: 905, channels: 3, background: { r: 0, g: 200, b: 0 } },
    })
      .png()
      .toBuffer();
    const source = await sharp({
      create: { width: 1920, height: 905, channels: 3, background: { r: 255, g: 0, b: 0 } },
    })
      .composite([{ input: middle, left: 100, top: 0 }])
      .png()
      .toBuffer();

    const { data, info } = await sharp(await renderFeatureGraphic(source))
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixel = (x: number, y: number) => {
      const offset = (y * info.width + x) * info.channels;

      return [data[offset], data[offset + 1], data[offset + 2]];
    };

    // Red can only survive in the first/last ~18 px (the 33 px trim leaves 67 px of margin at
    // source scale, which is about 37 px here) - never in the middle.
    expect(pixel(512, 250)).toEqual([0, 200, 0]);
    expect(pixel(0, 250)[0]).toBeGreaterThan(200);
    expect(pixel(TARGET_WIDTH - 1, 250)[0]).toBeGreaterThan(200);
    expect(pixel(60, 250)).toEqual([0, 200, 0]);
  });

  it('refuses a banner whose ratio would cut artwork', () => {
    expect(aspectProblem(1920, 905)).toBeNull();
    expect(aspectProblem(1024, 500)).toBeNull();
    expect(aspectProblem(1920, 1080)).toContain('1.78:1');
    expect(aspectProblem(2400, 905)).toContain('2.65:1');
  });

  it('names a missing banner and an unknown locale, and plans nothing', async () => {
    await expect(planSync(['en-US'], { bannerDir: dir, listingDir: dir })).rejects.toThrow(
      /missing .*en-US.*banner\.png; run npm run generate-banners en-US/
    );
    await expect(planSync(['fr-FR'], { bannerDir: dir, listingDir: dir })).rejects.toThrow(
      /unknown locale fr-FR/
    );
  });

  it('plans one feature graphic per locale under the listing images folder', async () => {
    for (const locale of ['en-US', 'pt-BR']) {
      fs.mkdirSync(path.join(dir, 'banner', locale), { recursive: true });
      fs.writeFileSync(path.join(dir, 'banner', locale, 'banner.png'), await solidPng(1920, 905));
    }

    const plan = await planSync(['en-US', 'pt-BR'], {
      bannerDir: path.join(dir, 'banner'),
      listingDir: path.join(dir, 'metadata'),
    });

    expect(plan.map((entry) => entry.target)).toEqual([
      path.join(dir, 'metadata', 'en-US', 'images', 'featureGraphic.png'),
      path.join(dir, 'metadata', 'pt-BR', 'images', 'featureGraphic.png'),
    ]);
  });

  it('accepts the committed banners', async () => {
    const bannerDir = path.join(ROOT, 'screenshots', 'banner');
    if (!LOCALES.every((locale) => fs.existsSync(path.join(bannerDir, locale, 'banner.png')))) {
      return;
    }

    const plan = await planSync(LOCALES);

    expect(plan).toHaveLength(LOCALES.length);
  });
});
