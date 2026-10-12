import { act, renderHook } from '@testing-library/react';
import { useWorkoutFeedback } from '@/hooks/useWorkoutFeedback';
import { WorkoutService } from '@/database/services/WorkoutService';
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { updateWorkoutLogFeedback: jest.fn(async () => {}), completeWorkout: jest.fn() },
}));
it('saves optional summary feedback with the existing ratings and note contract', async () => {
  const hook = renderHook(() => useWorkoutFeedback());
  await act(() =>
    hook.result.current.submitFeedback('log', {
      difficulty: 7,
      exhaustion: 5,
      enjoyment: 9,
      notes: 'Good session',
    })
  );
  expect(WorkoutService.updateWorkoutLogFeedback).toHaveBeenCalledWith('log', {
    exhaustionLevel: 5,
    workoutScore: 7,
    notes: 'Good session',
  });
  expect(WorkoutService.completeWorkout).not.toHaveBeenCalled();
  hook.unmount();
});
