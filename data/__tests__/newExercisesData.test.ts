import exercisesData from '@/data/exercisesData.json';
import newExerciseEnUs from '@/data/newExerciseEnUs.json';
import newExercisesData from '@/data/newExercisesData.json';
import { MUSCLE_SEED_DATA } from '@/database/services/MuscleService';

// `data/newExercisesData.json` is the free-exercise-db catalogue (CC0, 873
// exercises) re-expressed in this repo's exercise schema by
// `scripts/generate-new-exercises-data.js`. Nothing imports it yet — it exists so
// the catalogue can be reviewed before any of it is merged into the bundled one.
// These tests pin the schema conformance a consumer would need, so the file
// cannot silently drift out of shape while it waits.

const EXERCISE_JSON_MUSCLE_GROUPS = [
  'abdomen',
  'arms',
  'back',
  'chest',
  'core',
  'full_body',
  'glutes',
  'legs',
  'shoulders',
];

const EQUIPMENT_TYPES = [
  'barbell',
  'bodyweight',
  'cable',
  'cardio',
  'dumbbell',
  'kettlebell',
  'medicine_ball',
  'other',
  'plate_machine',
  'pneumatic_machine',
  'resistance_band',
  'smith_machine',
];

const MECHANIC_TYPES = [
  'cardio',
  'compound',
  'isolation',
  'mobility',
  'other',
  'plyometric',
  'stretching',
];

const KNOWN_MUSCLES = new Set(MUSCLE_SEED_DATA.map(({ name }) => name));

describe('newExerciseEnUs locale data', () => {
  it('provides an English name and description for every staged exercise', () => {
    expect(newExerciseEnUs).toHaveLength(newExercisesData.length);
    expect(newExerciseEnUs).toEqual(
      newExercisesData.map(({ __exerciseName, exerciseIndex }) => ({
        name: __exerciseName,
        description: expect.stringMatching(/\S/),
        exerciseIndex,
      }))
    );
  });

  it('uses only the locale-copy fields', () => {
    const keys = new Set(newExerciseEnUs.flatMap((entry) => Object.keys(entry)));

    expect([...keys].sort()).toEqual(['description', 'exerciseIndex', 'name']);
  });
});

describe('newExercisesData schema', () => {
  it('carries the whole free-exercise-db catalogue', () => {
    expect(newExercisesData).toHaveLength(873);
  });

  it('uses exactly the bundled catalogue fields, plus the maintainer-only ones', () => {
    const keys = new Set(newExercisesData.flatMap((entry) => Object.keys(entry)));

    expect([...keys].sort()).toEqual([
      '__exerciseName',
      '__freeExerciseDbId',
      'equipmentType',
      'exerciseIndex',
      'loadMultiplier',
      'mechanicType',
      'muscleGroup',
      'targetMuscles',
    ]);
  });

  // The bundled catalogue's indexes are fixed primary keys — a re-used one throws
  // `UNIQUE constraint failed: exercises.id` on seed (see AGENTS.md). Continuing
  // past the bundled range keeps the two files concatenable.
  it('numbers exercises contiguously after the bundled catalogue', () => {
    const indexes = newExercisesData.map(({ exerciseIndex }) => exerciseIndex);
    const bundledMax = Math.max(...exercisesData.map(({ exerciseIndex }) => exerciseIndex));

    expect(Math.min(...indexes)).toBe(bundledMax + 1);
    expect(indexes).toEqual(indexes.map((_, i) => bundledMax + 1 + i));
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('never collides with a bundled exercise index', () => {
    const bundled = new Set(exercisesData.map(({ exerciseIndex }) => exerciseIndex));
    const collisions = newExercisesData.filter(({ exerciseIndex }) => bundled.has(exerciseIndex));

    expect(collisions).toEqual([]);
  });

  it('names every exercise uniquely', () => {
    const names = newExercisesData.map(({ __exerciseName }) => __exerciseName);

    expect(new Set(names).size).toBe(names.length);
  });

  it.each([
    ['muscleGroup', EXERCISE_JSON_MUSCLE_GROUPS],
    ['equipmentType', EQUIPMENT_TYPES],
    ['mechanicType', MECHANIC_TYPES],
  ] as const)('keeps %s within its union', (field, allowed) => {
    const offenders = newExercisesData
      .filter((entry) => !allowed.includes(entry[field]))
      .map((entry) => `${entry.__exerciseName}: ${entry[field]}`);

    expect(offenders).toEqual([]);
  });

  // `MuscleService.backfillExerciseMuscles` looks each name up in the muscles
  // table, so a name outside MUSCLE_SEED_DATA links to nothing at all.
  it('targets only muscles that MUSCLE_SEED_DATA seeds', () => {
    const offenders = newExercisesData
      .flatMap(({ __exerciseName, targetMuscles }) =>
        targetMuscles.map((muscle) => ({ muscle, name: __exerciseName }))
      )
      .filter(({ muscle }) => !KNOWN_MUSCLES.has(muscle))
      .map(({ muscle, name }) => `${name}: ${muscle}`);

    expect(offenders).toEqual([]);
  });

  it('gives every exercise at least one target muscle, without repeats', () => {
    const empty = newExercisesData
      .filter(({ targetMuscles }) => targetMuscles.length === 0)
      .map(({ __exerciseName }) => __exerciseName);
    const duplicated = newExercisesData
      .filter(({ targetMuscles }) => new Set(targetMuscles).size !== targetMuscles.length)
      .map(({ __exerciseName }) => __exerciseName);

    expect(empty).toEqual([]);
    expect(duplicated).toEqual([]);
  });
});

// The same reading of `loadMultiplier` the bundled catalogue uses: a
// bodyweight-relative load benchmark for loaded work, the fraction of body mass
// moved for bodyweight work, and a hard 0 where there is no displacement to
// credit. See AGENTS.md and `data/__tests__/exercisesData.test.ts`.
describe('newExercisesData loadMultiplier', () => {
  it('gives every externally loaded exercise a non-zero multiplier', () => {
    const unloadable = new Set(['bodyweight', 'cardio', 'medicine_ball', 'other']);
    const zeroed = newExercisesData
      .filter(
        ({ equipmentType, loadMultiplier }) =>
          !unloadable.has(equipmentType) && loadMultiplier === 0
      )
      .map(({ __exerciseName }) => __exerciseName);

    expect(zeroed).toEqual([]);
  });

  it('never asks a bodyweight exercise to move more than the whole body', () => {
    const overloaded = newExercisesData
      .filter(
        ({ equipmentType, loadMultiplier }) => equipmentType === 'bodyweight' && loadMultiplier > 1
      )
      .map(({ __exerciseName }) => __exerciseName);

    expect(overloaded).toEqual([]);
  });

  it('keeps cardio and stretching at zero', () => {
    const credited = newExercisesData
      .filter(
        ({ equipmentType, loadMultiplier, mechanicType }) =>
          (mechanicType === 'cardio' ||
            equipmentType === 'cardio' ||
            mechanicType === 'stretching') &&
          loadMultiplier !== 0
      )
      .map(({ __exerciseName }) => __exerciseName);

    expect(credited).toEqual([]);
  });

  it('stays within the scale the bundled catalogue established', () => {
    const bundledMax = Math.max(...exercisesData.map(({ loadMultiplier }) => loadMultiplier));
    const multipliers = newExercisesData.map(({ loadMultiplier }) => loadMultiplier);

    expect(Math.min(...multipliers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...multipliers)).toBeLessThanOrEqual(bundledMax);
  });

  // An exercise the bundled catalogue already has must not be scored differently
  // here — the generator's MUSCLOG_ANCHORS table exists to keep the two aligned.
  it.each([
    ['Barbell Squat', 'Squat'],
    ['Barbell Deadlift', 'Deadlift'],
    ['Barbell Bench Press - Medium Grip', 'Bench Press'],
    ['Leg Press', 'Leg Press Machine'],
    ['Pullups', 'Pull-Up'],
    ['Plank', 'Plank'],
    ['Side Lateral Raise', 'Lateral Raise'],
    ['Cable Crossover', 'Cable Crossover'],
    ['Smith Machine Squat', 'Smith Machine Squat'],
  ])('scores %s exactly as the bundled %s', (newName, bundledName) => {
    const fresh = newExercisesData.find(({ __exerciseName }) => __exerciseName === newName);
    const bundled = exercisesData.find(({ __exerciseName }) => __exerciseName === bundledName);

    expect(fresh).toBeDefined();
    expect(bundled).toBeDefined();
    expect(fresh!.loadMultiplier).toBe(bundled!.loadMultiplier);
  });
});
