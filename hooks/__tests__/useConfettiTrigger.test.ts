/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { type ConfettiActivity } from '@/context/ConfettiInteractionsContext';
import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';

const mockCompleteActivity = jest.fn();

jest.mock('@/context/ConfettiInteractionsContext', () => ({
  useConfettiInteractions: () => ({ completeActivity: mockCompleteActivity }),
}));

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

describe('useConfettiTrigger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockCompleteActivity.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the overlay mounted long enough for the gentler native fall', async () => {
    const { result } = renderHook(() => useConfettiTrigger());

    await act(async () => {
      result.current.triggerConfetti('first-workout' as ConfettiActivity);
      await Promise.resolve();
    });

    expect(result.current.showConfetti).toBe(true);

    act(() => jest.advanceTimersByTime(7999));
    expect(result.current.showConfetti).toBe(true);

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.showConfetti).toBe(false);
  });
});
