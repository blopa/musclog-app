import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');

function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The home heatmaps cost two live queries each, so they must cost nothing while switched off:
 * the screen mounts one self-gating component and never subscribes on its behalf.
 */
describe('home heatmaps', () => {
  it('is mounted once by the home screen, which reads no heatmap setting or data itself', () => {
    const screen = code('app', 'app', 'index.tsx');

    expect([...screen.matchAll(/<HomeHeatmaps\b/g)]).toHaveLength(1);
    expect(screen).not.toMatch(/homeHeatmap|useActivityHeatmapDays/);
  });

  it('subscribes only after it has decided to show something', () => {
    const component = code('components', 'home', 'HomeHeatmaps.tsx');
    const gate = component.indexOf("homeHeatmaps === 'none'");

    expect(gate).toBeGreaterThan(-1);
    // The data hook lives in the per-card component, never above the gate.
    expect(component.indexOf('useActivityHeatmapDays(')).toBeGreaterThan(
      component.indexOf('function HomeHeatmapCard')
    );
    expect(component.slice(component.indexOf('export function HomeHeatmaps'))).not.toMatch(
      /useActivityHeatmapDays\(/
    );
  });

  it('draws the compact layout as one strip card, whatever the number of heatmaps', () => {
    const component = code('components', 'home', 'HomeHeatmaps.tsx');
    const gate = component.indexOf("homeHeatmapLayout === 'compact'");

    expect(gate).toBeGreaterThan(-1);
    expect(component.slice(gate, component.indexOf('const sideBySide'))).toMatch(
      /<HomeHeatmapStripCard\b/
    );
    // A source that is not shown must not subscribe.
    expect(component).toMatch(/enabled: sources\.includes\('workouts'\)/);
    expect(component).toMatch(/enabled: sources\.includes\('nutrition'\)/);
  });

  it('draws two heatmaps side by side only when both are on and the user chose that', () => {
    const component = code('components', 'home', 'HomeHeatmaps.tsx');

    expect(component).toMatch(
      /sideBySide\s*=\s*sources\.length === 2 && homeHeatmapLayout === 'side_by_side'/
    );
  });

  it('keeps the side-by-side cards to the last 30 days, wrapped, with only a title', () => {
    const component = code('components', 'home', 'HomeHeatmaps.tsx');
    const card = component.slice(
      component.indexOf('function HomeHeatmapDayGridCard'),
      component.indexOf('type HomeHeatmapStripCardProps')
    );

    expect(card).toMatch(/<ActivityDayGrid\b/);
    expect(card).toMatch(/dayCount=\{HOME_HEATMAP_STRIP_DAYS\}/);
    expect(card).not.toMatch(/subtitle=|summary=|legend=/);
    expect(component).toMatch(/sideBySide \? \(\s*<HomeHeatmapDayGridCard/);
  });
});
