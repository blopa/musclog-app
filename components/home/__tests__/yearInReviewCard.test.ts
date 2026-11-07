import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..', '..');

function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * The Home screen must not load a year of data to decide whether to show the offer. The card asks
 * only for a one-row existence check, and the route mounts it with no logic of its own.
 */
describe('year-in-review card on Home', () => {
  it('is mounted once by the home screen, which reads no year-review data itself', () => {
    const screen = code('app', 'app', 'index.tsx');

    expect([...screen.matchAll(/<YearInReviewCard\b/g)]).toHaveLength(1);
    expect(screen).not.toMatch(
      /YearInReviewRepository|buildYearInReview|yearReviewSeason|yearReviewDismissedYear/
    );
  });

  it('asks only the one-row existence check, never the full load', () => {
    const card = code('components', 'home', 'YearInReviewCard.tsx');

    expect(card).toMatch(/YearInReviewRepository\.hasCompletedSession\(/);
    expect(card).not.toMatch(
      /YearInReviewRepository\.load\(|buildYearInReview|buildYearStoryCards/
    );
  });

  it('reads the dismissal through the settings service, not the reactive state', () => {
    const card = code('components', 'home', 'YearInReviewCard.tsx');

    expect(card).toMatch(/SettingsService\.get\(SETTINGS\.yearReviewDismissedYear\)/);
    expect(card).not.toMatch(/useSettings\(/);
  });
});
