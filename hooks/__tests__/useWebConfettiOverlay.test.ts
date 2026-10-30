import { renderHook } from '@testing-library/react';

import ConfettiOverlay from '@/components/ConfettiOverlay.web';

const mockFire = jest.fn();
const mockReset = jest.fn();

jest.mock('canvas-confetti', () => ({
  __esModule: true,
  default: { create: jest.fn(() => Object.assign(mockFire, { reset: mockReset })) },
}));

describe('web confetti motion preference', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates no canvas or particles with reduced motion, as used by screenshots', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    const { unmount } = renderHook(() => ConfettiOverlay());

    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
    expect(document.querySelector('canvas')).toBeNull();
    expect(mockFire).not.toHaveBeenCalled();
    unmount();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('still celebrates and cleans up when motion is allowed', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false });
    const { unmount } = renderHook(() => ConfettiOverlay());

    expect(document.querySelector('canvas')).not.toBeNull();
    expect(mockFire).toHaveBeenCalledWith(expect.objectContaining({ particleCount: 150 }));
    unmount();
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(document.querySelector('canvas')).toBeNull();
  });
});
