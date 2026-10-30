/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';

import { ActivityRepository } from '@/database/repositories/ActivityRepository';
import { useComebackOffer } from '@/hooks/useComebackOffer';
import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(callback, [callback]);
  },
}));
jest.mock('@/database/repositories/ActivityRepository', () => ({
  ActivityRepository: { lastActivity: jest.fn() },
}));

const mockState: { current: ComebackState } = { current: DEFAULT_COMEBACK_STATE };
const mockToday = new Date(2026, 8, 20).getTime();
jest.mock('@/hooks/useComebackState', () => ({
  useComebackState: () => ({ state: mockState.current, today: mockToday }),
}));

const daysAgo = (n: number) => new Date(2026, 8, 20 - n, 12).getTime();

describe('useComebackOffer', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
    jest.setSystemTime(new Date(2026, 8, 20, 12));
    mockState.current = DEFAULT_COMEBACK_STATE;
  });

  afterEach(() => jest.useRealTimers());

  it('offers nothing until the first read finishes', () => {
    (ActivityRepository.lastActivity as jest.Mock).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useComebackOffer());

    expect(result.current.lapse).toBeNull();
    expect(result.current.shouldOffer).toBe(false);
  });

  it('offers to ease back in after a long gap in both areas', async () => {
    (ActivityRepository.lastActivity as jest.Mock).mockResolvedValue({
      lastWorkoutAt: daysAgo(94),
      lastFoodAt: daysAgo(120),
      lastWeighInAt: null,
    });
    const { result } = renderHook(() => useComebackOffer());

    await waitFor(() => expect(result.current.shouldOffer).toBe(true));
    expect(result.current.lapse?.suggestedTrack).toBe('both');
    expect(result.current.daysSinceActivity).toBe(94);
  });

  it('does not offer to someone training every week', async () => {
    (ActivityRepository.lastActivity as jest.Mock).mockResolvedValue({
      lastWorkoutAt: daysAgo(2),
      lastFoodAt: daysAgo(1),
      lastWeighInAt: null,
    });
    const { result } = renderHook(() => useComebackOffer());

    await waitFor(() => expect(result.current.lapse).not.toBeNull());
    expect(result.current.shouldOffer).toBe(false);
  });

  it('stays quiet while a comeback is already running', async () => {
    mockState.current = { ...DEFAULT_COMEBACK_STATE, status: 'active', startedAt: daysAgo(3) };
    (ActivityRepository.lastActivity as jest.Mock).mockResolvedValue({
      lastWorkoutAt: daysAgo(94),
      lastFoodAt: null,
      lastWeighInAt: null,
    });
    const { result } = renderHook(() => useComebackOffer());

    await waitFor(() => expect(result.current.lapse).not.toBeNull());
    expect(result.current.shouldOffer).toBe(false);
  });
});
