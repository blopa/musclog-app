import { act, renderHook } from '@testing-library/react';
import { useActiveWorkout } from '@/hooks/useActiveWorkout';

const mockState = {
  workoutLog: { id: 'log' },
  exercises: [{ id: 'bench', name: 'Bench' }],
  logExercises: [],
  sets: [
    {
      id: 'first',
      logExerciseId: 'block-a',
      exerciseId: 'bench',
      completionStatus: 'planned',
      setOrder: 1,
    },
    {
      id: 'second',
      logExerciseId: 'block-b',
      exerciseId: 'bench',
      completionStatus: 'planned',
      setOrder: 2,
    },
  ],
  progress: { totalSets: 2, completedSets: 0, currentSetOrder: 1, isComplete: false },
  refresh: jest.fn(),
  isLoading: false,
  error: null,
};
jest.mock('@/hooks/useWorkoutSessionState', () => ({ useWorkoutSessionState: () => mockState }));
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { getActiveWorkout: jest.fn() },
}));
it('selects and numbers duplicate movements by their logged block identity', () => {
  const hook = renderHook(() => useActiveWorkout('log'));
  expect(hook.result.current.currentSetData?.set.id).toBe('first');
  act(() => hook.result.current.setCurrentLogExercise('block-b'));
  expect(hook.result.current.currentSetData).toMatchObject({
    set: { id: 'second', logExerciseId: 'block-b' },
    setNumber: 1,
    totalSetsInExercise: 1,
    exerciseNumber: 2,
  });
  hook.unmount();
});
