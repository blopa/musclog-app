import { renderHook } from '@testing-library/react';

import { useKeepScreenAwake } from '../useKeepScreenAwake';

const mockActivate = jest.fn(() => Promise.resolve());
const mockDeactivate = jest.fn(() => Promise.resolve());

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: (tag: string) => mockActivate(tag),
  deactivateKeepAwake: (tag: string) => mockDeactivate(tag),
}));

describe('useKeepScreenAwake', () => {
  beforeEach(() => {
    mockActivate.mockClear();
    mockDeactivate.mockClear();
  });

  it('keeps the screen awake only while enabled and releases on unmount', () => {
    const { rerender, unmount } = renderHook(({ on }) => useKeepScreenAwake('t', on), {
      initialProps: { on: false },
    });

    expect(mockActivate).not.toHaveBeenCalled();

    rerender({ on: true });
    expect(mockActivate).toHaveBeenCalledWith('t');

    mockDeactivate.mockClear();
    unmount();
    expect(mockDeactivate).toHaveBeenCalledWith('t');
  });
});
