import type { GymSnapshot } from '../gym';
import { defaultBarWeightKg, defaultPlates } from '../gym';
import { platesPerSide } from '../plateCalculator';
import { displayToKg } from '../unitConversion';
import { buildWarmupSets, WARMUP_RAMP } from '../warmupSets';

const gym: GymSnapshot = {
  id: 'g',
  name: 'Gym',
  barWeightKg: 20,
  plates: defaultPlates('metric'),
  weightIncrementKg: 2.5,
  equipment: ['barbell', 'dumbbell', 'cable'],
};

const metric = (equipmentType: string, workingKg: number, withGym: GymSnapshot | null = gym) =>
  buildWarmupSets(workingKg, { gym: withGym, equipmentType, units: 'metric' });

describe('buildWarmupSets', () => {
  it('ramps a barbell lift: 40%, 60% and 80% of the working weight, getting lighter in reps', () => {
    expect(metric('barbell', 100)).toEqual([
      { weightKg: 40, reps: 5 },
      { weightKg: 60, reps: 3 },
      { weightKg: 80, reps: 2 },
    ]);
  });

  it('snaps every weight to something the bar can be loaded to', () => {
    // 40% of 60 is 24 kg, which a bar with 1.25 kg plates cannot make — it becomes 25 kg.
    expect(metric('barbell', 60)).toEqual([
      { weightKg: 25, reps: 5 },
      { weightKg: 35, reps: 3 },
      { weightKg: 47.5, reps: 2 },
    ]);
  });

  it('never goes below the empty bar', () => {
    expect(metric('barbell', 40)).toEqual([
      { weightKg: 20, reps: 5 },
      { weightKg: 25, reps: 3 },
      { weightKg: 32.5, reps: 2 },
    ]);
  });

  it('returns nothing when the working weight is barely more than the bar', () => {
    expect(metric('barbell', 22)).toEqual([]);
    expect(metric('barbell', 20)).toEqual([]);
    expect(metric('barbell', 10)).toEqual([]);
  });

  it('returns nothing for bodyweight work or a non-positive or non-finite load', () => {
    expect(metric('bodyweight', 100)).toEqual([]);
    expect(metric('barbell', 0)).toEqual([]);
    expect(metric('barbell', -5)).toEqual([]);
    expect(metric('barbell', Number.NaN)).toEqual([]);
  });

  it('uses the gym increment for a dumbbell, which has no bar to start from', () => {
    expect(metric('dumbbell', 20)).toEqual([
      { weightKg: 7.5, reps: 5 },
      { weightKg: 12.5, reps: 3 },
      { weightKg: 15, reps: 2 },
    ]);
  });

  it('drops duplicates and sets too close to the working weight for a very light lift', () => {
    // 2, 3 and 4 kg all snap to 2.5 or 5 — and 5 is not below 90% of 5. Only one set survives.
    expect(metric('dumbbell', 5)).toEqual([{ weightKg: 2.5, reps: 5 }]);
  });

  it('works for a user who never set up a gym, using the standard bar and plates', () => {
    expect(metric('barbell', 100, null)).toEqual(metric('barbell', 100));
  });

  it('is always strictly ascending, below 90% of the working weight, in the ramp reps, and loadable', () => {
    const repsInRamp = WARMUP_RAMP.map((step) => step.reps);

    for (let working = 30; working <= 260; working += 7.5) {
      const sets = metric('barbell', working);
      let previous = 0;
      for (const set of sets) {
        expect(set.weightKg).toBeGreaterThan(previous);
        expect(set.weightKg).toBeLessThan(working * 0.9);
        expect(set.weightKg).toBeGreaterThanOrEqual(gym.barWeightKg);
        expect(repsInRamp).toContain(set.reps);
        // Loadable exactly: the plates make it with nothing left over.
        expect(platesPerSide(set.weightKg, gym).remainderKg).toBe(0);
        previous = set.weightKg;
      }
    }
  });

  it('works in pounds with the 45 lb bar', () => {
    const sets = buildWarmupSets(displayToKg(225, 'imperial'), {
      gym: null,
      equipmentType: 'barbell',
      units: 'imperial',
    });

    expect(sets.length).toBeGreaterThan(0);
    for (const set of sets) {
      expect(set.weightKg).toBeGreaterThanOrEqual(defaultBarWeightKg('imperial'));
    }
  });
});
