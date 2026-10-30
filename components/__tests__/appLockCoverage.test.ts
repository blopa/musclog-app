import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(__dirname, '../..', path), 'utf8');

/**
 * Each of these was a way past the lock. A native Modal is its own window above the root view,
 * so the root overlay alone could not cover a sheet left open when the app locked; the Progress
 * chart drew logged periods with the cycle area locked; and the cycle screen's sheets sat outside
 * its lock gate, so a re-lock left an open day sheet on screen.
 */
describe('the app lock reaches every surface that shows cycle records', () => {
  it.each(['components/theme/Modal.tsx', 'components/theme/Modal.ios.tsx'])(
    '%s draws the lock overlay inside the modal window',
    (file) => {
      expect(read(file)).toContain('<AppLockOverlay />');
    }
  );

  it('hides the Progress cycle chart while the cycle area is locked', () => {
    expect(read('components/progress/MenstrualPerformanceChart.tsx')).toContain(
      "isLocked('cycle')"
    );
  });

  it('renders the cycle screen’s sheets inside its lock gate', () => {
    const screen = read('app/app/cycle.tsx');
    expect(screen.indexOf('{renderPanel()}')).toBeGreaterThan(
      screen.indexOf('<AreaLockGate area="cycle">')
    );
    expect(screen.indexOf('{renderPanel()}')).toBeLessThan(screen.indexOf('</AreaLockGate>'));
  });

  it('keeps the workout session free of cycle observations', () => {
    expect(read('components/workout/WorkoutSessionInsights.tsx')).not.toMatch(
      /useMenstrualCycle|useCycleInsights/
    );
  });
});

/**
 * An area's lock only holds if every screen that shows its records sits inside the gate; a new
 * screen added without one is readable with the lock on. Each of these was checked by hand once.
 */
describe('each lockable area gates all of its screens', () => {
  const gated: [string, string][] = [
    ['app/app/cycle.tsx', 'area="cycle"'],
    ['app/app/progress.tsx', 'area="progress"'],
    ['app/app/nutrition/food.tsx', 'area="nutrition"'],
    ['app/app/weekly-review.tsx', 'area={WEEKLY_REVIEW_LOCK_AREAS}'],
    ['app/app/workout/workouts.tsx', 'area="workout"'],
    ['app/app/workout/workout-session.tsx', 'area="workout"'],
    ['app/app/workout/workout-summary.tsx', 'area="workout"'],
    ['app/app/workout/rest-timer.tsx', 'area="workout"'],
    ['app/app/workout/rest-over.tsx', 'area="workout"'],
    ['app/app/workout/exercise-transition.tsx', 'area="workout"'],
  ];

  it.each(gated)('%s is wrapped in <AreaLockGate %s>', (file, prop) => {
    const source = read(file);
    expect(source).toContain(`<AreaLockGate ${prop}>`);
    expect(source).toContain('</AreaLockGate>');
  });

  it('gates every screen file in app/app/workout', () => {
    const { readdirSync } = jest.requireActual('fs') as typeof import('fs');
    const files = readdirSync(join(__dirname, '../../app/app/workout')).filter(
      (name) => name.endsWith('.tsx') && !name.endsWith('.web.tsx')
    );
    for (const name of files) {
      expect(read(`app/app/workout/${name}`)).toContain('<AreaLockGate');
    }
  });

  it('weekly review holds both the workout and the nutrition lock', () => {
    expect(read('app/app/weekly-review.tsx')).toMatch(
      /WEEKLY_REVIEW_LOCK_AREAS = \['workout', 'nutrition'\]/
    );
  });
});
