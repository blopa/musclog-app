import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sharp = require('sharp');

type Entry = { headline: string[]; bullets: string[] };
type Measure = (
  text: string,
  style: { family: string; size: number; weight: string; spacing: number }
) => Promise<number>;

const {
  LOCALES,
  applyCopy,
  displayText,
  embedScreenshot,
  fitFontSize,
  generateBanner,
  readCopy,
  validateCopy,
  withExplicitSize,
} = require('../generate-banners') as {
  LOCALES: string[];
  applyCopy: (
    svg: string,
    entry: Entry,
    locale: string,
    measure?: Measure
  ) => Promise<{ svg: string; headlineSize: number; bulletSize: number }>;
  displayText: (text: string, locale: string) => string;
  embedScreenshot: (svg: string, dataUri: string) => string;
  fitFontSize: (options: {
    lines: string[];
    baseSize: number;
    maxWidth: number;
    minSize: number;
    measure: (text: string, size: number) => Promise<number>;
  }) => Promise<number>;
  generateBanner: (
    locale: string,
    options: { screenshotsDir: string; outputDir: string }
  ) => Promise<{ output: string }>;
  readCopy: () => Record<string, Entry>;
  validateCopy: (copy: Record<string, unknown>, locales?: string[]) => string[];
  withExplicitSize: (svg: string) => string;
};
const { PLAY_LOCALES } = require('../google-play-phone-screenshots') as {
  PLAY_LOCALES: Record<string, string>;
};

const ROOT = path.join(__dirname, '..', '..');
const BACKGROUND = fs.readFileSync(path.join(ROOT, 'assets', 'banner-background.svg'), 'utf8');
// A glyph is 0.6 of the font size wide; letter spacing is ignored.
const fakeMeasure: Measure = async (text, { size }) => text.length * size * 0.6;

describe('banner copy', () => {
  it('covers exactly the Play listing locales', () => {
    expect([...LOCALES].sort()).toEqual(Object.values(PLAY_LOCALES).sort());
  });

  it('is complete in the committed file', () => {
    expect(validateCopy(readCopy())).toEqual([]);
  });

  it('names a missing locale, a wrong line count and an empty line', () => {
    const copy = {
      'en-US': { headline: ['One'], bullets: ['a', 'b', 'c', 'd'] },
      'es-ES': { headline: ['Uno', 'Dos'], bullets: ['a', ' ', 'c', 'd'] },
    };

    expect(validateCopy(copy, ['en-US', 'es-ES', 'nl-NL'])).toEqual([
      'en-US.headline: expected 2 lines',
      'es-ES.bullets: empty line',
      'nl-NL: no copy',
    ]);
  });

  it("uppercases with the locale's own rules", () => {
    expect(displayText(' nutrición ', 'es-ES')).toBe('NUTRICIÓN');
    expect(displayText('профи', 'ru-RU')).toBe('ПРОФИ');
    // Turkish-style casing must not leak into other locales.
    expect(displayText('i', 'en-US')).toBe('I');
  });
});

describe('fitFontSize', () => {
  const measure = async (text: string, size: number) => text.length * size;

  it('keeps the artwork size when every line fits', async () => {
    const size = await fitFontSize({
      lines: ['abcd', 'ab'],
      baseSize: 10,
      maxWidth: 40,
      minSize: 5,
      measure,
    });

    expect(size).toBe(10);
  });

  it('shrinks to the widest line and never overshoots', async () => {
    const size = await fitFontSize({
      lines: ['abcd', 'abcdefgh'],
      baseSize: 10,
      maxWidth: 40,
      minSize: 3,
      measure,
    });

    expect(size).toBe(5);
    expect(8 * size).toBeLessThanOrEqual(40);
  });

  it('refuses to go below the floor and names the line', async () => {
    await expect(
      fitFontSize({
        lines: ['a very long line'],
        baseSize: 10,
        maxWidth: 40,
        minSize: 8,
        measure,
      })
    ).rejects.toThrow(/"a very long line" needs 2\.5px, below the 8px floor/);
  });
});

describe('applyCopy', () => {
  const entry: Entry = {
    headline: ['Short one', 'Second & last'],
    bullets: ['Log <reps> & weights', 'Two', 'Three', 'Four'],
  };

  it('writes the copy in capitals and escapes markup', async () => {
    const { svg } = await applyCopy(BACKGROUND, entry, 'en-US', fakeMeasure);

    expect(svg).toContain('>SHORT ONE</tspan>');
    expect(svg).toContain('>SECOND &amp; LAST</tspan>');
    expect(svg).toContain('>• LOG &lt;REPS&gt; &amp; WEIGHTS</text>');
    expect(svg).not.toContain('TRACK YOUR WORKOUTS');
    expect(svg).not.toContain('LOG REPS &amp; WEIGHTS');
  });

  it('keeps the artwork size and the line positions when the copy fits', async () => {
    const { svg, headlineSize, bulletSize } = await applyCopy(
      BACKGROUND,
      entry,
      'en-US',
      fakeMeasure
    );

    expect(headlineSize).toBe(67);
    expect(bulletSize).toBe(31);
    expect(svg).toContain('<tspan x="490" y="312">');
    expect(svg).toContain('<text x="858" y="586">');
  });

  it('shrinks the text and its letter spacing together when a line is too long', async () => {
    const long: Entry = {
      headline: ['A somewhat longer headline!!', 'short'],
      bullets: entry.bullets,
    };
    const { svg, headlineSize, bulletSize } = await applyCopy(
      BACKGROUND,
      long,
      'en-US',
      fakeMeasure
    );

    expect(headlineSize).toBeLessThan(67);
    expect(bulletSize).toBe(31);
    expect(svg).toContain(`id="banner-headline" font-size="${headlineSize}"`);
    expect(svg).toMatch(/letter-spacing="0\.\d+"/);
    // The widest line still ends before the phone frame (x=1460).
    expect(490 + 'A SOMEWHAT LONGER HEADLINE!!'.length * headlineSize * 0.6).toBeLessThanOrEqual(
      1410
    );
  });

  it('fails loudly when the artwork lost an id or a line', async () => {
    await expect(
      applyCopy(BACKGROUND.replace('id="banner-headline"', ''), entry, 'en-US', fakeMeasure)
    ).rejects.toThrow('no <text id="banner-headline">');
    await expect(
      applyCopy(
        BACKGROUND.replace(/<text x="858" y="586">[^<]*<\/text>/, ''),
        entry,
        'en-US',
        fakeMeasure
      )
    ).rejects.toThrow('#banner-bullets needs 4 <text>s, found 3');
  });
});

describe('embedScreenshot', () => {
  it('replaces the white screen with a clipped image of the same box', () => {
    const svg = embedScreenshot(BACKGROUND, 'data:image/png;base64,AAAA');

    expect(svg).not.toContain('id="phone-screen"');
    expect(svg).toContain('href="data:image/png;base64,AAAA"');
    expect(svg).toContain('clip-path="url(#phone-screen-clip)"');
    expect(svg).toContain(
      '<clipPath id="phone-screen-clip"><rect x="312" y="87" width="376" height="822" rx="49" />'
    );
  });

  it('fails when the marker is gone', () => {
    expect(() => embedScreenshot(BACKGROUND.replace('id="phone-screen"', ''), 'x')).toThrow(
      'no <rect id="phone-screen">'
    );
  });

  it('gives the root the viewBox size', () => {
    expect(withExplicitSize(BACKGROUND)).toMatch(/<svg [^>]*width="1920" height="905"/);
  });
});

describe('generateBanner', () => {
  let directory: string;

  beforeAll(async () => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'musclog-banner-'));
    for (const locale of LOCALES) {
      const screenshots = path.join(directory, 'screens', locale);
      fs.mkdirSync(screenshots, { recursive: true });
      // A plain red screen: the colour proves the screenshot is the one inside the phone.
      await sharp({
        create: { width: 1080, height: 2340, channels: 3, background: '#ff0000' },
      })
        .png()
        .toFile(path.join(screenshots, '01-home.png'));
    }
  });

  afterAll(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each(LOCALES)('renders %s with the screenshot inside the phone', async (locale) => {
    const { output } = await generateBanner(locale, {
      screenshotsDir: path.join(directory, 'screens'),
      outputDir: path.join(directory, 'out'),
    });
    const image = sharp(output);
    const { width, height } = await image.metadata();
    const pixel = await image
      .extract({ left: 1714, top: 425, width: 1, height: 1 })
      .raw()
      .toBuffer();

    expect([width, height]).toEqual([1920, 905]);
    expect(pixel[0]).toBeGreaterThan(220);
    expect(pixel[1]).toBeLessThan(40);
    expect(pixel[2]).toBeLessThan(40);
  });

  it('says how to capture a missing screenshot', async () => {
    await expect(
      generateBanner('en-US', {
        screenshotsDir: path.join(directory, 'nowhere'),
        outputDir: path.join(directory, 'out'),
      })
    ).rejects.toThrow('screenshots:google-play-phone:capture');
  });
});
