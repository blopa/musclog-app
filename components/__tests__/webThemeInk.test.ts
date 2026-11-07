import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const root = join(__dirname, '..', '..');

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);

    if (entry === '__tests__' || entry === 'node_modules') {
      return [];
    }

    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }

    return /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });
}

describe('web components read theme ink', () => {
  // The app's custom properties are `--c-*` channel triplets (`rgb(var(--c-text-primary))`). There
  // is no `--text-primary`, so `var(--text-primary, #fff)` always drew its fallback: white values
  // and grey labels on every theme, unreadable on the light card of Kinetic Light.
  it('never reads a --text-* custom property, which does not exist', () => {
    const offenders = ['components', 'app', 'hooks', 'utils'].flatMap((directory) =>
      sourceFiles(join(root, directory)).filter((file) =>
        /var\(\s*--text-/.test(readFileSync(file, 'utf8'))
      )
    );

    expect(offenders.map((file) => relative(root, file))).toEqual([]);
  });

  describe('WorkoutSummaryCelebration.web.tsx stat rows', () => {
    const source = readFileSync(join(root, 'components/WorkoutSummaryCelebration.web.tsx'), 'utf8');
    const statRow = source.slice(
      source.indexOf('function StatRow('),
      source.indexOf('export function WorkoutSummaryCelebration')
    );

    it('finds the stat row', () => {
      expect(statRow.length).toBeGreaterThan(0);
    });

    it('draws label, value and unit in the theme text tokens', () => {
      expect(statRow).toContain('color: theme.colors.text.secondary');
      expect(statRow).toContain('color: theme.colors.text.primary');
      expect(statRow).toContain('color: theme.colors.text.tertiary');
    });

    it('draws the row divider as the theme ink hairline, not white', () => {
      expect(statRow).toContain('theme.colors.background.ink5');
      expect(statRow).not.toMatch(/rgba\(\s*255\s*,\s*255\s*,\s*255/);
    });

    it('hardcodes no ink colour', () => {
      expect(statRow).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    });
  });
});
