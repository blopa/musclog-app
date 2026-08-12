import { normalizeWorkoutSetCompletionForImport } from '@/database/workoutSetImportNormalization';

describe('normalizeWorkoutSetCompletionForImport', () => {
  it('uses workout relationships to distinguish imports from template placeholders', () => {
    const dump = {
      workout_logs: [
        { id: 'template-log', template_id: 'template-1', completed_at: 1, total_volume: 900 },
        { id: 'import-log', template_id: null, completed_at: 1, total_volume: 800 },
        { id: 'active-log', template_id: 'template-2', completed_at: null, total_volume: null },
      ],
      workout_log_exercises: [
        { id: 'template-exercise', workout_log_id: 'template-log' },
        { id: 'import-exercise', workout_log_id: 'import-log' },
        { id: 'active-exercise', workout_log_id: 'active-log' },
      ],
      workout_log_sets: [
        {
          id: 'performed-template-set',
          log_exercise_id: 'template-exercise',
          difficulty_level: 8,
          is_skipped: false,
        },
        {
          id: 'template-placeholder',
          log_exercise_id: 'template-exercise',
          difficulty_level: 0,
          is_skipped: false,
        },
        {
          id: 'unrated-import-set',
          log_exercise_id: 'import-exercise',
          difficulty_level: 0,
          is_skipped: false,
        },
        {
          id: 'active-planned-set',
          log_exercise_id: 'active-exercise',
          difficulty_level: 0,
          is_skipped: false,
        },
      ],
    };

    normalizeWorkoutSetCompletionForImport(dump);

    expect(dump.workout_log_sets.map((set) => set.completion_status)).toEqual([
      'performed',
      'skipped',
      'performed',
      'planned',
    ]);
    expect(dump.workout_log_sets.map((set) => set.difficulty_level)).toEqual([8, null, null, null]);
    expect(dump.workout_logs[0].total_volume).toBeNull();
    expect(dump.workout_logs[1].total_volume).toBe(800);
  });

  it('preserves an explicit status while normalizing the obsolete zero RPE sentinel', () => {
    const dump = {
      workout_logs: [{ id: 'log', completed_at: 1, total_volume: 100 }],
      workout_log_exercises: [{ id: 'exercise', workout_log_id: 'log' }],
      workout_log_sets: [
        {
          id: 'set',
          log_exercise_id: 'exercise',
          completion_status: 'performed',
          difficulty_level: 0,
        },
      ],
    };

    normalizeWorkoutSetCompletionForImport(dump);

    expect(dump.workout_log_sets[0]).toMatchObject({
      completion_status: 'performed',
      difficulty_level: null,
    });
    expect(dump.workout_logs[0].total_volume).toBe(100);
  });
});
