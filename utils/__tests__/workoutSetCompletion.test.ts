import {
  assertValidWorkoutSetDifficultyLevel,
  inferLegacyWorkoutSetCompletionStatus,
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isResolvedWorkoutSet,
  isSkippedWorkoutSet,
  isValidWorkoutSetDifficultyLevel,
  isWarmupSet,
  isWorkingSet,
  WARMUP_SET_TYPE,
} from '@/utils/workoutSetCompletion';

describe('workout set completion state', () => {
  it('derives lifecycle from completionStatus independently of RPE', () => {
    expect(isPerformedWorkoutSet({ completionStatus: 'performed' })).toBe(true);
    expect(
      isPerformedWorkoutSet({ completionStatus: 'performed', difficultyLevel: undefined })
    ).toBe(true);
    expect(isPerformedWorkoutSet({ completionStatus: 'planned', difficultyLevel: 7 })).toBe(false);
    expect(isSkippedWorkoutSet({ completionStatus: 'skipped', difficultyLevel: 7 })).toBe(true);
    expect(isPlannedWorkoutSet({ completionStatus: 'planned' })).toBe(true);
    expect(isResolvedWorkoutSet({ completionStatus: 'performed' })).toBe(true);
    expect(isResolvedWorkoutSet({ completionStatus: 'skipped' })).toBe(true);
    expect(isResolvedWorkoutSet({ completionStatus: 'planned' })).toBe(false);
  });

  it('infers performed imports and skipped template placeholders during legacy migration', () => {
    expect(
      inferLegacyWorkoutSetCompletionStatus({
        difficultyLevel: 0,
        workoutCompleted: true,
        workoutHasTemplate: false,
      })
    ).toBe('performed');
    expect(
      inferLegacyWorkoutSetCompletionStatus({
        difficultyLevel: 0,
        workoutCompleted: true,
        workoutHasTemplate: true,
      })
    ).toBe('skipped');
    expect(
      inferLegacyWorkoutSetCompletionStatus({
        difficultyLevel: 8,
        workoutCompleted: true,
        workoutHasTemplate: true,
      })
    ).toBe('performed');
    expect(
      inferLegacyWorkoutSetCompletionStatus({
        difficultyLevel: 8,
        isSkipped: true,
        workoutCompleted: true,
        workoutHasTemplate: true,
      })
    ).toBe('skipped');
    expect(
      inferLegacyWorkoutSetCompletionStatus({
        difficultyLevel: 0,
        workoutCompleted: false,
        workoutHasTemplate: true,
      })
    ).toBe('planned');
  });

  it('accepts an omitted RPE but rejects sentinel and out-of-range ratings', () => {
    expect(isValidWorkoutSetDifficultyLevel(undefined)).toBe(true);
    expect(isValidWorkoutSetDifficultyLevel(null)).toBe(true);
    expect(isValidWorkoutSetDifficultyLevel(1)).toBe(true);
    expect(isValidWorkoutSetDifficultyLevel(10)).toBe(true);
    expect(isValidWorkoutSetDifficultyLevel(0)).toBe(false);
    expect(isValidWorkoutSetDifficultyLevel(11)).toBe(false);
    expect(isValidWorkoutSetDifficultyLevel(Number.NaN)).toBe(false);
    expect(() => assertValidWorkoutSetDifficultyLevel(0)).toThrow(
      'Difficulty level must be between 1 and 10'
    );
  });
});

describe('warm-up sets', () => {
  it('recognises a warm-up by set type alone', () => {
    expect(WARMUP_SET_TYPE).toBe('warmup');
    expect(isWarmupSet({ setType: 'warmup' })).toBe(true);
    expect(isWarmupSet({ setType: 'normal' })).toBe(false);
    expect(isWarmupSet({ setType: 'drop_set' })).toBe(false);
    expect(isWarmupSet({})).toBe(false);
    expect(isWarmupSet({ setType: null })).toBe(false);
  });

  it('counts a set as working only when it is performed AND not a warm-up', () => {
    expect(isWorkingSet({ completionStatus: 'performed', setType: 'normal' })).toBe(true);
    expect(isWorkingSet({ completionStatus: 'performed', setType: 'drop_set' })).toBe(true);
    expect(isWorkingSet({ completionStatus: 'performed' })).toBe(true);
    expect(isWorkingSet({ completionStatus: 'performed', setType: 'warmup' })).toBe(false);
  });

  it('keeps lifecycle and kind independent: a planned or skipped set is never working', () => {
    expect(isWorkingSet({ completionStatus: 'planned', setType: 'normal' })).toBe(false);
    expect(isWorkingSet({ completionStatus: 'skipped', setType: 'normal' })).toBe(false);
    // …and a performed warm-up is still performed: history, calories and Health Connect keep it.
    expect(isPerformedWorkoutSet({ completionStatus: 'performed', setType: 'warmup' })).toBe(true);
  });
});
