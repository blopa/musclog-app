import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');

// Source checks follow the existing component suites: Jest has no screen-rendering harness.
const headings = [
  ['app/app/workout/workouts.tsx', 'workouts.title'],
  ['app/app/notes.tsx', 'notes.title'],
  ['app/app/onboarding/health-connect.tsx', 'onboarding.healthConnect.health'],
  ['components/RestOverTitle.tsx', 'restOver.over'],
  ['components/WorkoutSummaryHeader.tsx', 'workoutSummary.youCrushedIt'],
  ['components/WorkoutSummaryCelebration.web.tsx', 'workoutSummary.youCrushedIt'],
];

describe('solid app heading text', () => {
  it.each(headings)('%s uses readable theme ink for %s', (path, key) => {
    const source = readFileSync(join(root, path), 'utf8');
    const tag = path.endsWith('.web.tsx') ? 'span' : 'Text';
    const element = source.match(
      new RegExp(`<${tag}\\b[^>]*>\\s*\\{t\\('${key.replace(/\./g, '\\.')}'\\)\\}\\s*</${tag}>`)
    )?.[0];

    expect(element).toBeDefined();
    expect(element).toContain('color: theme.colors.text.primary');
    expect(source).not.toMatch(/GradientText|BackgroundClip|TextFillColor|backgroundClip/);
  });
});
