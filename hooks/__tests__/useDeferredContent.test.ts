/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { useDeferredContent } from '@/hooks/useDeferredContent';

// jsdom implements neither idle-callback global, and the hook calls them unguarded.
type IdleGlobals = {
  cancelIdleCallback?: unknown;
  requestIdleCallback?: unknown;
};

const idleGlobals = globalThis as IdleGlobals;
const originalRequest = idleGlobals.requestIdleCallback;
const originalCancel = idleGlobals.cancelIdleCallback;

let pendingCallbacks: Map<number, () => void>;
let requestIdleCallbackMock: jest.Mock;
let cancelIdleCallbackMock: jest.Mock;

describe('useDeferredContent', () => {
  beforeEach(() => {
    pendingCallbacks = new Map();
    let nextId = 1;

    requestIdleCallbackMock = jest.fn((callback: () => void) => {
      const id = nextId++;
      pendingCallbacks.set(id, callback);
      return id;
    });
    cancelIdleCallbackMock = jest.fn((id: number) => pendingCallbacks.delete(id));

    idleGlobals.requestIdleCallback = requestIdleCallbackMock;
    idleGlobals.cancelIdleCallback = cancelIdleCallbackMock;
  });

  afterAll(() => {
    idleGlobals.requestIdleCallback = originalRequest;
    idleGlobals.cancelIdleCallback = originalCancel;
  });

  const runIdle = () =>
    act(() => {
      for (const callback of [...pendingCallbacks.values()]) {
        callback();
      }
      pendingCallbacks.clear();
    });

  // The screen must be able to render its cheap skeleton first so mounting the heavy tree
  // doesn't block the navigation animation.
  it('is not ready on the first render', () => {
    const { result } = renderHook(() => useDeferredContent());

    expect(result.current).toBe(false);
    expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);
  });

  it('becomes ready once the idle callback runs', () => {
    const { result } = renderHook(() => useDeferredContent());

    runIdle();

    expect(result.current).toBe(true);
  });

  it('schedules the idle work only once across re-renders', () => {
    const { rerender } = renderHook(() => useDeferredContent());

    rerender();
    rerender();

    expect(requestIdleCallbackMock).toHaveBeenCalledTimes(1);
  });

  it('cancels the pending idle callback on unmount so it never sets state on a dead screen', () => {
    const { unmount } = renderHook(() => useDeferredContent());
    const scheduledId = requestIdleCallbackMock.mock.results[0].value;

    unmount();

    expect(cancelIdleCallbackMock).toHaveBeenCalledWith(scheduledId);
    expect(pendingCallbacks.size).toBe(0);
  });
});
