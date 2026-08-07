import exercisesData from '@/data/exercisesData.json';
import { applyWorkoutTemplateCopies, workoutTemplates } from '@/data/workoutTemplates';

describe('workout template copies', () => {
  it('overlays localized copy without losing the workout definition', () => {
    const [template] = applyWorkoutTemplateCopies(
      [
        {
          title: 'Fallback title',
          duration: 45,
          exercises: [{ exerciseId: 1, day: 1, sets: 3, reps: 8 }],
        },
      ],
      [{ title: 'Localized title', description: 'Localized description' }]
    );

    expect(template).toEqual({
      title: 'Localized title',
      description: 'Localized description',
      duration: 45,
      exercises: [{ exerciseId: 1, day: 1, sets: 3, reps: 8 }],
    });
  });

  it('keeps the base template when no localized copy exists at its index', () => {
    expect(applyWorkoutTemplateCopies([{ title: 'Fallback title', duration: 30 }], [])).toEqual([
      { title: 'Fallback title', duration: 30 },
    ]);
  });
});

describe('Cable Superset Workout', () => {
  const program = workoutTemplates.find(({ title }) => title === 'Cable Superset Workout');

  it('ships the five training sessions from the seven-day split', () => {
    expect(program).toBeDefined();
    expect([...new Set(program?.exercises.map(({ day }) => day))]).toEqual([1, 2, 3, 5, 6]);
    expect(program?.dayNames).toEqual({
      '1': 'Upper A',
      '2': 'Lower A',
      '3': 'Arms',
      '5': 'Upper B',
      '6': 'Lower B',
    });
    expect(program?.exercises).toHaveLength(33);
  });

  it('keeps every paired movement in a two-exercise superset group', () => {
    if (!program) {
      throw new Error('Cable Superset Workout is missing');
    }

    const groups = new Map<string, typeof program.exercises>();
    for (const exercise of program.exercises) {
      if (!exercise.supersetGroup) {
        continue;
      }

      const key = `${exercise.day}-${exercise.supersetGroup}`;
      groups.set(key, [...(groups.get(key) ?? []), exercise]);
    }

    expect([...groups.values()].every((exercises) => exercises.length === 2)).toBe(true);
    expect(program.exercises.filter(({ supersetGroup }) => supersetGroup)).toHaveLength(28);

    expect(groups.get('5-C')?.map(({ sets }) => sets)).toEqual([2, 3]);
    expect(groups.get('6-B')?.map(({ sets }) => sets)).toEqual([3, 4]);
  });

  it('references bundled exercises and includes valid progression/rest targets', () => {
    if (!program) {
      throw new Error('Cable Superset Workout is missing');
    }

    const exerciseIds = new Set(exercisesData.map(({ exerciseIndex }) => exerciseIndex));

    for (const exercise of program.exercises) {
      expect(exerciseIds.has(exercise.exerciseId)).toBe(true);
      expect(exercise.minReps).toBeLessThanOrEqual(exercise.reps);
      expect(exercise.restTimeAfter).toBeGreaterThan(0);
      expect(exercise.notes).toEqual(expect.any(String));
    }
  });
});
