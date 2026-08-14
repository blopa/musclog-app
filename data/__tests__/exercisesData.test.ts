import exercisesData from '@/data/exercisesData.json';
import exercisesEnUs from '@/data/exercisesEnUS.json';
import exercisesEsEs from '@/data/exercisesEsEs.json';
import exercisesNlNl from '@/data/exercisesNlNl.json';
import exercisesPtBr from '@/data/exercisesPtBr.json';
import exercisesRuRu from '@/data/exercisesRuRu.json';
import { getExerciseCatalogue } from '@/data/exerciseCatalogue';
import legacyExercisesData from '@/data/legacyExercisesData.json';
import { MUSCLE_SEED_DATA } from '@/database/services/MuscleService';

const { POPULAR_EXERCISE_SLUGS } = require('../../scripts/exercise-popularity-policy') as {
  POPULAR_EXERCISE_SLUGS: Set<string>;
};

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

const EXERCISE_COPIES = {
  'en-US': exercisesEnUs,
  'es-ES': exercisesEsEs,
  'nl-NL': exercisesNlNl,
  'pt-BR': exercisesPtBr,
  'ru-RU': exercisesRuRu,
};

describe('exercise catalogue copy', () => {
  it.each(Object.entries(EXERCISE_COPIES))(
    'provides a %s name and description for every exercise',
    (_locale, copy) => {
      expect(copy).toHaveLength(exercisesData.length);
      expect(copy.map(({ exerciseSlug }) => exerciseSlug)).toEqual(
        exercisesData.map(({ __freeExerciseDbId }) => __freeExerciseDbId)
      );
      expect(copy.every(({ description, name }) => /\S/.test(name) && /\S/.test(description))).toBe(
        true
      );
    }
  );

  it.each(Object.entries(EXERCISE_COPIES))(
    'uses only locale-copy fields in %s',
    (_locale, copy) => {
      const keys = new Set(copy.flatMap((entry) => Object.keys(entry)));

      expect([...keys].sort()).toEqual(['description', 'exerciseSlug', 'name']);
    }
  );

  it('keeps the generated English names aligned with the structural catalogue', () => {
    expect(exercisesEnUs.map(({ name }) => name)).toEqual(
      exercisesData.map(({ __exerciseName }) => __exerciseName)
    );
  });

  it.each(Object.keys(EXERCISE_COPIES))('joins %s copy to structure by stable slug', (locale) => {
    const catalogue = getExerciseCatalogue(locale);

    expect(catalogue.map(({ exerciseSlug }) => exerciseSlug)).toEqual(
      exercisesData.map(({ __freeExerciseDbId }) => __freeExerciseDbId)
    );
  });
});

describe('exercise catalogue schema', () => {
  it('carries the whole free-exercise-db catalogue', () => {
    expect(exercisesData).toHaveLength(873);
  });

  it('uses exactly the runtime fields plus the two maintainer fields', () => {
    const keys = new Set(exercisesData.flatMap((entry) => Object.keys(entry)));

    expect([...keys].sort()).toEqual([
      '__exerciseName',
      '__freeExerciseDbId',
      'equipmentType',
      'exerciseIndex',
      'isPopular',
      'loadMultiplier',
      'mechanicType',
      'muscleGroup',
      'targetMuscles',
    ]);
  });

  it('marks exactly the 100 curated popular exercise slugs', () => {
    const popularExercises = exercisesData.filter((entry) => 'isPopular' in entry);

    expect(popularExercises).toHaveLength(100);
    expect(popularExercises.every(({ isPopular }) => isPopular === true)).toBe(true);
    expect(new Set(popularExercises.map(({ __freeExerciseDbId }) => __freeExerciseDbId))).toEqual(
      POPULAR_EXERCISE_SLUGS
    );
  });

  it('numbers display order contiguously from one without using it as a database id', () => {
    const indexes = exercisesData.map(({ exerciseIndex }) => exerciseIndex);

    expect(indexes).toEqual(indexes.map((_, index) => index + 1));
    expect(new Set(indexes).size).toBe(indexes.length);
  });

  it('gives every exercise a unique, path-safe free-exercise-db slug', () => {
    const slugs = exercisesData.map(({ __freeExerciseDbId }) => __freeExerciseDbId);

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((slug) => /^[A-Za-z0-9_()-]+$/.test(slug))).toBe(true);
  });

  it('names every exercise uniquely', () => {
    const names = exercisesData.map(({ __exerciseName }) => __exerciseName);

    expect(new Set(names).size).toBe(names.length);
  });

  it.each([
    ['muscleGroup', EXERCISE_JSON_MUSCLE_GROUPS],
    ['equipmentType', EQUIPMENT_TYPES],
    ['mechanicType', MECHANIC_TYPES],
  ] as const)('keeps %s within its union', (field, allowed) => {
    const offenders = exercisesData
      .filter((entry) => !allowed.includes(entry[field]))
      .map((entry) => `${entry.__exerciseName}: ${entry[field]}`);

    expect(offenders).toEqual([]);
  });

  it('keeps every Smith movement in the dedicated equipment family', () => {
    const smithExercises = exercisesData.filter(({ __exerciseName }) =>
      /smith/i.test(__exerciseName)
    );

    expect(smithExercises).toHaveLength(20);
    expect(smithExercises.every(({ equipmentType }) => equipmentType === 'smith_machine')).toBe(
      true
    );
  });

  it('targets only muscles that MUSCLE_SEED_DATA seeds', () => {
    const offenders = exercisesData
      .flatMap(({ __exerciseName, targetMuscles }) =>
        targetMuscles.map((muscle) => ({ muscle, name: __exerciseName }))
      )
      .filter(({ muscle }) => !KNOWN_MUSCLES.has(muscle))
      .map(({ muscle, name }) => `${name}: ${muscle}`);

    expect(offenders).toEqual([]);
  });

  it('gives every exercise at least one target muscle, without repeats', () => {
    const empty = exercisesData
      .filter(({ targetMuscles }) => targetMuscles.length === 0)
      .map(({ __exerciseName }) => __exerciseName);
    const duplicated = exercisesData
      .filter(({ targetMuscles }) => new Set(targetMuscles).size !== targetMuscles.length)
      .map(({ __exerciseName }) => __exerciseName);

    expect(empty).toEqual([]);
    expect(duplicated).toEqual([]);
  });
});

describe('exercise catalogue loadMultiplier', () => {
  const multiplierByName = new Map(
    exercisesData.map(({ __exerciseName, loadMultiplier }) => [__exerciseName, loadMultiplier])
  );

  it('gives every externally loaded exercise a non-zero multiplier', () => {
    const unloadable = new Set(['bodyweight', 'cardio', 'medicine_ball', 'other']);
    const zeroed = exercisesData
      .filter(
        ({ equipmentType, loadMultiplier }) =>
          !unloadable.has(equipmentType) && loadMultiplier === 0
      )
      .map(({ __exerciseName }) => __exerciseName);

    expect(zeroed).toEqual([]);
  });

  it('never asks a bodyweight exercise to move more than the whole body', () => {
    const overloaded = exercisesData
      .filter(
        ({ equipmentType, loadMultiplier }) => equipmentType === 'bodyweight' && loadMultiplier > 1
      )
      .map(({ __exerciseName }) => __exerciseName);

    expect(overloaded).toEqual([]);
  });

  it('keeps cardio and stretching at zero', () => {
    const credited = exercisesData
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

  it('stays within the scale the frozen legacy catalogue established', () => {
    const legacyMax = Math.max(...legacyExercisesData.map(({ loadMultiplier }) => loadMultiplier));
    const multipliers = exercisesData.map(({ loadMultiplier }) => loadMultiplier);

    expect(Math.min(...multipliers)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...multipliers)).toBeLessThanOrEqual(legacyMax);
  });

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
  ])('scores %s exactly as the legacy %s', (newName, legacyName) => {
    const current = exercisesData.find(({ __exerciseName }) => __exerciseName === newName);
    const legacy = legacyExercisesData.find(({ __exerciseName }) => __exerciseName === legacyName);

    expect(current).toBeDefined();
    expect(legacy).toBeDefined();
    expect(current!.loadMultiplier).toBe(legacy!.loadMultiplier);
  });

  it('does not impose an isolation-level ceiling on all cable exercises', () => {
    const cableMultipliers = exercisesData
      .filter(({ equipmentType }) => equipmentType === 'cable')
      .map(({ loadMultiplier }) => loadMultiplier);

    expect(Math.max(...cableMultipliers)).toBeGreaterThanOrEqual(1);
  });

  it.each([
    ['Standing Cable Chest Press', 'Cable Chest Press'],
    ['Cable Shoulder Press', 'Seated Cable Shoulder Press'],
    ['Single-Arm Cable Crossover', 'Cable Crossover'],
    ['Standing One-Arm Cable Curl', 'Standing Biceps Cable Curl'],
    ['Seated One-arm Cable Pulley Rows', 'Seated Cable Rows'],
  ])('keeps unsupported or unilateral %s below %s', (limited, supported) => {
    expect(multiplierByName.get(limited)!).toBeLessThan(multiplierByName.get(supported)!);
  });
});
