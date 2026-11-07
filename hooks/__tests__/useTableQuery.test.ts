/**
 * @jest-environment jsdom
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { Subject } from 'rxjs';

import { database } from '@/database/database-instance';
import { useTableQuery } from '@/hooks/useTableQuery';

jest.mock('@/database/database-instance', () => ({
  database: { withChangesForTables: jest.fn() },
}));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

const { handleError } = jest.requireMock('@/utils/handleError');

function mockChanges() {
  const changes = new Subject<void>();
  const unsubscribe = jest.fn();
  jest.mocked(database.withChangesForTables).mockReturnValue({
    subscribe: (observer: () => void) => {
      const subscription = changes.subscribe(observer);
      return {
        unsubscribe: () => {
          unsubscribe();
          subscription.unsubscribe();
        },
      };
    },
  } as never);

  return { changes, unsubscribe };
}

describe('useTableQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads once on mount and says it is loading until then', async () => {
    mockChanges();
    const load = jest.fn().mockResolvedValue('read');
    const { result } = renderHook(() =>
      useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'test' })
    );

    expect(result.current).toEqual({ data: 'empty', isLoading: true });
    await waitFor(() => expect(result.current).toEqual({ data: 'read', isLoading: false }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reads again when a watched table changes', async () => {
    const { changes } = mockChanges();
    const load = jest.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');
    const { result } = renderHook(() =>
      useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'test' })
    );
    await waitFor(() => expect(result.current.data).toBe('first'));

    act(() => changes.next());

    await waitFor(() => expect(result.current.data).toBe('second'));
    expect(jest.mocked(database.withChangesForTables)).toHaveBeenCalledWith(['t']);
  });

  it('lets only the newest read publish', async () => {
    const { changes } = mockChanges();
    let resolveSlow: (value: string) => void = () => undefined;
    const load = jest
      .fn()
      .mockImplementationOnce(() => new Promise<string>((resolve) => (resolveSlow = resolve)))
      .mockResolvedValueOnce('newer');
    const { result } = renderHook(() =>
      useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'test' })
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));

    act(() => changes.next());
    await waitFor(() => expect(result.current.data).toBe('newer'));
    await act(async () => resolveSlow('older'));

    expect(result.current.data).toBe('newer');
  });

  it('shows the empty value and reports a failed read', async () => {
    mockChanges();
    const failure = new Error('boom');
    const load = jest.fn().mockRejectedValue(failure);
    const { result } = renderHook(() =>
      useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'the-scope' })
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data).toBe('empty');
    expect(handleError).toHaveBeenCalledWith(failure, 'the-scope', { showSnackbar: false });
  });

  it('reads nothing and watches nothing while off', async () => {
    mockChanges();
    const load = jest.fn().mockResolvedValue('read');
    const { result } = renderHook(() =>
      useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'test', enabled: false })
    );

    await act(async () => undefined);

    expect(result.current).toEqual({ data: 'empty', isLoading: false });
    expect(load).not.toHaveBeenCalled();
    expect(database.withChangesForTables).not.toHaveBeenCalled();
  });

  it('reads again for a new key and stops watching on unmount', async () => {
    const { unsubscribe } = mockChanges();
    const load = jest.fn().mockImplementation(async () => `read ${load.mock.calls.length}`);
    const { result, rerender, unmount } = renderHook(
      ({ id }) => useTableQuery({ tables: ['t'], load, empty: 'empty', scope: 'test', key: id }),
      { initialProps: { id: 'a' } }
    );
    await waitFor(() => expect(result.current.data).toBe('read 1'));

    rerender({ id: 'b' });
    await waitFor(() => expect(result.current.data).toBe('read 2'));

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});
