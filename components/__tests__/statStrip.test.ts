import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const statStrip = readFileSync(join(root, 'components', 'StatStrip.tsx'), 'utf8');
const homeFooter = readFileSync(join(root, 'components', 'home', 'DailyHomeFooter.tsx'), 'utf8');
const summaryCard = readFileSync(
  join(root, 'components', 'cards', 'DailySummaryCard', 'DailySummaryCard.tsx'),
  'utf8'
);

const CONSUMERS: [name: string, source: string][] = [
  ['DailyHomeFooter', homeFooter],
  ['DailySummaryCard', summaryCard],
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
    // value first. Both shapes must now come from `StatStrip` alone.
    expect(source).not.toContain('w-px');
    expect(source).not.toContain('justify-around');
  });

  it('owns the divider and the container exactly once', () => {
    expect([...statStrip.matchAll(/w-px/g)]).toHaveLength(1);
    expect([...statStrip.matchAll(/rounded-2xl/g)]).toHaveLength(1);
  });

  it('puts the number above its label in every cell', () => {
    const valueIndex = statStrip.indexOf('{item.value}');
    const labelIndex = statStrip.indexOf('{item.label}');
    expect(valueIndex).toBeGreaterThan(-1);
    expect(labelIndex).toBeGreaterThan(valueIndex);
  });

  it('takes every color from the caller, so it can sit on a card or on the hero gradient', () => {
    // A hardcoded `theme.colors...` read here would pin the strip to one surface.
    expect(statStrip).not.toContain('useTheme');
    expect(statStrip).not.toContain('theme.colors');
    for (const token of ['background', 'border', 'label', 'unit'] as const) {
      expect(statStrip).toContain(`palette.${token}`);
    }
  });

  it('renders nothing rather than an empty outline when there is nothing to show', () => {
    expect(statStrip).toContain('items.length === 0');
  });
});
