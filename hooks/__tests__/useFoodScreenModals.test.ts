/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useFoodScreenModals } from '@/hooks/useFoodScreenModals';

describe('useFoodScreenModals food search query', () => {
  it('exposes the query passed to open', () => {
    const { result } = renderHook(() => useFoodScreenModals());

    act(() => {
      result.current.foodSearch.open('all', 'oats');
    });

    expect(result.current.foodSearch.visible).toBe(true);
    expect(result.current.foodSearch.initialQuery).toBe('oats');
  });

  it('clears the query when opened without one', () => {
    const { result } = renderHook(() => useFoodScreenModals());

    act(() => {
      result.current.foodSearch.open('all', 'oats');
    });
    act(() => {
      result.current.foodSearch.close();
    });
    act(() => {
      result.current.foodSearch.open('meals');
    });

    expect(result.current.foodSearch.initialQuery).toBeUndefined();
    expect(result.current.foodSearch.initialTab).toBe('meals');
  });

  it('clears the query on close', () => {
    const { result } = renderHook(() => useFoodScreenModals());

    act(() => {
      result.current.foodSearch.open('all', 'rice');
    });
    act(() => {
      result.current.foodSearch.close();
    });

    expect(result.current.foodSearch.visible).toBe(false);
    expect(result.current.foodSearch.initialQuery).toBeUndefined();
  });

  it('ignores a non-string second argument such as an event object', () => {
    const { result } = renderHook(() => useFoodScreenModals());

    act(() => {
      result.current.foodSearch.open('all', { nativeEvent: {} } as unknown as string);
    });

    expect(result.current.foodSearch.initialQuery).toBeUndefined();
  });
});
