import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { DEFAULT_THEME_BY_MODE, THEME_DEFINITIONS, THEME_IDS } from '@/theme.registry';

const {
  LOGGY_CLASSIC,
  LOGGY_COLORS_BY_THEME,
  LOGGY_COLOR_ROLES,
  THEMED_COLOR_PATTERN,
  THEMED_LOGGY_CLASSES,
  applyLoggyColors,
  loggyColorsForTheme,
  themedColor,
} = require('../loggyTheme') as {
  LOGGY_CLASSIC: Record<string, string>;
  LOGGY_COLORS_BY_THEME: Record<string, Record<string, string>>;
  LOGGY_COLOR_ROLES: string[];
  THEMED_COLOR_PATTERN: RegExp;
  THEMED_LOGGY_CLASSES: Record<string, string>;
  applyLoggyColors: (svg: string, colors: Record<string, string>) => string;
  loggyColorsForTheme: (themeId: string) => Record<string, string>;
  themedColor: (role: string) => string;
};

const PARTS = join(__dirname, '..', '..', 'assets', 'avatars', 'loggy-parts');
const INK = '#1b314d';

function linear(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => linear(parseInt(hex.slice(start, start + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Hue in degrees of an `#rrggbb` colour, enough to tell a pink log from a green one. */
function hue(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);

  if (delta === 0) {
    return 0;
  }

  const sector =
    max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;

  return (sector * 60 + 360) % 360;
}

function circularDistance(a: number, b: number): number {
  const difference = Math.abs(a - b) % 360;
  return Math.min(difference, 360 - difference);
}

describe('Loggy theme colours', () => {
  it('has an entry for every theme and nothing else', () => {
    expect(Object.keys(LOGGY_COLORS_BY_THEME).sort()).toEqual([...THEME_IDS].sort());
  });

  it('gives every theme the three roles as #rrggbb', () => {
    for (const colors of Object.values(LOGGY_COLORS_BY_THEME)) {
      expect(Object.keys(colors).sort()).toEqual([...LOGGY_COLOR_ROLES].sort());

      for (const color of Object.values(colors)) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it('draws the default theme in the artwork Loggy was drawn in', () => {
    expect(LOGGY_COLORS_BY_THEME[DEFAULT_THEME_BY_MODE.dark]).toBe(LOGGY_CLASSIC);
    expect(LOGGY_CLASSIC).toEqual({ body: '#47ad92', deep: '#2f7e78', shade: '#3d9183' });
  });

  it('falls back to the classic green for a theme it does not know', () => {
    expect(loggyColorsForTheme('kinetic-unknown')).toBe(LOGGY_CLASSIC);
  });

  it('gives each theme its own Loggy unless it shares the default theme brand hue', () => {
    const emerald = new Set(['kinetic-depth', 'kinetic-light']);

    for (const themeId of THEME_IDS) {
      if (!emerald.has(themeId)) {
        expect(LOGGY_COLORS_BY_THEME[themeId]).not.toEqual(LOGGY_CLASSIC);
      }
    }
  });

  // A pink theme with a green log would be the bug this feature exists to fix. The body takes the
  // brand's hue (a few degrees either side), so the log reads as part of the theme.
  it.each(THEME_IDS)('%s draws Loggy in a hue near its brand', (themeId) => {
    const { brandPrimary } = THEME_DEFINITIONS[themeId as keyof typeof THEME_DEFINITIONS].palette;
    const classicOffset = circularDistance(hue(LOGGY_CLASSIC.body), hue('#29a577'));
    const tolerance =
      themeId === 'kinetic-depth' || themeId === 'kinetic-light' ? classicOffset + 5 : 25;

    expect(
      circularDistance(hue(LOGGY_COLORS_BY_THEME[themeId].body), hue(brandPrimary))
    ).toBeLessThanOrEqual(tolerance);
  });

  // The roles darken in the order the artwork shades them, so a stripe still reads as a stripe.
  it.each(THEME_IDS)('%s keeps body lighter than shade, shade lighter than deep', (themeId) => {
    const { body, shade, deep } = LOGGY_COLORS_BY_THEME[themeId];

    expect(luminance(body)).toBeGreaterThan(luminance(shade));
    expect(luminance(shade)).toBeGreaterThan(luminance(deep));
  });

  // His ink outline is the same navy in every theme, so the log must stand apart from it, and from
  // the theme's own surfaces: a Loggy that melts into the page is the failure to rule out.
  it.each(THEME_IDS)('%s keeps the log apart from his outline and from its surfaces', (themeId) => {
    const { palette } = THEME_DEFINITIONS[themeId as keyof typeof THEME_DEFINITIONS];
    const { body } = LOGGY_COLORS_BY_THEME[themeId];

    expect(contrast(body, INK)).toBeGreaterThanOrEqual(3);
    expect(contrast(body, palette.surfaceBase)).toBeGreaterThanOrEqual(2);
    expect(contrast(body, palette.surfaceCard)).toBeGreaterThanOrEqual(2);
  });
});

describe('the themed classes of the palette', () => {
  const palette = readFileSync(join(PARTS, 'palette.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  function fillOf(className: string): string | undefined {
    return new RegExp(`\\.${className}\\s*\\{[^}]*?fill:\\s*([^;}]+)`).exec(palette)?.[1].trim();
  }

  it.each(Object.entries(THEMED_LOGGY_CLASSES))(
    '%s is written as the %s role',
    (className, role) => {
      expect(fillOf(className)).toBe(themedColor(role));
    }
  );

  it('themes no other class: a fixed green stays fixed', () => {
    const themed = [...palette.matchAll(/\.(s\d+)\s*\{[^}]*var\(/g)].map((match) => match[1]);

    expect(themed.sort()).toEqual(Object.keys(THEMED_LOGGY_CLASSES).sort());
  });

  it('writes the classic colour as every fallback', () => {
    for (const [, role, hex] of palette.matchAll(/var\(--loggy-(\w+),\s*(#[0-9a-f]{6})\)/g)) {
      expect(LOGGY_CLASSIC[role]).toBe(hex);
    }
  });

  // Lettuce is food, not Loggy: it stays green when the log turns pink.
  it('keeps the greens of the salad as fixed classes the themes do not reach', () => {
    for (const part of ['bowl/salad.svg', 'fork/salad.svg']) {
      const svg = readFileSync(join(PARTS, part), 'utf8');

      for (const className of Object.keys(THEMED_LOGGY_CLASSES)) {
        expect(svg).not.toContain(`class="${className}"`);
      }
    }
  });

  it('is used only through palette classes: no part names a Loggy green itself', () => {
    const files: string[] = [];

    for (const dir of readdirSync(PARTS, { withFileTypes: true })) {
      if (dir.isDirectory()) {
        for (const file of readdirSync(join(PARTS, dir.name))) {
          files.push(join(PARTS, dir.name, file));
        }
      }
    }

    for (const file of files.filter((name) => name.endsWith('.svg'))) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/fill="#|--loggy-/);
    }
  });
});

describe('applyLoggyColors', () => {
  const svg = `<style>.s1 { fill: ${themedColor('body')} } .s3 { fill: ${themedColor('deep')} } .s7 { fill: var(--loggy-shade,#3d9183) } .s19 { fill: #47ad92 }</style>`;

  it('replaces each themed colour with the one its role has in the theme', () => {
    const themed = applyLoggyColors(svg, LOGGY_COLORS_BY_THEME['kinetic-shock']);

    expect(themed).toContain('.s1 { fill: #dd6d9e }');
    expect(themed).toContain('.s3 { fill: #995485 }');
    expect(themed).toContain('.s7 { fill: #b36090 }');
    expect(themed).not.toContain('var(');
  });

  it('leaves a fixed colour alone, even the classic green of the lettuce', () => {
    expect(applyLoggyColors(svg, LOGGY_COLORS_BY_THEME['kinetic-shock'])).toContain(
      '.s19 { fill: #47ad92 }'
    );
  });

  it('can be used repeatedly: the shared pattern keeps no state between calls', () => {
    const first = svg.replace(THEMED_COLOR_PATTERN, 'x');
    const second = svg.replace(THEMED_COLOR_PATTERN, 'x');

    expect(second).toBe(first);
  });
});
