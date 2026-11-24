import path from 'node:path';

const sharp = require('sharp');

const {
  HEIGHT,
  ITEM_ICONS,
  WIDTH,
  copyProblems,
  imageCopyFor,
  lucideIconMarkup,
  renderSeoImage,
  screenshotFor,
} = require('../generate-seo-images') as {
  HEIGHT: number;
  ITEM_ICONS: Record<string, string>;
  lucideIconMarkup: (name: string) => string;
  WIDTH: number;
  copyProblems: (copy: unknown, language: string) => string[];
  imageCopyFor: (language: string) => unknown;
  renderSeoImage: (job: {
    language: string;
    copy: unknown;
    screenshotFile: string;
  }) => Promise<Buffer>;
  screenshotFor: (language: string, exists?: (file: string) => boolean) => string;
};
const { WEBSITE_LOCALES } = require('../../components/website/localeRoutes') as {
  WEBSITE_LOCALES: { prefix: string; language: string }[];
};

describe('generate-seo-images', () => {
  it('has copy for every website language, so no preview image is left in English', () => {
    for (const { language } of WEBSITE_LOCALES) {
      expect(copyProblems(imageCopyFor(language), language)).toEqual([]);
    }
  });

  it('names what is missing instead of drawing a half-empty image', () => {
    expect(copyProblems({ headline: 'x', items: { food: { title: ' ' } } }, 'de-DE')).toEqual(
      expect.arrayContaining([
        'de-DE: seo.image.subline is missing or empty',
        'de-DE: seo.image.items.food.title is missing or empty',
        'de-DE: seo.image.items.workouts.title is missing or empty',
      ])
    );
  });

  it("uses the language's own Home capture and falls back to English without one", () => {
    const exists = (file: string) => file.includes(`${path.sep}es-ES${path.sep}`);
    expect(screenshotFor('es-ES', exists)).toMatch(/es-ES[\\/]01-home\.png$/);
    expect(screenshotFor('tr-TR', exists)).toMatch(/en-US[\\/]01-home\.png$/);
  });

  it.each(Object.entries(ITEM_ICONS))("draws the %s item with lucide's %s icon", (_key, icon) => {
    const markup = lucideIconMarkup(icon);
    expect(markup).toMatch(/^<(path|circle|rect|line|polyline)\s/);
    expect(markup).not.toContain('key=');
  });

  it.each(['en-US', 'ru-RU', 'tr-TR'])('renders a 1200x630 JPEG for %s', async (language) => {
    const bytes = await renderSeoImage({
      language,
      copy: imageCopyFor(language),
      screenshotFile: screenshotFor(language),
    });
    const meta = await sharp(bytes).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', WIDTH, HEIGHT]);
  });

  it('refuses text too long for the image rather than shrinking it past reading size', async () => {
    const copy = JSON.parse(JSON.stringify(imageCopyFor('en-US')));
    copy.subline = 'very long words '.repeat(60);
    await expect(
      renderSeoImage({ language: 'en-US', copy, screenshotFile: screenshotFor('en-US') })
    ).rejects.toThrow(/does not fit/);
  });

  it('does not initialize fontconfig on require alone', () => {
    const prevFontConfig = process.env.FONTCONFIG_FILE;
    delete process.env.FONTCONFIG_FILE;
    try {
      jest.isolateModules(() => {
        const mod = require('../generate-seo-images') as {
          copyProblems: (copy: unknown, language: string) => string[];
        };
        expect(process.env.FONTCONFIG_FILE).toBeUndefined();
        expect(mod.copyProblems({}, 'en-US').length).toBeGreaterThan(0);
      });
    } finally {
      if (prevFontConfig !== undefined) {
        process.env.FONTCONFIG_FILE = prevFontConfig;
      }
    }
  });

  it('parses lucide icon nodes without regex fragility and rejects empty icons', () => {
    const { lucideIconMarkup: parseIcon } = require('../generate-seo-images') as {
      lucideIconMarkup: (name: string, readFile?: (file: string) => string) => string;
    };
    const fakeModule = [
      "var createLucideIcon = require('../createLucideIcon.js');",
      'exports.__iconNode = [',
      '  ["circle", { cx: 12, cy: 12, r: 10, "stroke-width": "2", key: "k1" }],',
      '  ["path", { d: "M1 1", label: "a\\"b", key: "k2" }]',
      '];',
    ].join('\n');

    expect(parseIcon('fake', () => fakeModule)).toBe(
      '<circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M1 1" label="a&quot;b"/>'
    );
    expect(() => parseIcon('empty', () => 'exports.__iconNode = [];')).toThrow(
      /has no drawable elements/
    );
  });

  it('renders multiple locales concurrently using shared memoized phone layers', async () => {
    const results = await Promise.all(
      ['en-US', 'tr-TR'].map((language) =>
        renderSeoImage({
          language,
          copy: imageCopyFor(language),
          screenshotFile: screenshotFor(language),
        })
      )
    );
    for (const bytes of results) {
      const meta = await sharp(bytes).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(['jpeg', WIDTH, HEIGHT]);
    }
  });
});
