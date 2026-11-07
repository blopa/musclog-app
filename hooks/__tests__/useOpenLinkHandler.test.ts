/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useIncomingOpenLink, useOpenLinkHandler } from '@/hooks/useOpenLinkHandler';
import { setPendingOpenLink } from '@/utils/openLink';

// The mocked focus effect runs its callback only while `mockFocused.current` is true, like the real
// one runs only for the focused screen.
const mockFocused = { current: true };
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(() => (mockFocused.current ? callback() : undefined), [callback]);
  },
}));

beforeEach(() => {
  mockFocused.current = true;
  setPendingOpenLink(null);
});

describe('useOpenLinkHandler', () => {
  it('drains a link that was pending when the screen gained focus', () => {
    setPendingOpenLink({ kind: 'workout', payload: 'plan' });
    const onPayload = jest.fn();
    renderHook(() => useOpenLinkHandler('workout', onPayload));

    expect(onPayload).toHaveBeenCalledWith('plan');
    expect(onPayload).toHaveBeenCalledTimes(1);
  });

  it('receives a link that arrives while the screen is focused', () => {
    const onPayload = jest.fn();
    renderHook(() => useOpenLinkHandler('food', onPayload));
    expect(onPayload).not.toHaveBeenCalled();

    act(() => setPendingOpenLink({ kind: 'food', payload: 'meal' }));

    expect(onPayload).toHaveBeenCalledWith('meal');
  });

  it('hands each link over once', () => {
    setPendingOpenLink({ kind: 'food', payload: 'meal' });
    const onPayload = jest.fn();
    const { rerender } = renderHook(() => useOpenLinkHandler('food', onPayload));
    rerender();

    expect(onPayload).toHaveBeenCalledTimes(1);
  });

  it('takes nothing on a screen that is not focused', () => {
    mockFocused.current = false;
    setPendingOpenLink({ kind: 'workout', payload: 'plan' });
    const onPayload = jest.fn();
    renderHook(() => useOpenLinkHandler('workout', onPayload));

    act(() => setPendingOpenLink({ kind: 'workout', payload: 'newer' }));

    expect(onPayload).not.toHaveBeenCalled();
  });

  it("leaves the other kind's link pending", () => {
    setPendingOpenLink({ kind: 'food', payload: 'meal' });
    const workout = jest.fn();
    const food = jest.fn();
    renderHook(() => useOpenLinkHandler('workout', workout));
    renderHook(() => useOpenLinkHandler('food', food));

    expect(workout).not.toHaveBeenCalled();
    expect(food).toHaveBeenCalledWith('meal');
  });

  it('stops listening on unmount', () => {
    const onPayload = jest.fn();
    const { unmount } = renderHook(() => useOpenLinkHandler('food', onPayload));
    unmount();

    act(() => setPendingOpenLink({ kind: 'food', payload: 'late' }));

    expect(onPayload).not.toHaveBeenCalled();
  });
});

describe('useIncomingOpenLink', () => {
  it('holds the payload, opens the screen and re-keys an identical link', () => {
    const onArrive = jest.fn();
    const { result } = renderHook(() => useIncomingOpenLink('workout', onArrive));
    expect(result.current.incoming).toBeNull();

    act(() => setPendingOpenLink({ kind: 'workout', payload: 'same' }));
    const first = result.current.incoming;
    expect(first).toMatchObject({ text: 'same' });
    expect(onArrive).toHaveBeenCalledTimes(1);

    act(() => setPendingOpenLink({ kind: 'workout', payload: 'same' }));
    expect(result.current.incoming?.key).not.toBe(first?.key);

    act(() => result.current.clearIncoming());
    expect(result.current.incoming).toBeNull();
  });
});
