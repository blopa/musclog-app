/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { Subject } from 'rxjs';

import { database } from '@/database/database-instance';
import { useComebackState } from '@/hooks/useComebackState';
import { serializeComebackState, DEFAULT_COMEBACK_STATE } from '@/utils/comeback/comebackState';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: { get: jest.fn() },
}));

const mockToday = new Date(2026, 8, 20).getTime();
jest.mock('@/hooks/useLocalToday', () => ({ useLocalToday: () => mockToday }));

function mockSettingsTable() {
  const subject = new Subject<unknown[]>();
  const observeWithColumns = jest.fn().mockReturnValue({
    subscribe: (observer: any) => subject.subscribe(observer),
  });
  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn().mockReturnValue({ observeWithColumns }),
  });

  return { subject, observeWithColumns };
}

const row = (value: string, updatedAt = 1) => ({ value, updatedAt });

describe('useComebackState', () => {
  it('observes the row with observeWithColumns so in-place writes emit', () => {
    const { observeWithColumns } = mockSettingsTable();

    renderHook(() => useComebackState());

    expect(observeWithColumns).toHaveBeenCalledWith(['value']);
  });

  it('is loading, then none, when there is no row', () => {
    const { subject } = mockSettingsTable();
    const { result } = renderHook(() => useComebackState());

    expect(result.current.isLoading).toBe(true);
    act(() => subject.next([]));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.phase).toBe('none');
    expect(result.current.week).toBeNull();
    expect(result.current.ramp).toBeNull();
  });

  it('derives the week, phase and ramp from the stored dates', () => {
    const { subject } = mockSettingsTable();
    const { result } = renderHook(() => useComebackState());

    act(() =>
      subject.next([
        row(
          serializeComebackState({
            ...DEFAULT_COMEBACK_STATE,
            status: 'active',
            startedAt: new Date(2026, 8, 8).getTime(),
            answers: { breakLength: '1to3m' },
          })
        ),
      ])
    );

    // Day 13 since the start: week 2 of the ramp.
    expect(result.current.week).toBe(2);
    expect(result.current.phase).toBe('ramp');
    expect(result.current.ramp?.targetRir).toBe(3);
  });

  it('reads a restored old active state as graduated, never as week 14 of 4', () => {
    const { subject } = mockSettingsTable();
    const { result } = renderHook(() => useComebackState());

    act(() =>
      subject.next([
        row(
          serializeComebackState({
            ...DEFAULT_COMEBACK_STATE,
            status: 'active',
            startedAt: new Date(2026, 5, 1).getTime(),
          })
        ),
      ])
    );

    expect(result.current.phase).toBe('graduated');
    expect(result.current.ramp).toBeNull();
  });

  it('uses the most recently updated row when duplicates exist', () => {
    const { subject } = mockSettingsTable();
    const { result } = renderHook(() => useComebackState());

    act(() =>
      subject.next([
        row(serializeComebackState({ ...DEFAULT_COMEBACK_STATE, status: 'active' }), 1),
        row(serializeComebackState({ ...DEFAULT_COMEBACK_STATE, status: 'ended' }), 2),
      ])
    );

    expect(result.current.state.status).toBe('ended');
  });
});
