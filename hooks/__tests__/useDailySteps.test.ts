import { renderHook, waitFor } from '@testing-library/react';

import { database } from '@/database';
import { localDayHalfOpenRange } from '@/utils/calendarDate';

import { useDailySteps } from '../useDailySteps';

jest.mock('@/database', () => ({
  database: {
    collections: {
      get: jest.fn(),
    },
  },
}));

jest.mock('@/utils/calendarDate', () => ({
  localDayHalfOpenRange: jest.fn(),
}));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: (column: string, value: unknown) => ({ column, value }),
    gte: (value: unknown) => ({ operator: 'gte', value }),
    lt: (value: unknown) => ({ operator: 'lt', value }),
    eq: (value: unknown) => ({ operator: 'eq', value }),
  },
}));

type Emit = (records: unknown[]) => void;

function mockQuery() {
  const unsubscribe = jest.fn();
  const query = jest.fn();
  const observeWithColumns = jest.fn();
  const observe = jest.fn();
  let emit: Emit = () => {};

  observeWithColumns.mockReturnValue({
    subscribe: (callback: Emit) => {
      emit = callback;
      return { unsubscribe };
    },
  });

  query.mockReturnValue({ observeWithColumns, observe });
  (database.collections.get as jest.Mock).mockReturnValue({ query });

  (localDayHalfOpenRange as jest.Mock).mockReturnValue({ start: 0, nextStart: 86_400_000 });

  return {
    query,
    observe,
    observeWithColumns,
    unsubscribe,
    emit: (records: unknown[]) => emit(records),
  };
}

function record(value: number, updatedAt = 1, decrypt?: () => Promise<{ value: number }>) {
  return {
    updatedAt,
    getDecrypted: jest.fn(decrypt ?? (() => Promise.resolve({ value }))),
  };
}

describe('useDailySteps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null steps when no records are found', async () => {
    const mocks = mockQuery();
    const { result } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    mocks.emit([]);

    await waitFor(() => expect(result.current).toBeNull());
  });

  it('returns steps when a record is found', async () => {
    const mocks = mockQuery();
    const { result } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    mocks.emit([record(5000)]);

    await waitFor(() => expect(result.current).toBe(5000));
  });

  // The sync upserts one `daily_steps` row per day, so every update after the first is
  // an in-place change to a record already in the result set. `observe()` does not emit
  // for those, which would freeze the home screen on the day's first reading.
  it('observes the encrypted value column rather than set membership alone', () => {
    const mocks = mockQuery();
    renderHook(() => useDailySteps(new Date('2023-10-10')));

    expect(mocks.observeWithColumns).toHaveBeenCalledWith(['value']);
    expect(mocks.observe).not.toHaveBeenCalled();
  });

  it('re-publishes when an existing row is updated in place', async () => {
    const mocks = mockQuery();
    const { result } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    mocks.emit([record(5000)]);
    await waitFor(() => expect(result.current).toBe(5000));

    mocks.emit([record(8200)]);
    await waitFor(() => expect(result.current).toBe(8200));
  });

  it('excludes soft-deleted metrics from the query', () => {
    const mocks = mockQuery();
    renderHook(() => useDailySteps(new Date('2023-10-10')));

    expect(mocks.query).toHaveBeenCalledWith(
      expect.anything(),
      { column: 'deleted_at', value: { operator: 'eq', value: null } },
      expect.anything(),
      expect.anything()
    );
  });

  it('keeps the newest emission when an earlier decryption resolves late', async () => {
    const mocks = mockQuery();
    const { result } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    let releaseStale: (value: { value: number }) => void = () => {};
    const stale = record(1, 1, () => new Promise((resolve) => (releaseStale = resolve)));

    mocks.emit([stale]);
    mocks.emit([record(8200)]);

    await waitFor(() => expect(result.current).toBe(8200));

    releaseStale({ value: 1 });
    await Promise.resolve();

    expect(result.current).toBe(8200);
  });

  it('prefers the most recently written row when duplicates survive', async () => {
    const mocks = mockQuery();
    const { result } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    mocks.emit([record(3000, 10), record(9100, 99), record(4000, 50)]);

    await waitFor(() => expect(result.current).toBe(9100));
  });

  it('unsubscribes on unmount', () => {
    const mocks = mockQuery();
    const { unmount } = renderHook(() => useDailySteps(new Date('2023-10-10')));

    unmount();
    expect(mocks.unsubscribe).toHaveBeenCalled();
  });
});
