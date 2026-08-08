import exercisesData from '@/data/exercisesData.json';
import exercisesEnUS from '@/data/exercisesEnUS.json';
import exercisesEsEs from '@/data/exercisesEsEs.json';
import exercisesNlNl from '@/data/exercisesNlNl.json';
import exercisesPtBr from '@/data/exercisesPtBr.json';
import exercisesRuRu from '@/data/exercisesRuRu.json';

const bodyCraftCableExercises = [
  'Cable Bulgarian Split Squat',
  'Cable Romanian Deadlift',
  'Cable Standing Calf Raise',
  'Cable Bayesian Curl',
  'Cable Cross-Body Triceps Extension',
  'Cable Wrist Curl',
  'Cable Reverse Wrist Curl',
  'Cable Belt Squat',
  'Cable Low-to-High Fly',
];

describe('BodyCraft cable exercises', () => {
  it('includes every exercise as cable equipment with a cable-prefixed canonical name', () => {
    const additions = exercisesData.filter(({ __exerciseName }) =>
      bodyCraftCableExercises.includes(__exerciseName)
    );

    expect(additions).toHaveLength(bodyCraftCableExercises.length);
    expect(additions.map(({ __exerciseName }) => __exerciseName)).toEqual(bodyCraftCableExercises);
    expect(additions.every(({ equipmentType }) => equipmentType === 'cable')).toBe(true);
    expect(additions.every(({ __exerciseName }) => __exerciseName.startsWith('Cable '))).toBe(true);
  });

  it.each([
    ['en-US', exercisesEnUS],
    ['es-ES', exercisesEsEs],
    ['nl-NL', exercisesNlNl],
    ['pt-BR', exercisesPtBr],
    ['ru-RU', exercisesRuRu],
  ])('keeps the %s catalog aligned with the canonical exercise indexes', (_locale, catalog) => {
    for (let exerciseIndex = 248; exerciseIndex <= 256; exerciseIndex += 1) {
      expect(catalog[exerciseIndex - 1]).toMatchObject({
        exerciseIndex,
        name: expect.any(String),
        description: expect.any(String),
      });
    }
  });
});

const multiplierByName = new Map(
  exercisesData.map(({ __exerciseName, loadMultiplier }): [string, number] => [
    __exerciseName,
    loadMultiplier,
  ])
);

// `loadMultiplier` is the load a trained lifter typically works with on an
// exercise, as a multiple of bodyweight, measured the way the app logs it
// (per hand for dumbbells, per stack for cables). Both consumers read it that
// way: `workoutEnergyCalculator` scales mechanical work by it, and
// `exerciseGoalProjection` divides the estimated 1RM by `bodyWeight * loadMultiplier`
// to decide whether a lifter is advanced enough to warrant the lower stalling
// threshold.
//
// The cable catalogue was originally assigned a flat ceiling of 0.5 for every
// movement, so heavy cable compounds landed in the isolation band — Cable Belt
// Squat sat at 0.5 against the 1.5 of the Belt Squat Machine it mirrors, and
// Cable Chest Press at 0.3 against Chest Press Machine's 0.9. A cable variant now
// takes its anchor's value outright, discounted only for a genuine biomechanical
// difference (unsupported stance, unilateral) — never for being a cable. These
// assertions pin that derivation rather than the individual numbers.
describe('exercise loadMultiplier', () => {
  it('is not capped by equipment type', () => {
    const cableMultipliers = exercisesData
      .filter(({ equipmentType }) => equipmentType === 'cable')
      .map(({ loadMultiplier }) => loadMultiplier);

    // Cable compounds reach the heavy free-weight band; a category-wide clamp
    // (every historical version of this data) cannot satisfy this.
    expect(Math.max(...cableMultipliers)).toBeGreaterThanOrEqual(1);
  });

  // [cable exercise, non-cable anchor, min ratio, max ratio]
  it.each([
    ['Cable Belt Squat', 'Belt Squat Machine', 0.8, 1.1],
    ['Cable Squat', 'Squat', 0.7, 1.1],
    ['Cable Front Squat', 'Front Squat', 0.9, 1.1],
    ['Cable Romanian Deadlift', 'Romanian Deadlift', 0.9, 1.1],
    ['Cable Standing Calf Raise', 'Standing Calf Raise', 0.9, 1.1],
    ['Cable Seated Lat Pull Down', 'Lat Pulldown', 0.9, 1.1],
    ['Cable Mid Diverging Row', 'Seated Row', 0.9, 1.1],
    ['Cable Bench Press', 'Chest Press Machine', 0.9, 1.1],
    ['Cable Chest Press', 'Chest Press Machine', 0.85, 1.1],
    ['Cable Seated Shoulder Press', 'Machine Shoulder Press', 0.9, 1.1],
    ['Cable Shrugs', 'Barbell Shrug', 0.85, 1.1],
    ['Cable Bicep Curl', 'EZ Bar Curl', 0.9, 1.15],
    ['Cable Crunch', 'Crunch Machine', 0.9, 1.3],
  ])('keeps %s at parity with %s', (cable, anchor, minRatio, maxRatio) => {
    const cableMultiplier = multiplierByName.get(cable);
    const anchorMultiplier = multiplierByName.get(anchor);

    expect(cableMultiplier).toBeDefined();
    expect(anchorMultiplier).toBeDefined();

    const ratio = cableMultiplier! / anchorMultiplier!;
    expect(ratio).toBeGreaterThanOrEqual(minRatio);
    expect(ratio).toBeLessThanOrEqual(maxRatio);
  });

  // Standing versions are limited by stance and anti-rotation rather than the prime
  // mover, so they sit below their supported counterpart — the one discount a cable
  // entry is allowed to carry.
  it.each([
    ['Cable Standing Chest Press', 'Cable Bench Press'],
    ['Cable Standing Incline Press', 'Cable Seated Incline Press'],
    ['Cable Standing Shoulder Press', 'Cable Seated Shoulder Press'],
    ['Cable Pec Fly-Standing', 'Cable Pec Fly'],
  ])('keeps %s below the supported %s', (standing, supported) => {
    expect(multiplierByName.get(standing)!).toBeLessThan(multiplierByName.get(supported)!);
  });

  // Unilateral variants load one limb, so they sit below the two-limb version.
  it.each([
    ['Cable One Arm Shoulder Press', 'Cable Standing Shoulder Press'],
    ['Cable One Arm Push Down', 'Cable Tricep Pushdown'],
    ['Cable One Arm Curl-Supinating', 'Cable Standing Arm Curl'],
    ['Cable Standing One Arm Row', 'Cable Mid Diverging Row'],
  ])('keeps the unilateral %s below %s', (unilateral, bilateral) => {
    expect(multiplierByName.get(unilateral)!).toBeLessThan(multiplierByName.get(bilateral)!);
  });

  // A cable variant is never the heavier way to train a movement — where the
  // catalogue holds both, the cable entry must not exceed its counterpart.
  it.each([
    ['Cable Triceps Kickback', 'Dumbbell Triceps Kickback'],
    ['Cable Triceps Kickback from High Pulley', 'Dumbbell Triceps Kickback'],
    ['Cable Reverse Ab Crunch', 'Crunch Machine'],
    ['Hamstring Curl Machine', 'Leg Curl Machine'],
  ])('keeps %s at or below %s', (cable, anchor) => {
    expect(multiplierByName.get(cable)).toBeLessThanOrEqual(multiplierByName.get(anchor)!);
  });

  it('gives every externally loaded exercise a non-zero multiplier', () => {
    const unloadable = new Set(['bodyweight', 'cardio', 'medicine_ball', 'other']);
    const zeroed = exercisesData.filter(
      ({ equipmentType, loadMultiplier }) => !unloadable.has(equipmentType) && loadMultiplier === 0
    );

    expect(zeroed.map(({ __exerciseName }) => __exerciseName)).toEqual([]);
  });
});
