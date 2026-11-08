import { act, renderHook } from '@testing-library/react';

import { useStoryPager } from '../useStoryPager';

describe('useStoryPager', () => {
  it('starts on the first page', () => {
    const { result } = renderHook(() => useStoryPager(3));

    expect(result.current.current).toBe(0);
    expect(result.current.isFirst).toBe(true);
    expect(result.current.isLast).toBe(false);
  });

  it('advances with next and stops on the last page', () => {
    const { result } = renderHook(() => useStoryPager(3));

    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.next());

    expect(result.current.current).toBe(2);
    expect(result.current.isLast).toBe(true);
    expect(result.current.isFirst).toBe(false);
  });

  it('goes back with back and stops on the first page', () => {
    const { result } = renderHook(() => useStoryPager(3));

    act(() => result.current.next());
    act(() => result.current.next());
    act(() => result.current.back());
    expect(result.current.current).toBe(1);

    act(() => result.current.back());
    act(() => result.current.back());
    expect(result.current.current).toBe(0);
    expect(result.current.isFirst).toBe(true);
  });

  it('with no pages sits at 0 and is both first and last', () => {
    const { result } = renderHook(() => useStoryPager(0));

    expect(result.current.current).toBe(0);
    expect(result.current.isLast).toBe(true);
    expect(result.current.isFirst).toBe(true);
  });

  it('clamps the position when the story shrinks', () => {
    const { result, rerender } = renderHook(({ count }) => useStoryPager(count), {
      initialProps: { count: 5 },
    });

    for (let step = 0; step < 4; step += 1) {
      act(() => result.current.next());
    }
    expect(result.current.current).toBe(4);

    rerender({ count: 2 });

    expect(result.current.current).toBe(1);
    expect(result.current.isLast).toBe(true);
  });
});
