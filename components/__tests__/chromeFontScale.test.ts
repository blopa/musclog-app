import { readFileSync } from 'fs';
import { join } from 'path';

import { MAX_CHROME_FONT_SCALE } from '@/constants/fontScale';

const root = join(__dirname, '..', '..');
const source = (...segments: string[]) => readFileSync(join(root, ...segments), 'utf8');

/**
 * Fixed-height chrome must cap OS font scaling, or at 2.0x its labels overflow the tab bar, the
 * button and the stat strip. There is no render harness, so this reads the source. Body copy in
 * scrollable content is deliberately left unbounded.
 */
describe('chrome font scale cap', () => {
  it('is a modest multiplier above 1 (accessibility still scales up)', () => {
    expect(MAX_CHROME_FONT_SCALE).toBeGreaterThan(1);
    expect(MAX_CHROME_FONT_SCALE).toBeLessThanOrEqual(1.5);
  });

  it.each([
    ['NavigationMenu', ['components', 'NavigationMenu.tsx'], 1],
    ['StatStrip', ['components', 'StatStrip.tsx'], 3],
    ['Button', ['components', 'theme', 'Button.tsx'], 1],
  ] as const)('%s caps every fixed-height label', (_name, path, count) => {
    const text = source(...path);
    const uses = text.match(/maxFontSizeMultiplier=\{MAX_CHROME_FONT_SCALE\}/g) ?? [];

    expect(uses.length).toBeGreaterThanOrEqual(count);
    expect(text).not.toMatch(/maxFontSizeMultiplier=\{\d/);
  });
});
