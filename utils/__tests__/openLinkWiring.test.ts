import { readFileSync } from 'fs';
import { join } from 'path';

const read = (path: string) => readFileSync(join(__dirname, '..', '..', path), 'utf8');

describe('open link wiring', () => {
  // The area lock does not mount its children while locked, so the payload has to be held on the
  // screen ABOVE the gate: it then waits for the unlock and the review opens after it.
  it.each([
    [
      'app/app/workout/workouts.tsx',
      "useIncomingOpenLink(\n    'workout'",
      '<ExternalWorkoutPlanModal',
    ],
    ['app/app/nutrition/food.tsx', "useIncomingOpenLink(\n    'food'", '<ExternalFoodLogModal'],
  ])('%s holds the payload above its lock gate and gives it to the modal', (path, hook, modal) => {
    const source = read(path);
    const hookAt = source.indexOf(hook);
    const gateAt = source.indexOf('<AreaLockGate');
    const modalAt = source.indexOf(modal);

    expect(hookAt).toBeGreaterThan(-1);
    expect(gateAt).toBeGreaterThan(hookAt);
    expect(modalAt).toBeGreaterThan(gateAt);
    expect(source.slice(modalAt, modalAt + 400)).toContain('incoming=');
  });
});
