/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { Subject } from 'rxjs';

import { database } from '@/database/database-instance';
import { NOTES_INITIAL_LIMIT, useNotes } from '@/hooks/useNotes';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    desc: 'desc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: { get: jest.fn() },
}));

const { Q } = jest.requireMock('@nozbe/watermelondb');

/** Rebuilds the query/observer chain and hands back the hooks into it. */
function mockNotesTable() {
  const subject = new Subject<unknown[]>();
  const unsubscribe = jest.fn();
  const observe = jest.fn();
  const observeWithColumns = jest.fn().mockReturnValue({
    subscribe: (observer: any) => {
      const sub = subject.subscribe(observer);
      return {
        unsubscribe: () => {
          unsubscribe();
          sub.unsubscribe();
        },
      };
    },
  });

  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn().mockReturnValue({ observe, observeWithColumns }),
  });

  return { subject, unsubscribe, observe, observeWithColumns };
}

const makeNotes = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `note-${index}` }));

describe('useNotes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('over-fetches by one row so hasMore needs no separate count query', () => {
    mockNotesTable();

    renderHook(() => useNotes());

    expect(database.get).toHaveBeenCalledWith('notes');
    expect(Q.take).toHaveBeenCalledWith(NOTES_INITIAL_LIMIT + 1);
    expect(Q.sortBy).toHaveBeenCalledWith('created_at', 'desc');
    expect(Q.where).toHaveBeenCalledWith('deleted_at', null);
  });

  // Regression guard: sortBy/take route the query to WatermelonDB's "reloading" observer, which
  // dedupes by record identity. An in-place edit reuses the same Model instance, so plain
  // observe() would never emit and the list would silently go stale.
  it('subscribes with observeWithColumns on the mutable columns, never plain observe', () => {
    const { observe, observeWithColumns } = mockNotesTable();

    renderHook(() => useNotes());

    expect(observeWithColumns).toHaveBeenCalledWith(['title', 'body', 'updated_at']);
    expect(observe).not.toHaveBeenCalled();
  });

  it('trims the probe row and reports hasMore when a full page plus one arrives', async () => {
    const { subject } = mockNotesTable();

    const { result } = renderHook(() => useNotes());

    act(() => subject.next(makeNotes(NOTES_INITIAL_LIMIT + 1)));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(NOTES_INITIAL_LIMIT);
    expect(result.current.hasMore).toBe(true);
  });

  it('reports no further pages when the emission is short of the probe', async () => {
    const { subject } = mockNotesTable();

    const { result } = renderHook(() => useNotes());

    act(() => subject.next(makeNotes(3)));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.notes).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
  });

  it('loadMore widens the window and tears down the previous subscription', async () => {
    const { subject, unsubscribe } = mockNotesTable();

    const { result } = renderHook(() => useNotes());

    act(() => subject.next(makeNotes(NOTES_INITIAL_LIMIT + 1)));
    await waitFor(() => expect(result.current.hasMore).toBe(true));

    (Q.take as jest.Mock).mockClear();
    act(() => result.current.loadMore());

    await waitFor(() => expect(Q.take).toHaveBeenCalledWith(NOTES_INITIAL_LIMIT + 10 + 1));
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes on unmount', () => {
    const { unsubscribe } = mockNotesTable();

    const { unmount } = renderHook(() => useNotes());
    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
