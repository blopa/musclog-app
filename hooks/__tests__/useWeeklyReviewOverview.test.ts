import { act, renderHook, waitFor } from '@testing-library/react';
import { useWeeklyReviewOverview } from '@/hooks/useWeeklyReviewOverview';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';

let mockFocus: () => void | (() => void);
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocus = callback;
    require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/database/services/WeeklyReviewService', () => ({
  WeeklyReviewService: { overview: jest.fn() },
}));
jest.mock('@/database/services/NutritionCheckinService', () => ({
  NutritionCheckinService: { getPastHistory: jest.fn(async () => []) },
}));
const overview = jest.mocked(WeeklyReviewService.overview);
beforeEach(() => jest.clearAllMocks());
it('refreshes evidence after returning from logging without a review status change', async () => {
  overview
    .mockResolvedValueOnce({ nutrition: { foodDays: 6, canApply: false } } as any)
    .mockResolvedValueOnce({ nutrition: { foodDays: 7, canApply: true } } as any);
  const hook = renderHook(() => useWeeklyReviewOverview());
  await waitFor(() => expect(hook.result.current.data?.nutrition?.foodDays).toBe(6));
  act(() => {
    mockFocus();
  });
  await waitFor(() => expect(hook.result.current.data?.nutrition?.canApply).toBe(true));
  expect(overview).toHaveBeenCalledTimes(2);
  hook.unmount();
});
it('an earlier overview cannot overwrite the newly selected review', async () => {
  let resolveOld!: (value: any) => void;
  overview
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce({ nutrition: { foodDays: 7 } } as any);
  const hook = renderHook(({ id }) => useWeeklyReviewOverview(id), { initialProps: { id: 'old' } });
  hook.rerender({ id: 'new' });
  await waitFor(() => expect(hook.result.current.data?.nutrition?.foodDays).toBe(7));
  await act(async () => resolveOld({ nutrition: { foodDays: 1 } }));
  expect(hook.result.current.data?.nutrition?.foodDays).toBe(7);
  hook.unmount();
});
