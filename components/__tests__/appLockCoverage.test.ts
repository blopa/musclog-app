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
    expect(screen.indexOf('{renderPanel()}')).toBeGreaterThan(screen.indexOf('<CycleLockGate>'));
    expect(screen.indexOf('{renderPanel()}')).toBeLessThan(screen.indexOf('</CycleLockGate>'));
  });

  it('keeps the workout session free of cycle observations', () => {
    expect(read('components/workout/WorkoutSessionInsights.tsx')).not.toMatch(
      /useMenstrualCycle|useCycleInsights/
    );
  });
});
