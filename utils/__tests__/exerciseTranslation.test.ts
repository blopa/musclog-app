import {
  getExerciseTypeTranslationKey,
  getMechanicTypeTranslationKey,
  getMuscleGroupTranslationKey,
} from '@/utils/exerciseTranslation';

describe('getMuscleGroupTranslationKey', () => {
  it('buckets raw DB muscle groups into the five UI buckets', () => {
    expect(getMuscleGroupTranslationKey('chest')).toBe('workout.muscleGroups.chest');
    expect(getMuscleGroupTranslationKey('back')).toBe('workout.muscleGroups.back');
    expect(getMuscleGroupTranslationKey('legs')).toBe('workout.muscleGroups.legs');
    expect(getMuscleGroupTranslationKey('arms')).toBe('workout.muscleGroups.arms');
    expect(getMuscleGroupTranslationKey('cardio')).toBe('workout.muscleGroups.other');
  });

  it('matches on substrings, so target muscles fold into their parent bucket', () => {
    expect(getMuscleGroupTranslationKey('pectoralis_major_chest')).toBe(
      'workout.muscleGroups.chest'
    );
    expect(getMuscleGroupTranslationKey('lats')).toBe('workout.muscleGroups.back');
    expect(getMuscleGroupTranslationKey('upper_back')).toBe('workout.muscleGroups.back');
    expect(getMuscleGroupTranslationKey('hamstrings')).toBe('workout.muscleGroups.legs');
    expect(getMuscleGroupTranslationKey('glutes')).toBe('workout.muscleGroups.legs');
    expect(getMuscleGroupTranslationKey('quadriceps')).toBe('workout.muscleGroups.legs');
    expect(getMuscleGroupTranslationKey('biceps')).toBe('workout.muscleGroups.arms');
    expect(getMuscleGroupTranslationKey('triceps')).toBe('workout.muscleGroups.arms');
  });

  it('folds shoulders/deltoids into the arms bucket (there is no shoulders key)', () => {
    expect(getMuscleGroupTranslationKey('shoulders')).toBe('workout.muscleGroups.arms');
    expect(getMuscleGroupTranslationKey('anterior_deltoid')).toBe('workout.muscleGroups.arms');
  });

  it('normalizes case before matching', () => {
    expect(getMuscleGroupTranslationKey('CHEST')).toBe('workout.muscleGroups.chest');
    expect(getMuscleGroupTranslationKey('Upper Back')).toBe('workout.muscleGroups.back');
    expect(getMuscleGroupTranslationKey('Legs')).toBe('workout.muscleGroups.legs');
  });

  it('checks back before arms, so any group containing "lat" wins the back bucket', () => {
    // Documents the branch ordering: `lateral_deltoid` is a shoulder muscle but contains
    // "lat", and the back branch runs first. Reordering the branches would change this.
    expect(getMuscleGroupTranslationKey('lateral_deltoid')).toBe('workout.muscleGroups.back');
  });

  it('falls back to the other bucket for unknown or empty values instead of throwing', () => {
    expect(getMuscleGroupTranslationKey('')).toBe('workout.muscleGroups.other');
    expect(getMuscleGroupTranslationKey('neck')).toBe('workout.muscleGroups.other');
    expect(getMuscleGroupTranslationKey('full_body')).toBe('workout.muscleGroups.other');
    // The optional-chained `muscleGroup?.toLowerCase()` is the only nullish guard in the file.
    expect(getMuscleGroupTranslationKey(undefined as unknown as string)).toBe(
      'workout.muscleGroups.other'
    );
    expect(getMuscleGroupTranslationKey(null as unknown as string)).toBe(
      'workout.muscleGroups.other'
    );
  });

  it('does not match "calves" against the "calf" leg keyword', () => {
    // Regression marker: the legs branch tests for "calf", which the plural spelling stored
    // in the exercise tables does not contain, so it lands in `other`.
    expect(getMuscleGroupTranslationKey('calves')).toBe('workout.muscleGroups.other');
    expect(getMuscleGroupTranslationKey('calf')).toBe('workout.muscleGroups.legs');
  });
});

describe('getExerciseTypeTranslationKey / getMechanicTypeTranslationKey', () => {
  it('lowercases the raw DB value into the shared exerciseTypes namespace', () => {
    expect(getExerciseTypeTranslationKey('Barbell')).toBe('workout.exerciseTypes.barbell');
    expect(getExerciseTypeTranslationKey('BODYWEIGHT')).toBe('workout.exerciseTypes.bodyweight');
    expect(getMechanicTypeTranslationKey('Compound')).toBe('workout.exerciseTypes.compound');
    expect(getMechanicTypeTranslationKey('ISOLATION')).toBe('workout.exerciseTypes.isolation');
  });

  it('shares one namespace, so equipment and mechanic values must not collide', () => {
    // Both helpers write into `workout.exerciseTypes.*`; a mechanic type named like an
    // equipment type would silently resolve to the same translation entry.
    expect(getExerciseTypeTranslationKey('cable')).toBe(getMechanicTypeTranslationKey('Cable'));
  });

  it('passes the value through verbatim apart from casing (no space/whitespace handling)', () => {
    expect(getExerciseTypeTranslationKey('Smith Machine')).toBe(
      'workout.exerciseTypes.smith machine'
    );
    expect(getExerciseTypeTranslationKey('')).toBe('workout.exerciseTypes.');
  });
});
