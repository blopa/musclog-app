import {
  toPerformedWorkoutLogSetSnapshots,
  toWorkoutLogSetSnapshot,
} from '@/database/workoutLogSetSnapshot';

const setRecord = (completionStatus: unknown) =>
  ({
    id: 'set-1',
    logExerciseId: 'model-exercise',
    reps: 1,
    weight: 2,
    restTimeAfter: 3,
    repsInReserve: 4,
    completionStatus: 'planned',
    difficultyLevel: 7,
    setType: 'warmup',
    setOrder: 5,
    createdAt: 6,
    updatedAt: 7,
    _raw: {
      log_exercise_id: 'raw-exercise',
      reps: 8,
      weight: 9,
      rest_time_after: 10,
      reps_in_reserve: 1,
      completion_status: completionStatus,
      difficulty_level: null,
      set_type: 'normal',
      set_order: 2,
      created_at: 11,
      updated_at: 12,
      deleted_at: null,
    },
  }) as never;

describe('workoutLogSetSnapshot', () => {
  it('projects raw database values through one validated plain-data shape', () => {
    expect(toWorkoutLogSetSnapshot(setRecord('performed'))).toMatchObject({
      id: 'set-1',
      logExerciseId: 'raw-exercise',
      reps: 8,
      weight: 9,
      completionStatus: 'performed',
      difficultyLevel: undefined,
      setOrder: 2,
    });
  });

  it('does not cast an unknown lifecycle value into a performed set', () => {
    expect(toWorkoutLogSetSnapshot(setRecord('done')).completionStatus).toBeUndefined();
    expect(
      toPerformedWorkoutLogSetSnapshots([setRecord('done'), setRecord('performed')])
    ).toHaveLength(1);
  });
});
