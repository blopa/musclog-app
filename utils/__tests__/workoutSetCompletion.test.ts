import {
  assertValidWorkoutSetDifficultyLevel,
  inferLegacyWorkoutSetCompletionStatus,
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isResolvedWorkoutSet,
  isSkippedWorkoutSet,
  isValidWorkoutSetDifficultyLevel,
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
