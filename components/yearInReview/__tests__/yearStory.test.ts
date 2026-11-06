import { readFileSync } from 'fs';
import { join } from 'path';

import { YEAR_STORY_ART } from '@/components/yearInReview/yearStoryArt';

const root = join(__dirname, '..', '..', '..');

function code(...segments: string[]): string {
  return readFileSync(join(root, ...segments), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/** The order the story plays in (`buildYearStoryCards`). */
const STORY_ORDER = [
  'intro',
  'sessions',
  'heatmap',
  'streak',
  'volume',
  'topExercises',
  'records',
  'busiestMonth',
  'trainingTime',
  'nutrition',
  'foodStreak',
  'favouriteMeal',
  'protein',
  'macros',
  'weight',
  'outro',
] as const;

describe('the year story', () => {
  it('changes ground on every page, so moving on reads as a new page', () => {
    for (let index = 1; index < STORY_ORDER.length; index++) {
      expect(YEAR_STORY_ART[STORY_ORDER[index]].ground).not.toBe(
        YEAR_STORY_ART[STORY_ORDER[index - 1]].ground
      );
    }
  });

  it('goes back on a tap zone, not on where the tap landed inside a child', () => {
    const screen = code('app', 'app', 'year-in-review.tsx');

    expect(screen).not.toMatch(/locationX/);
    expect(screen.match(/<Pressable\b/g)).toHaveLength(2);
  });

  it('keeps real buttons for screen readers, the tap zones being a shortcut', () => {
    const screen = code('app', 'app', 'year-in-review.tsx');

    expect(screen.match(/accessible=\{false\}/g)).toHaveLength(2);
    expect(screen).toMatch(/t\('yearInReview\.next'\)/);
    expect(screen).toMatch(/t\('yearInReview\.back'\)/);
  });

  it('tells a failed load apart from an empty year', () => {
    const screen = code('app', 'app', 'year-in-review.tsx');

    expect(screen).toMatch(/t\('yearInReview\.loadFailed'\)/);
    expect(screen).toMatch(/t\('yearInReview\.empty'\)/);
  });

  it('never words a weight change as good or bad', () => {
    const view = code('components', 'yearInReview', 'YearStoryCardView.tsx');

    expect(view).not.toMatch(/weight\.(lost|gained)/);
  });
});
