import type { GymSnapshot } from '@/utils/gym';
import { defaultGymSnapshot } from '@/utils/gym';
import { nearestLoadableKg, platesPerSide } from '@/utils/plateCalculator';
import { displayToKg } from '@/utils/unitConversion';

import { MAX_PLATE_TARGET, solvePlateLoad, validatePlateTarget } from '../plateCalculatorModel';

const gymWith = (plates: { weightKg: number; count: number }[], barWeightKg = 20): GymSnapshot => ({
  ...defaultGymSnapshot('metric'),
  barWeightKg,
  plates,
});

describe('validatePlateTarget', () => {
  it('waits silently while the field is empty', () => {
    expect(validatePlateTarget('  ', 'metric')).toEqual({ ok: false, problem: null });
  });

  it('reads a comma decimal and refuses zero, text and anything above the cap', () => {
    expect(validatePlateTarget('62,5', 'metric')).toEqual({ ok: true, target: 62.5 });
    expect(validatePlateTarget('0', 'metric')).toEqual({ ok: false, problem: 'target' });
    expect(validatePlateTarget('abc', 'metric')).toEqual({ ok: false, problem: 'target' });
    expect(validatePlateTarget(String(MAX_PLATE_TARGET.metric + 1), 'metric')).toEqual({
      ok: false,
      problem: 'target',
    });
  });
});

describe('solvePlateLoad', () => {
  it('takes 15 + 10 kg a side, not the greedy 20, when plates are limited', () => {
    // One pair each of 20, 15 and 10 kg: 25 kg a side is 15 + 10. Greedy takes 20 and is stuck 5 short.
    const gym = gymWith([
      { weightKg: 20, count: 2 },
      { weightKg: 15, count: 2 },
      { weightKg: 10, count: 2 },
    ]);
    const solution = solvePlateLoad(70, 'metric', gym);

    expect(solution.perSide).toEqual([
      { weight: 15, count: 1 },
      { weight: 10, count: 1 },
    ]);
    expect(solution.loadedWeight).toBe(70);
    expect(solution.exact).toBe(true);
    expect(solution.belowBar).toBe(false);
  });

  it('loads 135 lb on a 45 lb bar with one 45 lb plate a side', () => {
    const solution = solvePlateLoad(135, 'imperial', defaultGymSnapshot('imperial'));

    expect(solution.barWeight).toBe(45);
    expect(solution.perSide).toEqual([{ weight: 45, count: 1 }]);
    expect(solution.loadedWeight).toBe(135);
    expect(solution.exact).toBe(true);
  });

  it('reports a target lighter than the bar', () => {
    const solution = solvePlateLoad(15, 'metric', defaultGymSnapshot('metric'));

    expect(solution.belowBar).toBe(true);
    expect(solution.perSide).toEqual([]);
    expect(solution.loadedWeight).toBe(20);
    expect(solution.exact).toBe(false);
  });

  it('gives the heaviest loadable weight under an unreachable target, and the nearest one', () => {
    // Only 10 kg plates, one pair: the loads are 20 or 40 kg, nothing between.
    const gym = gymWith([{ weightKg: 10, count: 2 }]);
    const solution = solvePlateLoad(33, 'metric', gym);

    expect(solution.loadedWeight).toBe(20);
    expect(solution.remainder).toBe(13);
    expect(solution.exact).toBe(false);
    expect(solution.nearestLoadable).toBe(40);
  });

  it('ignores a plate with no pairs', () => {
    const gym = gymWith([
      { weightKg: 25, count: 1 },
      { weightKg: 10, count: 2 },
    ]);
    const solution = solvePlateLoad(40, 'metric', gym);

    expect(solution.perSide).toEqual([{ weight: 10, count: 1 }]);
    expect(solution.loadedWeight).toBe(40);
  });

  it('matches the app functions on the same gym', () => {
    const gym = defaultGymSnapshot('metric');
    const solution = solvePlateLoad(100, 'metric', gym);
    const load = platesPerSide(displayToKg(100, 'metric'), gym);

    expect(solution.loadedWeight).toBeCloseTo(load.loadedKg, 2);
    expect(solution.nearestLoadable).toBeCloseTo(
      nearestLoadableKg(displayToKg(100, 'metric'), gym),
      2
    );
  });
});
