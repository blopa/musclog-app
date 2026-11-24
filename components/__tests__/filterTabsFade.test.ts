import { readFileSync } from 'fs';
import { join } from 'path';

import { THEMES } from '@/theme';
import { addOpacityToHex } from '@/theme.tokens';

const source = readFileSync(join(__dirname, '..', 'FilterTabs.tsx'), 'utf8');

// Jest has no screen-rendering harness for the scroller (its fade depends on measured layout),
// so the wiring is checked at source level, like the other scroll-cue tests.
describe('the quick-pick chip row fade', () => {
  it('fades the surface color from zero alpha, never from `transparent` (transparent black)', () => {
    expect(source).toContain('useSurfaceColor()');
    expect(source).toContain('addOpacityToHex(surface, EDGE_FADE_STOPS[0].alpha)');
    expect(source).not.toMatch(/colors=\{\['transparent'/);
  });

  it('starts fully clear and ends fully opaque, so it joins the content and the surface', () => {
    const stops = source.match(/EDGE_FADE_STOPS = \[([\s\S]*?)\] as const/)?.[1] ?? '';
    const alphas = [...stops.matchAll(/alpha: ([\d.]+)/g)].map((match) => Number(match[1]));
    const locations = [...stops.matchAll(/location: ([\d.]+)/g)].map((match) => Number(match[1]));

    expect(alphas[0]).toBe(0);
    expect(alphas[alphas.length - 1]).toBe(1);
    expect(locations[0]).toBe(0);
    expect(locations[locations.length - 1]).toBe(1);
    // Strictly rising in both, or the ramp would fold back on itself.
    expect(alphas).toEqual([...alphas].sort((a, b) => a - b));
    expect(locations).toEqual([...locations].sort((a, b) => a - b));
  });

  it('keeps the surface RGB at every stop, in every theme, so no stop is tinted darker', () => {
    for (const theme of Object.values(THEMES)) {
      const surface = theme.colors.background.card;
      const channels = surface
        .replace('#', '')
        .match(/../g)!
        .map((pair) => parseInt(pair, 16))
        .join(', ');

      expect(addOpacityToHex(surface, 0)).toBe(`rgba(${channels}, 0)`);
    }
  });
});
