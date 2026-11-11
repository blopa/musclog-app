import fs from 'node:fs';
import path from 'node:path';

const { OUTPUT_WIDTH, PLAY_LOCALES, SNAPSHOT, snapshotProblems, snapshotSources } =
  require('../google-play-phone-screenshots') as {
    OUTPUT_WIDTH: number;
    PLAY_LOCALES: Record<string, string>;
    SNAPSHOT: string;
    snapshotProblems: (snapshot: Snapshot) => string[];
    snapshotSources: (snapshot: Snapshot) => string[];
  };

type Snapshot = {
  projectLanguages: string[];
  outputDevice: string;
  customWidth: number;
  customHeight: number;
  screenshots: Array<{
    localizedImages: Record<string, { src: string; name: string }>;
    text: { headlineEnabled?: boolean; headlines: Record<string, string> };
    elements?: Array<{ type: string; src?: string; x?: number; width?: number }>;
  }>;
};

const METADATA_DIR = path.join(__dirname, '..', '..', 'android', 'play', 'metadata');

function loadCommitted(): Snapshot {
  return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')) as Snapshot;
}

describe('google-play-phone-screenshots composer', () => {
  const committed = loadCommitted();
  const clone = () => structuredClone(committed);

  it('accepts the committed snapshot', () => {
    expect(snapshotProblems(committed)).toEqual([]);
  });

  it('covers every Play listing locale', () => {
    const mapped = committed.projectLanguages.map((lang) => PLAY_LOCALES[lang]).sort();
    const listing = fs.readdirSync(METADATA_DIR).sort();
    expect(mapped).toEqual(listing);
  });

  it('points each language at its own Play capture folder', () => {
    for (const screenshot of committed.screenshots) {
      for (const lang of committed.projectLanguages) {
        expect(screenshot.localizedImages[lang].src).toMatch(
          new RegExp(`^musclog/screenshots/google-play/phone/${PLAY_LOCALES[lang]}/`)
        );
      }
    }
  });

  it('places one shared backdrop slice per slide across the panorama', () => {
    const count = committed.screenshots.length;
    committed.screenshots.forEach((screenshot, index) => {
      const graphics = (screenshot.elements ?? []).filter((el) => el.type === 'graphic');
      expect(graphics).toHaveLength(1);
      expect(graphics[0].src).toBe('musclog/screenshots/google-play/phone-background.svg');
      expect(graphics[0].width).toBe(100 * count);
      expect(graphics[0].x).toBe(100 * (count / 2) - 100 * index);
    });
  });

  describe('rejects broken snapshots', () => {
    it('rejects more than the 8 Play screenshots', () => {
      const copy = clone();
      copy.screenshots.push(structuredClone(copy.screenshots[0]));
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('at most 8')])
      );
    });

    it('rejects a non-custom or too narrow output size', () => {
      const device = clone();
      device.outputDevice = 'iphone';
      expect(snapshotProblems(device)).toEqual(
        expect.arrayContaining([expect.stringContaining(`at least ${OUTPUT_WIDTH} px wide`)])
      );

      const narrow = clone();
      narrow.customWidth = 800;
      expect(snapshotProblems(narrow)).toEqual(
        expect.arrayContaining([expect.stringContaining(`at least ${OUTPUT_WIDTH} px wide`)])
      );
    });

    it('rejects a 1:3 aspect ratio', () => {
      const copy = clone();
      copy.customWidth = 2160;
      copy.customHeight = 6480;
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("breaks Play's phone screenshot size rules"),
        ])
      );
    });

    it('rejects a language with no Play locale', () => {
      const copy = clone();
      copy.projectLanguages.push('de');
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('language "de" has no Play locale')])
      );
    });

    it('rejects a screenshot missing a language image', () => {
      const copy = clone();
      delete copy.screenshots[2].localizedImages.es;
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('screenshot 3 has no "es" image')])
      );
    });

    it('rejects a screenshot missing a language headline', () => {
      const copy = clone();
      delete copy.screenshots[0].text.headlines.ru;
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('screenshot 1 has no "ru" headline')])
      );
    });

    it('rejects an image src that does not exist on disk', () => {
      const copy = clone();
      copy.screenshots[0].localizedImages.en.src =
        'musclog/screenshots/google-play/phone/en-US/does-not-exist.png';
      expect(snapshotProblems(copy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('musclog/screenshots/google-play/phone/en-US/does-not-exist.png'),
        ])
      );
    });

    it('rejects sources outside musclog/screenshots/', () => {
      for (const src of ['musclog/../package.json', 'index.html']) {
        const copy = clone();
        copy.screenshots[0].localizedImages.en.src = src;
        expect(snapshotProblems(copy)).toEqual(
          expect.arrayContaining([expect.stringContaining(`  ${src}`)])
        );
      }
    });
  });

  it('accepts an uploaded data URL image without looking for a file', () => {
    const copy = clone();
    copy.screenshots[0].localizedImages.en.src = 'data:image/png;base64,AAAA';
    expect(snapshotSources(copy)).toContain('data:image/png;base64,AAAA');
    expect(snapshotProblems(copy).join('\n')).not.toContain('data:');
  });
});
