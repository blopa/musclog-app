import { calculateWorkoutKcal } from '../workoutEnergyCalculator';
import { estimateWorkoutKcalFromSets } from '../workoutKcalEstimate';

const profile = { weightKg: 80, heightCm: 180, gender: 'male' as const };
const bench = {
  id: 'bench',
  mechanicType: 'compound',
  muscleGroup: 'chest',
  equipmentType: 'barbell',
  loadMultiplier: 1,
} as never;

const set = (overrides: Record<string, unknown> = {}) => ({
  exerciseId: 'bench',
  weight: 80,
  reps: 8,
  completionStatus: 'performed' as const,
  ...overrides,
});

describe('estimateWorkoutKcalFromSets', () => {
  it('rounds the MWEM estimate of the performed sets', () => {
    const expected = Math.round(
      calculateWorkoutKcal([
        {
          user: profile,
          exercise: {
            mechanicType: 'compound',
            muscleGroup: 'chest',
            equipmentType: 'barbell',
            loadMultiplier: 1,
          },
          sets: [
            { weight: 80, reps: 8 },
            { weight: 80, reps: 8 },
          ],
        },
      ])
    );

    const kcal = estimateWorkoutKcalFromSets(profile, [set(), set()], [bench]);

    expect(kcal).toBeGreaterThan(0);
    expect(kcal).toBe(expected);
  });

  it('ignores planned and skipped sets', () => {
    const performedOnly = estimateWorkoutKcalFromSets(profile, [set()], [bench]);
    const withOthers = estimateWorkoutKcalFromSets(
      profile,
      [set(), set({ completionStatus: 'planned' }), set({ completionStatus: 'skipped' })],
      [bench]
    );

    expect(withOthers).toBe(performedOnly);
  });

  it('contributes nothing for an exercise it does not know', () => {
    expect(estimateWorkoutKcalFromSets(profile, [set({ exerciseId: 'gone' })], [bench])).toBe(0);
  });

  it('treats a missing weight or rep count as zero', () => {
    expect(estimateWorkoutKcalFromSets(profile, [set({ weight: null, reps: null })], [bench])).toBe(
      estimateWorkoutKcalFromSets(profile, [set({ weight: 0, reps: 0 })], [bench])
    );
  });
});
