/**
 * @jest-environment jsdom
 */

import { renderHook } from '@testing-library/react';
import { act } from 'react';

import { useHasCamera } from '@/hooks/useHasCamera';

let mockDevices: unknown[] = [];
let mockListener: (() => void) | null = null;
const mockRemove = jest.fn();

jest.mock('react-native-vision-camera', () => ({
  Camera: {
    getAvailableCameraDevices: () => mockDevices,
    addCameraDevicesChangedListener: (callback: () => void) => {
      mockListener = callback;

      return { remove: mockRemove };
    },
  },
}));

describe('useHasCamera', () => {
  beforeEach(() => {
    mockDevices = [];
    mockListener = null;
    mockRemove.mockClear();
  });

  it('is false when the device lists no camera', () => {
    const { result } = renderHook(() => useHasCamera());

    expect(result.current).toBe(false);
  });

  it('is true when the device lists a camera', () => {
    mockDevices = [{ id: 'back' }];
    const { result } = renderHook(() => useHasCamera());

    expect(result.current).toBe(true);
  });

  it('follows a camera being attached and stops listening on unmount', () => {
    const { result, unmount } = renderHook(() => useHasCamera());

    expect(result.current).toBe(false);

    act(() => {
      mockDevices = [{ id: 'usb' }];
      mockListener?.();
    });

    expect(result.current).toBe(true);

    unmount();

    expect(mockRemove).toHaveBeenCalled();
  });
});
