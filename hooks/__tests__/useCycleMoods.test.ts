import { act, renderHook, waitFor } from '@testing-library/react';

import { useCycleMoods } from '@/hooks/useCycleMoods';

let mockObserver: { next: (rows: any[]) => void; error: () => void };
const mockUnsubscribe = jest.fn();
jest.mock('@/database/database-instance', () => ({
  database: {
    get: () => ({
      query: () => ({
        observeWithColumns: () => ({
          subscribe: (observer: any) => {
            mockObserver = observer;
            return { unsubscribe: mockUnsubscribe };
          },
        }),
      }),
    }),
  },
}));
jest.mock('@/constants/platform', () => ({ isStaticExport: false }));
jest.mock('@/lang/lang', () => ({ DEFAULT_LANG: 'en-US' }));

beforeEach(() => jest.clearAllMocks());
it('updates and clears exported mood points on live database changes and keeps their original calendar day', async () => {
  const { result, unmount } = renderHook(() => useCycleMoods());
  const instant = Date.UTC(2024, 0, 1, 10);
  act(() =>
    mockObserver.next([
      { date: instant, timezone: '+14:00', getDecrypted: async () => ({ value: 0 }) },
    ])
  );
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.moods).toEqual([{ date: new Date(2024, 0, 2).getTime(), value: 0 }]);
  act(() => mockObserver.next([]));
  await waitFor(() => expect(result.current.moods).toEqual([]));
  unmount();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});
it('drops a slow decryption result when a newer mood emission has already completed', async () => {
  let finishOld!: (value: { value: number }) => void;
  const pending = new Promise<{ value: number }>((resolve) => {
    finishOld = resolve;
  });
  const date = new Date(2024, 0, 2).getTime();
  const { result } = renderHook(() => useCycleMoods());
  act(() => {
    mockObserver.next([{ date, timezone: null, getDecrypted: () => pending }]);
    mockObserver.next([{ date, timezone: null, getDecrypted: async () => ({ value: 4 }) }]);
  });
  await waitFor(() => expect(result.current.moods[0]?.value).toBe(4));
  await act(async () => finishOld({ value: 1 }));
  expect(result.current.moods[0]?.value).toBe(4);
});
it('reports read failures so the export action can stay disabled', async () => {
  const { result } = renderHook(() => useCycleMoods());
  act(() =>
    mockObserver.next([
      {
        getDecrypted: async () => {
          throw new Error('read failed');
        },
      },
    ])
  );
  await waitFor(() => expect(result.current.error).toBe(true));
  expect(result.current.isLoading).toBe(false);
});

it('leaves out a stored mood that is not on the 0–4 scale instead of breaking labels and exports', async () => {
  const { result } = renderHook(() => useCycleMoods());
  const row = (day: number, value: number) => ({
    date: Date.UTC(2024, 0, day, 10),
    timezone: '+00:00',
    getDecrypted: async () => ({ value }),
  });
  act(() => mockObserver.next([row(2, 3), row(3, 8.53), row(4, 5)]));
  await waitFor(() => expect(result.current.isLoading).toBe(false));
  expect(result.current.moods.map((m) => m.value)).toEqual([3]);
});
