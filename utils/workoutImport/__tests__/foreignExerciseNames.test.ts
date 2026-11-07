import { isStrengthGraded } from '@/utils/strengthGradedLifts';
import exercisesData from '@/data/exercisesData.json';
import {
  curatedExerciseSlug,
  curatedExerciseSlugs,
  rawCuratedExerciseNames,
} from '@/utils/workoutImport/foreignExerciseNames';
import { exerciseNameKey } from '@/utils/workoutImport/exerciseMatch';

const catalogueSlugs = new Set(
  (exercisesData as { __freeExerciseDbId: string }[]).map((row) => row.__freeExerciseDbId)
);

describe('curated foreign exercise names', () => {
  it('maps only to slugs that exist in the bundled catalogue', () => {
    const missing = curatedExerciseSlugs().filter((slug) => !catalogueSlugs.has(slug));
    expect(missing).toEqual([]);
  });

  it('covers about a hundred common names', () => {
    expect(rawCuratedExerciseNames().length).toBeGreaterThanOrEqual(100);
  });

  it('never maps two different movements to one normalised key', () => {
    const slugByKey = new Map<string, string>();
    const collisions: string[] = [];
    for (const [name, slug] of rawCuratedExerciseNames()) {
      const key = exerciseNameKey(name);
      const seen = slugByKey.get(key);
      if (seen !== undefined && seen !== slug) {
        collisions.push(`${name} -> ${slug} (already ${seen})`);
      }

      slugByKey.set(key, slug);
    }

    expect(collisions).toEqual([]);
  });

  it('looks names up by their normalised key, so case and brackets do not matter', () => {
    expect(curatedExerciseSlug(exerciseNameKey('BENCH PRESS (Barbell)'))).toBe(
      'Barbell_Bench_Press_-_Medium_Grip'
    );
    expect(curatedExerciseSlug(exerciseNameKey('Squat (Barbell)'))).toBe('Barbell_Squat');
    expect(curatedExerciseSlug(exerciseNameKey('Pull Up'))).toBe('Pullups');
  });

  it('leaves out an assisted pull-up rather than mapping it to a plain one', () => {
    expect(curatedExerciseSlug(exerciseNameKey('Pull Up (Assisted)'))).toBeUndefined();
  });
  it('sends imported main lifts to the exercises strength levels grade', () => {
    const names = [
      'Squat (Barbell)',
      'Bench Press (Barbell)',
      'Deadlift (Barbell)',
      'Overhead Press (Barbell)',
      'Bent Over Row (Barbell)',
      'Front Squat (Barbell)',
      'Incline Bench Press (Barbell)',
      'Romanian Deadlift (Barbell)',
      'Hip Thrust (Barbell)',
      'Bicep Curl (Barbell)',
      'Bench Press (Dumbbell)',
      'Shoulder Press (Dumbbell)',
      'Bicep Curl (Dumbbell)',
    ];

    for (const name of names) {
      const slug = curatedExerciseSlug(exerciseNameKey(name));
      expect({ name, graded: isStrengthGraded(`fx-${slug}`) }).toEqual({ name, graded: true });
    }
  });
});
