import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');

function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const CALLS_THE_HOOK = /\buseDailyNutritionSummary\s*\(/;

/**
 * `useDailyNutritionSummary` is two live queries — the active goal and the day's logs,
 * each with its own per-row decryption — so the home screen subscribes exactly once and
 * passes the result down.
 *
 * It briefly did not: the stat strip's calories were fetched at the route level while
 * `DailyHomeSummary` fetched the identical day again for the card, so one screen ran the
 * whole thing twice. Nothing failed, and nothing was visible in either file on its own.
 */
describe('home screen daily-nutrition ownership', () => {
  it('subscribes exactly once, at the route level', () => {
    const screen = code('app', 'app', 'index.tsx');

    expect([...screen.matchAll(new RegExp(CALLS_THE_HOOK, 'g'))]).toHaveLength(1);
  });

  it.each([
    ['DailyHomeSummary', join('components', 'home', 'DailyHomeSummary.tsx')],
    ['DailyHomeFooter', join('components', 'home', 'DailyHomeFooter.tsx')],
  ])('%s takes the day it needs rather than re-subscribing', (_name, path) => {
    expect(code(path)).not.toMatch(CALLS_THE_HOOK);
  });
});
