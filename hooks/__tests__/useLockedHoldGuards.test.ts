/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useLockedHoldGuards } from '@/hooks/useLockedHoldGuards';

let mockPathname = '/app';
let appStateListener: ((state: string) => void) | null = null;
let backListener: (() => boolean) | null = null;

jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  AppState: {
    addEventListener: (_: string, listener: (state: string) => void) => {
      appStateListener = listener;
      return { remove: () => (appStateListener = null) };
    },
  },
  BackHandler: {
    addEventListener: (_: string, listener: () => boolean) => {
      backListener = listener;
      return { remove: () => (backListener = null) };
    },
  },
}));

describe('useLockedHoldGuards', () => {
  const cancel = jest.fn();
  const render = (locked: boolean) =>
    renderHook((props: { locked: boolean }) => useLockedHoldGuards(props.locked, cancel), {
      initialProps: { locked },
    });

  beforeEach(() => {
    mockPathname = '/app';
    cancel.mockClear();
  });

  it('listens for nothing until the hold is locked', () => {
    const hook = render(false);
    mockPathname = '/app/profile';
    hook.rerender({ locked: false });

    expect(appStateListener).toBeNull();
    expect(backListener).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('cancels in the background but not on iOS inactive', () => {
    render(true);
    act(() => appStateListener?.('inactive'));
    expect(cancel).not.toHaveBeenCalled();
    act(() => appStateListener?.('background'));
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels on back and consumes the press', () => {
    render(true);
    expect(backListener?.()).toBe(true);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels when the route changes', () => {
    const hook = render(true);
    mockPathname = '/app/profile';
    hook.rerender({ locked: true });
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
