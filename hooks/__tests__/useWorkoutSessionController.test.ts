import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { WorkoutSessionService } from '@/database/services/WorkoutSessionService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { NotificationService } from '@/services/NotificationService';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getWorkoutView: jest.fn(async () => 'inline'),
    setWorkoutView: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { completeWorkout: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/WorkoutSessionService', () => ({
  WorkoutSessionService: { saveSet: jest.fn(async () => {}) },
}));
jest.mock('@/services/NotificationService', () => ({
  NotificationService: {
    scheduleRestTimerNotification: jest.fn(async () => {}),
    cancelRestTimerNotification: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/services/WorkoutProgressionService', () => ({
  WorkoutProgressionService: { revertStartAdjustment: jest.fn(async () => 1) },
}));
jest.mock('@/utils/activeWorkoutStorage', () => ({
  getRestTimerEndAt: jest.fn(async () => Date.now() + 90000),
  setRestTimerEndAt: jest.fn(async () => {}),
  clearRestTimerEndAt: jest.fn(async () => {}),
}));
const set = {
  id: 's1',
  weight: 60,
  reps: 10,
  completionStatus: 'planned',
  restTimeAfter: 60,
} as any;
const options = { autoRest: true, defaultRest: 90, refresh: jest.fn(async () => {}) };
beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
});

it('keeps pending inputs and the timer through view switches and a controller restart', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => hook.result.current.edit('s1', { weight: '62,5', reps: '11', rir: '' }));
  await act(() => hook.result.current.changeView('guided'));
  expect(hook.result.current.drafts.s1.weight).toBe('62,5');
  expect(hook.result.current.restSeconds).toBeGreaterThan(85);
  await waitFor(async () =>
    expect(await AsyncStorage.getItem('workout_drafts_log')).toContain('62,5')
  );
  hook.unmount();
  const restart = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(restart.result.current.drafts.s1?.weight).toBe('62,5'));
  expect(restart.result.current.restSeconds).toBeGreaterThan(85);
  restart.unmount();
});
it('both views use identical completion writes and completion does not finish the session', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  const values = { weight: 62.5, reps: 10 };
  await act(() => hook.result.current.complete('s1', values));
  await act(() => hook.result.current.changeView('guided'));
  await act(() => hook.result.current.complete('s1', values));
  expect(WorkoutSessionService.saveSet).toHaveBeenNthCalledWith(
    1,
    'log',
    's1',
    'performed',
    values
  );
  expect(WorkoutSessionService.saveSet).toHaveBeenNthCalledWith(
    2,
    'log',
    's1',
    'performed',
    values
  );
  expect(WorkoutService.completeWorkout).not.toHaveBeenCalled();
  hook.unmount();
});
it('reopens performed sets without overwriting their values', async () => {
  const hook = renderHook(() =>
    useWorkoutSessionController('log', [{ ...set, completionStatus: 'performed' }], options)
  );
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  await act(() => hook.result.current.complete('s1', { weight: 0, reps: 0 }));
  expect(WorkoutSessionService.saveSet).toHaveBeenCalledWith('log', 's1', 'planned');
  hook.unmount();
});
it('keeps inputs after a failed set save and clears them only after explicit finish', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => hook.result.current.edit('s1', { weight: '62.5', reps: '10' }));
  jest.mocked(WorkoutSessionService.saveSet).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => {
    await expect(hook.result.current.complete('s1', { weight: 62.5, reps: 10 })).rejects.toThrow();
  });
  expect(hook.result.current.drafts.s1.weight).toBe('62.5');
  await act(() => hook.result.current.finish());
  expect(WorkoutService.completeWorkout).toHaveBeenCalledWith('log');
  expect(await AsyncStorage.getItem('workout_drafts_log')).toBeNull();
  hook.unmount();
});

it('lengthens a running rest, moves its reminder, and keeps one rest id until a new rest starts', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  await act(() => hook.result.current.startRest(60));
  const id = hook.result.current.restId;
  expect(hook.result.current.restTotal).toBe(60);

  await act(() => hook.result.current.adjustRest(30));
  expect(hook.result.current.restSeconds).toBeGreaterThan(85);
  expect(hook.result.current.restTotal).toBe(90);
  // Adjusting is the same rest: a panel the user expanded for it stays expanded.
  expect(hook.result.current.restId).toBe(id);
  expect(NotificationService.cancelRestTimerNotification).toHaveBeenCalled();
  expect(NotificationService.scheduleRestTimerNotification).toHaveBeenLastCalledWith(
    expect.any(Number)
  );

  await act(() => hook.result.current.startRest(45));
  expect(hook.result.current.restId).toBe(id + 1);
  hook.unmount();
});

it('undoes a start adjustment through the controller and refreshes the session', async () => {
  const refresh = jest.fn(async () => {});
  const hook = renderHook(() => useWorkoutSessionController('log', [set], { ...options, refresh }));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  await act(() => hook.result.current.revert('le-1'));
  expect(WorkoutProgressionService.revertStartAdjustment).toHaveBeenCalledWith('le-1');
  expect(refresh).toHaveBeenCalled();
  hook.unmount();
});
