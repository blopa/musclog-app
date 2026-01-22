/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useSettings } from '../useSettings';

type FakeSetting = { id: string; value: string };
let subscribeNext: (val: FakeSetting[]) => void;
let unsubscribeFn: jest.Mock;

const createMockObservable = (initialEmit: FakeSetting[]) => ({
  subscribe: (handlers: { next: (v: FakeSetting[]) => void; error?: (e: unknown) => void }) => {
    subscribeNext = handlers.next;
    handlers.next(initialEmit);
    unsubscribeFn = jest.fn();
    return { unsubscribe: unsubscribeFn };
  },
});

const mockQuery = {
  observe: jest.fn(),
};

const mockCollection = {
  query: jest.fn(() => mockQuery),
};

jest.mock('../../database/database-instance', () => ({
  database: {
    get: jest.fn(() => mockCollection),
  },
}));

describe('useSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.observe.mockReturnValue(createMockObservable([]));
  });

  it('returns metric and isLoading false after first emit when no settings', async () => {
    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('metric');
    expect(result.current.weightUnit).toBe('kg');
    expect(result.current.heightUnit).toBe('cm');
  });

  it('returns imperial when settings emit value 1', async () => {
    mockQuery.observe.mockReturnValue(
      createMockObservable([{ id: '1', value: '1' } as FakeSetting])
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('imperial');
    expect(result.current.weightUnit).toBe('lbs');
    expect(result.current.heightUnit).toBe('in');
  });

  it('returns metric when settings emit value 0', async () => {
    mockQuery.observe.mockReturnValue(
      createMockObservable([{ id: '1', value: '0' } as FakeSetting])
    );

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.units).toBe('metric');
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(unsubscribeFn).toBeDefined();
    });

    unmount();
    expect(unsubscribeFn).toHaveBeenCalled();
  });

  it('handles error by defaulting to metric and isLoading false', async () => {
    let errorHandler: (e: unknown) => void;
    const mockObs = {
      subscribe: (handlers: { next: (v: FakeSetting[]) => void; error?: (e: unknown) => void }) => {
        subscribeNext = handlers.next;
        errorHandler = handlers.error!;
        // Emit error synchronously
        setTimeout(() => errorHandler(new Error('db error')), 0);
        unsubscribeFn = jest.fn();
        return { unsubscribe: unsubscribeFn };
      },
    };
    mockQuery.observe.mockReturnValue(mockObs);

    const { result } = renderHook(() => useSettings());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => {
      expect(result.current.units).toBe('metric');
      expect(result.current.isLoading).toBe(false);
    });
  });
});
