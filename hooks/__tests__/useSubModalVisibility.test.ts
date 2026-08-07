/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useSubModalVisibility } from '@/hooks/useSubModalVisibility';

const render = (parentVisible = true) =>
  renderHook(({ visible }: { visible: boolean }) => useSubModalVisibility(visible), {
    initialProps: { visible: parentVisible },
  });

describe('useSubModalVisibility', () => {
  it('starts closed and opens through the returned setState', () => {
    const { result } = render();

    expect(result.current[0]).toBe(false);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);
  });

  // The whole point of the hook: a native Modal left open after its parent closes keeps
  // swallowing touches on every later render ("ghost modal").
  it('forces itself closed when the parent modal closes', () => {
    const { rerender, result } = render(true);

    act(() => result.current[1](true));
    expect(result.current[0]).toBe(true);

    act(() => rerender({ visible: false }));
    expect(result.current[0]).toBe(false);
  });

  it('leaves an open sub-modal alone while the parent stays visible', () => {
    const { rerender, result } = render(true);

    act(() => result.current[1](true));
    act(() => rerender({ visible: true }));

    expect(result.current[0]).toBe(true);
  });

  it('does not re-open the sub-modal when the parent becomes visible again', () => {
    const { rerender, result } = render(true);

    act(() => result.current[1](true));
    act(() => rerender({ visible: false }));
    act(() => rerender({ visible: true }));

    expect(result.current[0]).toBe(false);
  });

  it('supports the functional setState form, so call-sites need no changes', () => {
    const { result } = render();

    act(() => result.current[1]((prev) => !prev));
    expect(result.current[0]).toBe(true);
  });
});
