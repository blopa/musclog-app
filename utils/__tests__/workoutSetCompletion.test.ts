import { isLoggedWorkoutSet, markUnloggedWorkoutSetsSkipped } from '@/utils/workoutSetCompletion';

describe('workout set completion state', () => {
  it('only treats a submitted, non-skipped set as logged', () => {
    expect(isLoggedWorkoutSet({ difficultyLevel: 7, isSkipped: false })).toBe(true);
    expect(isLoggedWorkoutSet({ difficultyLevel: 0, isSkipped: false })).toBe(false);
    expect(isLoggedWorkoutSet({ difficultyLevel: 7, isSkipped: true })).toBe(false);
  });

  it('marks legacy unsubmitted template placeholders skipped without changing logged rows', () => {
    const logged = { id: 'logged', difficultyLevel: 7, isSkipped: false };
    const placeholder = { id: 'placeholder', difficultyLevel: 0, isSkipped: false };

    const result = markUnloggedWorkoutSetsSkipped([logged, placeholder]);

    expect(result[0]).toBe(logged);
    expect(result[1]).toEqual({ ...placeholder, isSkipped: true });
  });
});
