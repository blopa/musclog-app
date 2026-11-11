import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'promo-video', 'src');

const { CAPTURE_HEIGHT, CAPTURE_WIDTH, CARDS, LOGGY_POSES, SCREENS, THEME_IDS, outputs, sources } =
  require('../../promo-video/scripts/prepare-assets.js') as {
    CAPTURE_HEIGHT: number;
    CAPTURE_WIDTH: number;
    CARDS: Record<string, [string, [number, number, number, number]]>;
    LOGGY_POSES: string[];
    SCREENS: Record<string, string>;
    THEME_IDS: string[];
    outputs: () => string[];
    sources: () => string[];
  };
const registry = require('../../theme.registry.js') as { THEME_IDS: string[] };

// Files the video references that scripts/gen-music.js writes rather than prepare-assets.js.
const MUSIC = 'music.wav';

const listSources = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSources(full);
    }

    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });

const read = (file: string) => fs.readFileSync(path.join(SRC, file), 'utf8');
const allSource = listSources(SRC)
  .map((file) => fs.readFileSync(file, 'utf8'))
  .join('\n');

const matches = (text: string, pattern: RegExp) => [...text.matchAll(pattern)].map((m) => m[1]);

const readThemes = (): string[] => {
  const literal = /const THEMES\s*=\s*\[([^\]]*)\]/.exec(read('scenes/Themes.tsx'));

  return literal ? matches(literal[1], /["']([^"']+)["']/g) : [];
};

const referencedAssets = () => {
  const themes = readThemes();

  return {
    screens: [
      ...matches(allSource, /["'](screens\/[^"'$`]+\.png)["']/g),
      ...themes.map((id) => `screens/theme-kinetic-${id}.png`),
    ],
    cards: matches(allSource, /<FloatCard[^>]*\bsrc="([^"]+)"/g).map((name) => `cards/${name}.png`),
    poses: matches(allSource, /<Loggy\b[^>]*\bpose="([^"]+)"/g).map(
      (pose) => `loggy/loggy-${pose}.svg`
    ),
    staticFiles: matches(allSource, /staticFile\(\s*["']([^"']+)["']\s*\)/g),
  };
};

describe('promo video assets', () => {
  it('has every repository source file the preparation step reads', () => {
    const missing = sources().filter((file) => !fs.existsSync(path.join(ROOT, file)));

    expect(sources().length).toBeGreaterThan(0);
    expect(missing).toEqual([]);
  });

  it('cuts every card from inside its screen', () => {
    expect(Object.keys(CARDS).length).toBeGreaterThan(0);

    for (const [name, [screen, [left, top, right, bottom]]] of Object.entries(CARDS)) {
      expect({ name, known: Object.keys(SCREENS).includes(screen) }).toEqual({ name, known: true });
      expect({ name, ok: left >= 0 && top >= 0 && right > left && bottom > top }).toEqual({
        name,
        ok: true,
      });
      expect({ name, ok: right <= CAPTURE_WIDTH && bottom <= CAPTURE_HEIGHT }).toEqual({
        name,
        ok: true,
      });
    }
  });

  it('references only screens the preparation step produces', () => {
    const { screens } = referencedAssets();

    expect(screens.length).toBeGreaterThan(0);
    expect(screens.filter((file) => !outputs().includes(file))).toEqual([]);
  });

  it('references only cards the preparation step produces', () => {
    const { cards } = referencedAssets();

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.filter((file) => !outputs().includes(file))).toEqual([]);
  });

  it('references only Loggy poses the preparation step produces', () => {
    const { poses } = referencedAssets();
    const union = /type LoggyPose =([^;]+);/.exec(read('components/Loggy.tsx'));
    const unionPoses = union ? matches(union[1], /["']([^"']+)["']/g) : [];

    expect(poses.length).toBeGreaterThan(0);
    expect(unionPoses.length).toBeGreaterThan(0);
    expect(poses.filter((file) => !outputs().includes(file))).toEqual([]);
    expect(unionPoses.filter((pose) => !LOGGY_POSES.includes(pose))).toEqual([]);
  });

  it('references only static files the video can find', () => {
    const { staticFiles } = referencedAssets();
    const known = [...outputs(), MUSIC];

    expect(staticFiles.length).toBeGreaterThan(0);
    expect(staticFiles.filter((file) => !known.includes(file))).toEqual([]);
  });

  it('shows exactly the known themes in the themes scene', () => {
    const themes = readThemes();

    expect(themes.length).toBeGreaterThan(0);
    expect(themes.filter((id) => !THEME_IDS.includes(id))).toEqual([]);
    expect([...themes].sort()).toEqual([...THEME_IDS].sort());
  });

  it('covers every theme of the app', () => {
    const appThemes = registry.THEME_IDS.map((id) => id.replace(/^kinetic-/, ''));

    expect([...THEME_IDS].sort()).toEqual([...appThemes].sort());
  });
});
