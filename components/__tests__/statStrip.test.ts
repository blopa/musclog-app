import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

/**
 * Strip comments before matching.
 *
 * These assertions are about what the components *render*, and this repo has no
 * component-rendering harness (`jest.config.js` matches only `*.test.ts`, and the jsdom
 * project only covers `hooks/**`), so they read the source instead. That makes a bare
 * substring search dangerous in one specific way: the comments in these files explain the
 * layout rules by naming the very classes the rules forbid, so `not.toContain('w-px')`
 * would fail on a comment that says "the `w-px` hairline lives in StatStrip". Matching on
 * code only keeps a failure meaning what it says.
 */
function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const statStrip = code('components', 'StatStrip.tsx');

const CONSUMERS: [name: string, source: string][] = [
  ['DailyHomeFooter', code('components', 'home', 'DailyHomeFooter.tsx')],
  ['DailySummaryCard', code('components', 'cards', 'DailySummaryCard', 'DailySummaryCard.tsx')],
];

describe('stat strip', () => {
  it.each(CONSUMERS)('%s renders its figures through the shared strip', (_name, source) => {
    expect(source).toContain("from '@/components/StatStrip'");
    expect(source).toContain('<StatStrip');
  });

  it.each(CONSUMERS)('%s does not re-implement the strip layout', (_name, source) => {
    // The hairline between cells and the row's own container are the two pieces that
    // drifted before: the weekly-average macros drew a `justify-around` pill with the
    // label above the value, while the home energy row drew divided cells with the
    // value first. Both shapes must now come from `StatStrip` alone. Anchored on the
    // className attribute, so only a real style declaration counts.
    expect(source).not.toMatch(/className=(["'`])[^"'`]*\bw-px\b/);
    expect(source).not.toMatch(/className=(["'`])[^"'`]*\bjustify-around\b/);
  });

  it('owns the divider and the container exactly once', () => {
    expect([...statStrip.matchAll(/\bw-px\b/g)]).toHaveLength(1);
    expect([...statStrip.matchAll(/\brounded-2xl\b/g)]).toHaveLength(1);
  });

  it('puts the number above its label in every cell', () => {
    const valueIndex = statStrip.indexOf('{item.value}');
    const labelIndex = statStrip.indexOf('{item.label}');
    expect(valueIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(valueIndex);
  });

  it('takes every color from the caller, so it can sit on a card or on the hero gradient', () => {
    // A `useTheme()` read here would pin the strip to one surface.
    expect(statStrip).not.toMatch(/\buseTheme\s*\(/);
    expect(statStrip).not.toMatch(/\btheme\.colors\b/);
    for (const token of ['background', 'border', 'label', 'unit'] as const) {
      expect(statStrip).toContain(`palette.${token}`);
    }
  });

  it('renders nothing rather than an empty outline when there is nothing to show', () => {
    expect(statStrip).toContain('items.length === 0');
  });
});
