import { act, renderHook, waitFor } from '@testing-library/react';

import { WHATS_NEW_SETTING_IO, writeWhatsNewSetting } from '@/utils/whatsNew/settingIO';

import { useWhatsNewChoiceValues } from '../useWhatsNewChoiceValues';

jest.mock('@/utils/whatsNew/settingIO', () => ({
  WHATS_NEW_SETTING_IO: Object.fromEntries(
    Object.entries({
      workoutView: 'guided',
      workoutAutonomy: 'suggest',
      progressionMode: 'reps_first',
      autoStartRestTimer: true,
      restTimerHaptics: true,
      reviewWeekday: 1,
    }).map(([setting, value]) => [setting, { read: jest.fn(async () => value) }])
  ),
  writeWhatsNewSetting: jest.fn(async () => undefined),
}));
beforeEach(() => jest.clearAllMocks());
test('loads stored values without writing untouched settings and re-reads after nested settings close', async () => {
  const { result, rerender } = renderHook(({ active }) => useWhatsNewChoiceValues(active), {
    initialProps: { active: false },
  });
  expect(WHATS_NEW_SETTING_IO.workoutView.read).not.toHaveBeenCalled();
  rerender({ active: true });
  await waitFor(() => expect(result.current.values.workoutView).toBe('guided'));
  expect(writeWhatsNewSetting).not.toHaveBeenCalled();
  rerender({ active: false });
  jest.mocked(WHATS_NEW_SETTING_IO.workoutView.read).mockResolvedValueOnce('inline');
  rerender({ active: true });
  await waitFor(() => expect(result.current.values.workoutView).toBe('inline'));
});
test('saves optimistically, prevents overlapping taps, and restores on failure', async () => {
  let reject!: (error: Error) => void;
  jest.mocked(writeWhatsNewSetting).mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      })
  );
  const { result } = renderHook(() => useWhatsNewChoiceValues(true));
  await waitFor(() => expect(result.current.values.workoutView).toBe('guided'));
  let write!: Promise<void>;
  act(() => {
    write = result.current.write('workoutView', 'inline');
  });
  expect(result.current.values.workoutView).toBe('inline');
  expect(result.current.saving.workoutView).toBe(true);
  await act(async () => result.current.write('workoutView', 'guided'));
  expect(writeWhatsNewSetting).toHaveBeenCalledTimes(1);
  await act(async () => {
    reject(new Error('disk'));
    await write;
  });
  expect(result.current.values.workoutView).toBe('guided');
  expect(result.current.errors.workoutView).toBe(true);
  expect(result.current.saving.workoutView).toBe(false);
  await act(async () => result.current.write('workoutView', 'inline'));
  expect(result.current.values.workoutView).toBe('inline');
  expect(result.current.errors.workoutView).toBe(false);
});
test('reports read failures, retries, and never seeds a made-up value', async () => {
  jest.mocked(WHATS_NEW_SETTING_IO.reviewWeekday.read).mockRejectedValueOnce(new Error('disk'));
  const { result } = renderHook(() => useWhatsNewChoiceValues(true));
  await waitFor(() => expect(result.current.errors.reviewWeekday).toBe(true));
  expect(result.current.values.reviewWeekday).toBeUndefined();
  await act(async () => result.current.write('reviewWeekday', 3));
  expect(writeWhatsNewSetting).not.toHaveBeenCalled();
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.values.reviewWeekday).toBe(1));
});
test('a stale refresh cannot overwrite a completed optimistic write', async () => {
  const { result } = renderHook(() => useWhatsNewChoiceValues(true));
  await waitFor(() => expect(result.current.values.workoutView).toBe('guided'));
  let resolve!: (value: 'guided') => void;
  jest.mocked(WHATS_NEW_SETTING_IO.workoutView.read).mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  act(() => result.current.refresh());
  await act(async () => result.current.write('workoutView', 'inline'));
  await act(async () => resolve('guided'));
  expect(result.current.values.workoutView).toBe('inline');
});
