import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useWorkoutSessionController } from '@/hooks/useWorkoutSessionController';
import { WorkoutSessionService } from '@/database/services/WorkoutSessionService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { NotificationService } from '@/services/NotificationService';
import {
  clearActiveWorkoutLogId,
  clearRestTimerEndAt,
  getRestTimerEndAt,
} from '@/utils/activeWorkoutStorage';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getWorkoutView: jest.fn(async () => 'inline'),
    setWorkoutView: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: {
    completeWorkout: jest.fn(async () => {}),
    deleteWorkoutLog: jest.fn(async () => {}),
  },
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
  clearActiveWorkoutLogId: jest.fn(async () => {}),
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
    await expect(hook.result.current.complete('s1', { weight: 62.5, reps: 10 })).resolves.toBe(
      false
    );
  });
  expect(hook.result.current.error?.message).toBe('disk full');
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

it('undo clears affected unfinished drafts from memory and storage, leaving other blocks alone', async () => {
  const rows = [
    { ...set, logExerciseId: 'bench', id: 'pending' },
    { ...set, logExerciseId: 'bench', id: 'performed', completionStatus: 'performed' },
    { ...set, logExerciseId: 'squat', id: 'other' },
  ];
  const hook = renderHook(() => useWorkoutSessionController('log', rows, options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => {
    for (const row of rows) hook.result.current.edit(row.id, { weight: '72', reps: '9' });
  });
  await act(() => hook.result.current.revert('bench'));
  expect(hook.result.current.drafts.pending).toBeUndefined();
  expect(hook.result.current.drafts.performed.weight).toBe('72');
  expect(hook.result.current.drafts.other.weight).toBe('72');
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem('workout_drafts_log'))!)).not.toHaveProperty(
      'pending'
    )
  );
  hook.unmount();
  const restart = renderHook(() => useWorkoutSessionController('log', rows, options));
  await waitFor(() => expect(restart.result.current.busy).toBe(false));
  expect(restart.result.current.drafts.pending).toBeUndefined();
  expect(restart.result.current.drafts.other.weight).toBe('72');
  restart.unmount();
});
it('a failed undo preserves drafts for retry', async () => {
  const hook = renderHook(() =>
    useWorkoutSessionController('log', [{ ...set, logExerciseId: 'bench' }], options)
  );
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => hook.result.current.edit('s1', { weight: '72', reps: '9' }));
  jest
    .mocked(WorkoutProgressionService.revertStartAdjustment)
    .mockRejectedValueOnce(new Error('disk full'));
  await act(async () => {
    await expect(hook.result.current.revert('bench')).resolves.toBe(false);
  });
  expect(hook.result.current.drafts.s1.weight).toBe('72');
  hook.unmount();
});

it('undo retains effort and partials while removing weight and reps overrides', async () => {
  const hook = renderHook(() =>
    useWorkoutSessionController('log', [{ ...set, logExerciseId: 'bench' }], options)
  );
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() =>
    hook.result.current.edit('s1', { weight: '72', reps: '9', rir: '2', rpe: '8', partials: '1' })
  );
  await act(() => hook.result.current.revert('bench'));
  expect(hook.result.current.drafts.s1).toEqual({ rir: '2', rpe: '8', partials: '1' });
  await waitFor(async () =>
    expect(JSON.parse((await AsyncStorage.getItem('workout_drafts_log'))!).s1).toEqual({
      rir: '2',
      rpe: '8',
      partials: '1',
    })
  );
  hook.unmount();
});

it('discarding deletes the log and everything that would outlive it, without reloading it', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => hook.result.current.edit('s1', { weight: '70', reps: '8' }));
  await waitFor(async () => expect(await AsyncStorage.getItem('workout_drafts_log')).toBeTruthy());

  await act(() => hook.result.current.discard());

  expect(WorkoutService.deleteWorkoutLog).toHaveBeenCalledWith('log');
  // A pending "rest over" reminder and the resume-workout pointer would otherwise point at a
  // deleted log.
  expect(clearRestTimerEndAt).toHaveBeenCalled();
  expect(NotificationService.cancelRestTimerNotification).toHaveBeenCalled();
  expect(clearActiveWorkoutLogId).toHaveBeenCalled();
  expect(await AsyncStorage.getItem('workout_drafts_log')).toBeNull();
  expect(hook.result.current.drafts).toEqual({});
  expect(options.refresh).not.toHaveBeenCalled();
});

it('a failed discard keeps the session and its drafts', async () => {
  (WorkoutService.deleteWorkoutLog as jest.Mock).mockRejectedValueOnce(new Error('disk'));
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => hook.result.current.edit('s1', { weight: '70', reps: '8' }));

  await act(async () => {
    await expect(hook.result.current.discard()).resolves.toBe(false);
  });

  expect(clearActiveWorkoutLogId).not.toHaveBeenCalled();
  expect(hook.result.current.drafts.s1).toEqual({ weight: '70', reps: '8' });
  expect(hook.result.current.error?.message).toBe('disk');
});

it('only runs its clock while a rest is counting down', async () => {
  (getRestTimerEndAt as jest.Mock).mockResolvedValueOnce(null);
  const interval = jest.spyOn(global, 'setInterval');
  // `waitFor` polls with its own interval; the controller's clock is the one-second one.
  const clocks = () => interval.mock.calls.filter(([, delay]) => delay === 1000).length;
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  expect(clocks()).toBe(0);

  await act(() => hook.result.current.startRest(30));
  expect(clocks()).toBe(1);
  expect(hook.result.current.restSeconds).toBe(30);
  interval.mockRestore();
});

it('coalesces back-to-back edits into one write that keeps every one of them', async () => {
  const setItem = jest.spyOn(AsyncStorage, 'setItem');
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  setItem.mockClear();

  // Two edits in one batch: the second must build on the first, not on a stale render.
  act(() => {
    hook.result.current.edit('s1', { weight: '62', reps: '10' });
    hook.result.current.edit('s2', { weight: '40', reps: '12' });
  });

  expect(Object.keys(hook.result.current.drafts)).toEqual(['s1', 's2']);
  // Typing is debounced: nothing is written per keystroke...
  expect(setItem).not.toHaveBeenCalled();
  // ...and the single write that lands carries both edits.
  await waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
  expect(JSON.parse((await AsyncStorage.getItem('workout_drafts_log')) as string)).toMatchObject({
    s1: { weight: '62' },
    s2: { weight: '40' },
  });
  setItem.mockRestore();
  hook.unmount();
});

it('writes a pending edit straight away when the screen is left', async () => {
  const setItem = jest.spyOn(AsyncStorage, 'setItem');
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  setItem.mockClear();

  act(() => {
    hook.result.current.edit('s1', { weight: '70', reps: '5' });
  });
  hook.unmount();

  await waitFor(() => expect(setItem).toHaveBeenCalledTimes(1));
  expect(setItem.mock.calls[0][0]).toBe('workout_drafts_log');
  expect(JSON.parse(setItem.mock.calls[0][1])).toMatchObject({ s1: { weight: '70', reps: '5' } });
  setItem.mockRestore();
});

it('reports whether an action happened, and refuses to overlap two of them', async () => {
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));

  let results: boolean[] = [];
  await act(async () => {
    results = await Promise.all([hook.result.current.skip('s1'), hook.result.current.skip('s1')]);
  });

  expect(results).toEqual([true, false]);
  expect(WorkoutSessionService.saveSet).toHaveBeenCalledTimes(1);
  hook.unmount();
});

it('can complete a set without starting a rest, as when undoing a reopen', async () => {
  (getRestTimerEndAt as jest.Mock).mockResolvedValueOnce(null);
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));

  await act(() =>
    hook.result.current.complete('s1', { weight: 60, reps: 10 }, { autoRest: false })
  );

  expect(WorkoutSessionService.saveSet).toHaveBeenCalledWith('log', 's1', 'performed', {
    weight: 60,
    reps: 10,
  });
  expect(NotificationService.scheduleRestTimerNotification).not.toHaveBeenCalled();
  expect(hook.result.current.restSeconds).toBe(0);
  hook.unmount();
});

it('keeps the countdown when the reminder cannot be scheduled', async () => {
  (getRestTimerEndAt as jest.Mock).mockResolvedValueOnce(null);
  jest
    .mocked(NotificationService.scheduleRestTimerNotification)
    .mockRejectedValueOnce(new Error('no permission'));
  const hook = renderHook(() => useWorkoutSessionController('log', [set], options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));

  await act(() => hook.result.current.startRest(30));

  expect(hook.result.current.restSeconds).toBe(30);
  expect(hook.result.current.error).toBeNull();
  hook.unmount();
});

it('clearValueDrafts drops a swapped exercise’s typed numbers without touching other blocks or calling undo', async () => {
  const rows = [
    { ...set, logExerciseId: 'bench', id: 'a' },
    { ...set, logExerciseId: 'squat', id: 'b' },
  ];
  const hook = renderHook(() => useWorkoutSessionController('log', rows, options));
  await waitFor(() => expect(hook.result.current.busy).toBe(false));
  act(() => {
    hook.result.current.edit('a', { weight: '80', reps: '9' });
    hook.result.current.edit('b', { weight: '80', reps: '9' });
  });
  act(() => hook.result.current.clearValueDrafts('bench'));
  expect(hook.result.current.drafts.a).toBeUndefined();
  expect(hook.result.current.drafts.b.weight).toBe('80');
  expect(WorkoutProgressionService.revertStartAdjustment).not.toHaveBeenCalled();
  hook.unmount();
});
