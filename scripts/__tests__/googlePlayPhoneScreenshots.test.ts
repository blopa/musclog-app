import fs from 'node:fs';
import path from 'node:path';

const {
  DESIGN,
  OUTPUT_WIDTH,
  PLAY_LOCALES,
  SCREEN_SHAPES,
  deinlineProject,
  designLocales,
  designProblems,
  inlineDesign,
  listingPathFor,
  projectForLocale,
  resolveOsgCommand,
  screenPadding,
} = require('../google-play-phone-screenshots') as {
  DESIGN: string;
  OUTPUT_WIDTH: number;
  PLAY_LOCALES: Record<string, string>;
  SCREEN_SHAPES: Record<string, Shape>;
  deinlineProject: (
    project: Design,
    refsByHash: Map<string, string>
  ) => { design: Design; embedded: number };
  designLocales: (design: Design) => string[];
  designProblems: (design: Design) => string[];
  inlineDesign: (design: Design) => Promise<{ project: Design; refsByHash: Map<string, string> }>;
  listingPathFor: (filename: string, locale: string) => string | null;
  projectForLocale: (design: Design, locale: string) => Design;
  resolveOsgCommand: (
    dir: string,
    version: string,
    exists?: (file: string) => boolean
  ) => { command: string; args: string[]; source: string };
  screenPadding: (
    width: number,
    height: number,
    shape: Shape
  ) => { top: number; bottom: number; left: number; right: number };
};

type Shape = { width: number; height: number; cameraBottom: number };

type Element = {
  id: string;
  type: string;
  content?: string;
  fontSize?: number;
  deviceType?: string;
  screenshotSrc?: string;
};

type Board = {
  size: { width: number; height: number };
  backgroundImage?: string;
  backgroundImageApply?: string;
  elements: Element[];
  localized: Record<string, Record<string, Record<string, unknown>>>;
  localization: { baseLocale: string; locales: Array<{ code: string; autoFont?: boolean }> };
  [key: string]: unknown;
};

type Design = {
  fonts: Array<{ id: string; family: string }>;
  projectData: Board[];
  fontData?: unknown;
  [key: string]: unknown;
};

const METADATA_DIR = path.join(__dirname, '..', '..', 'android', 'play', 'metadata');

function loadCommitted(): Design {
  return JSON.parse(fs.readFileSync(DESIGN, 'utf8')) as Design;
}

describe('google-play-phone-screenshots composer', () => {
  const committed = loadCommitted();
  const clone = () => structuredClone(committed);

  it('accepts the committed design', () => {
    expect(designProblems(committed)).toEqual([]);
  });

  it('covers every Play listing locale that carries phone screenshots', () => {
    const mapped = designLocales(committed)
      .map((locale) => PLAY_LOCALES[locale])
      .sort();
    // The listing-only languages (de-DE, fr-FR, ...) have text but no images folder, so the
    // design covers exactly the locales whose listing holds phone screenshots.
    const listing = fs
      .readdirSync(METADATA_DIR)
      .filter((locale) =>
        fs.existsSync(path.join(METADATA_DIR, locale, 'images', 'phoneScreenshots'))
      )
      .sort();
    expect(mapped).toEqual(listing);
  });

  it('points each language at its own Play capture folder', () => {
    const [base, ...others] = designLocales(committed);
    for (const board of committed.projectData) {
      const phone = board.elements.find((element) => element.type === 'device');
      expect(phone?.screenshotSrc).toMatch(
        new RegExp(`^musclog:google-play/phone/${PLAY_LOCALES[base]}/`)
      );
      for (const locale of others) {
        expect(board.localized[locale].phone.screenshotSrc).toMatch(
          new RegExp(`^musclog:google-play/phone/${PLAY_LOCALES[locale]}/`)
        );
      }
    }
  });

  it('spans one shared backdrop across every board', () => {
    for (const board of committed.projectData) {
      expect(board.backgroundImage).toBe('musclog:google-play/phone-background.svg');
      expect(board.backgroundImageApply).toBe('span');
    }
  });

  describe('rejects broken designs', () => {
    it('rejects more than the 8 Play screenshots', () => {
      const copy = clone();
      copy.projectData.push(structuredClone(copy.projectData[0]));
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('at most 8')])
      );
    });

    it('rejects a board narrower than the output width', () => {
      const copy = clone();
      copy.projectData[0].size = { width: 800, height: 1422 };
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining(`at least ${OUTPUT_WIDTH} px wide`)])
      );
    });

    it('rejects a 1:3 aspect ratio', () => {
      const copy = clone();
      copy.projectData[0].size = { width: 2160, height: 6480 };
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining("breaks Play's phone screenshot size rules"),
        ])
      );
    });

    it('rejects a language with no Play locale', () => {
      const copy = clone();
      for (const board of copy.projectData) {
        board.localization.locales.push({ code: 'de-DE' });
      }

      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('language "de-DE" has no Play locale')])
      );
    });

    it('rejects a board missing a localized text', () => {
      const copy = clone();
      delete copy.projectData[0].localized['ru'].headline.content;
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining('artboard 1: "headline" has no "ru" text')])
      );
    });

    it('rejects a board missing a localized capture', () => {
      const copy = clone();
      delete copy.projectData[2].localized['es-ES'].phone.screenshotSrc;
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('artboard 3: phone "phone" has no "es-ES" capture'),
        ])
      );
    });

    it('rejects a reference to a file that does not exist', () => {
      const copy = clone();
      const ref = 'musclog:google-play/phone/en-US/does-not-exist.png';
      copy.projectData[0].elements.find((element) => element.type === 'device')!.screenshotSrc =
        ref;
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([expect.stringContaining(`  ${ref}`)])
      );
    });

    it('rejects references outside screenshots/', () => {
      const copy = clone();
      const ref = 'musclog:../package.json';
      copy.projectData[0].elements.find((element) => element.type === 'device')!.screenshotSrc =
        ref;
      const problems = designProblems(copy);
      expect(problems).toEqual(
        expect.arrayContaining([expect.stringContaining('shows no capture')])
      );
      expect(problems).toEqual(expect.arrayContaining([expect.stringContaining(`  ${ref}`)]));
    });

    it('rejects a font with no source', () => {
      const copy = clone();
      copy.fonts[0].family = 'Comic Sans';
      expect(designProblems(copy)).toEqual(
        expect.arrayContaining([
          expect.stringContaining('font "Comic Sans" has no source in FONT_SOURCES'),
        ])
      );
    });
  });

  describe('screenPadding', () => {
    const shape = SCREEN_SHAPES['pixel-10-pro'];

    it('gives the capture the screen proportions with a camera band on top', () => {
      const pad = screenPadding(1080, 2340, shape);
      const width = 1080 + pad.left + pad.right;
      const height = 2340 + pad.top + pad.bottom;
      expect(Math.abs(width - height * (shape.width / shape.height))).toBeLessThanOrEqual(1);
      expect(pad.top).toBeGreaterThanOrEqual(Math.floor(shape.cameraBottom * height));
      expect(pad.top / height).toBeGreaterThanOrEqual(shape.cameraBottom - 1e-9);
    });

    it('grows the bottom, not the sides, for a capture wider than the screen', () => {
      const pad = screenPadding(1500, 2340, shape);
      expect(pad.left).toBe(0);
      expect(pad.right).toBe(0);
      expect(pad.bottom).toBeGreaterThan(0);
      const width = 1500;
      const height = 2340 + pad.top + pad.bottom;
      expect(Math.abs(width - height * (shape.width / shape.height))).toBeLessThanOrEqual(1);
    });
  });

  describe('listingPathFor', () => {
    it('maps a render output to the numbered listing file', () => {
      const target = listingPathFor('03_Food_details_Android_2160x3840.png', 'ru');
      expect(
        target?.endsWith(path.join('android/play/metadata/ru-RU/images/phoneScreenshots/03.png'))
      ).toBe(true);
    });

    it('returns null for an unknown name or locale', () => {
      expect(listingPathFor('food.png', 'ru')).toBeNull();
      expect(listingPathFor('03_Food.jpg', 'ru')).toBeNull();
      expect(listingPathFor('03_Food_2160x3840.png', 'de')).toBeNull();
    });
  });

  describe('resolveOsgCommand', () => {
    it('uses the built checkout when it has a CLI', () => {
      const cli = path.join('/work/osg', 'cli', 'dist', 'cli.js');
      const result = resolveOsgCommand('/work/osg', '1.0.8', (file) => file === cli);
      expect(result.command).toBe(process.execPath);
      expect(result.args).toEqual([cli]);
    });

    it('falls back to the published package through npx', () => {
      const result = resolveOsgCommand('/work/osg', '1.0.8', () => false);
      expect(result.command).toMatch(/^npx(\.cmd)?$/);
      expect(result.args).toEqual(['-y', 'open-screenshot-generator@1.0.8']);
      expect(result.source).toContain('/work/osg');
    });
  });

  describe('projectForLocale', () => {
    it('renders a language as the only one, with its own text and capture', () => {
      const project = projectForLocale(committed, 'ru');
      for (const [index, board] of project.projectData.entries()) {
        const source = committed.projectData[index];
        expect(board.localization).toEqual({ baseLocale: 'ru', locales: [] });
        expect(board).not.toHaveProperty('localized');
        const headline = board.elements.find((element) => element.id === 'headline');
        expect(headline?.content).toBe(source.localized.ru.headline.content);
        const phone = board.elements.find((element) => element.type === 'device');
        expect(phone?.screenshotSrc).toBe(source.localized.ru.phone.screenshotSrc);
      }
    });

    it('leaves the base language as authored', () => {
      const project = projectForLocale(committed, 'en-US');
      expect(project.projectData.map((board) => board.elements)).toEqual(
        committed.projectData.map((board) => board.elements)
      );
    });

    it('applies a detached property only when the override detaches it, and drops hidden ones', () => {
      const copy = clone();
      const overrides = copy.projectData[0].localized['es-ES'];
      overrides.headline.fontSize = 30;
      overrides.subheadline = { ...overrides.subheadline, fontSize: 20, detached: ['fontSize'] };
      overrides.phone.hidden = true;
      const [board] = projectForLocale(copy, 'es-ES').projectData;
      const byId = (id: string) => board.elements.find((element) => element.id === id);
      expect(byId('headline')?.fontSize).toBe(45);
      expect(byId('subheadline')?.fontSize).toBe(20);
      expect(byId('phone')).toBeUndefined();
    });
  });

  describe('inlining', () => {
    const oneBoard = () => {
      const copy = clone();
      copy.projectData = [copy.projectData[0]];
      return copy;
    };

    it('round-trips through the data URLs back to the committed form', async () => {
      const design = oneBoard();
      const { project, refsByHash } = await inlineDesign(design);
      expect(JSON.stringify(project.projectData)).not.toContain('musclog:');
      const phone = project.projectData[0].elements.find((element) => element.type === 'device');
      expect(phone?.screenshotSrc?.startsWith('data:image/png;base64,')).toBe(true);

      const result = deinlineProject(
        { ...project, fontData: { 'manrope-800': 'AAAA' } },
        refsByHash
      );
      expect(result.design.projectData).toEqual(design.projectData);
      expect(result.embedded).toBe(0);
      expect(result.design).not.toHaveProperty('fontData');
    }, 60000);

    it('keeps an image added by hand and counts it as embedded', async () => {
      const { project, refsByHash } = await inlineDesign(oneBoard());
      const handMade = 'data:image/png;base64,AAAA';
      project.projectData[0].extra = handMade;
      const result = deinlineProject(project, refsByHash);
      expect(result.design.projectData[0].extra).toBe(handMade);
      expect(result.embedded).toBe(1);
    }, 60000);
  });
});
