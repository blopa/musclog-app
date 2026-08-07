/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import { NAV_ITEM_KEYS, type NavItemKey } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { useMenstrualCycle } from '@/hooks/useMenstrualCycle';
import { isNavItemAvailable, useNavigationItems } from '@/hooks/useNavigationItems';
import { useSettings } from '@/hooks/useSettings';

jest.mock('../../hooks/useSettings');
jest.mock('../../hooks/useMenstrualCycle');
jest.mock('../../database/services/SettingsService', () => ({
  SettingsService: {
    setNavSlot: jest.fn(),
    swapNavSlots: jest.fn(),
  },
}));

const mockUseSettings = jest.mocked(useSettings);
const mockUseMenstrualCycle = jest.mocked(useMenstrualCycle);
const mockSettingsService = jest.mocked(SettingsService);

function configure({
  slots = ['workouts', 'food', 'profile'] as const,
  isCycleActive = false,
}: {
  slots?: readonly [NavItemKey, NavItemKey, NavItemKey];
  isCycleActive?: boolean;
} = {}) {
  mockUseSettings.mockReturnValue({
    isAiConfigured: true,
    navSlot1: slots[0],
    navSlot2: slots[1],
    navSlot3: slots[2],
  } as ReturnType<typeof useSettings>);
  mockUseMenstrualCycle.mockReturnValue({ isActive: isCycleActive } as ReturnType<
    typeof useMenstrualCycle
  >);
}

describe('useNavigationItems', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    configure();
  });

  it('returns configured slots unchanged when all destinations are available', () => {
    const { result } = renderHook(() => useNavigationItems());

    expect(result.current.rawSlots).toEqual({ 1: 'workouts', 2: 'food', 3: 'profile' });
    expect(result.current.isAiConfigured).toBe(true);
    expect(result.current.isCycleActive).toBe(false);
  });

  it('keeps the cycle destination when cycle tracking is active', () => {
    configure({ slots: ['cycle', 'food', 'profile'], isCycleActive: true });

    const { result } = renderHook(() => useNavigationItems());

    expect(result.current.rawSlots).toEqual({ 1: 'cycle', 2: 'food', 3: 'profile' });
  });

  it('replaces an unavailable cycle slot with the first unused fallback', () => {
    configure({ slots: ['cycle', 'workouts', 'food'] });

    const { result } = renderHook(() => useNavigationItems());

    expect(result.current.rawSlots).toEqual({ 1: 'profile', 2: 'workouts', 3: 'food' });
  });

  it('persists a destination that is not already assigned', async () => {
    const { result } = renderHook(() => useNavigationItems());

    await act(() => result.current.setNavSlot(2, 'settings'));

    expect(mockSettingsService.setNavSlot).toHaveBeenCalledWith(2, 'settings');
    expect(mockSettingsService.swapNavSlots).not.toHaveBeenCalled();
  });

  it('atomically swaps when the selected destination is assigned to another slot', async () => {
    const { result } = renderHook(() => useNavigationItems());

    await act(() => result.current.setNavSlot(3, 'workouts'));

    expect(mockSettingsService.swapNavSlots).toHaveBeenCalledWith(3, 'workouts', 1, 'profile');
    expect(mockSettingsService.setNavSlot).not.toHaveBeenCalled();
  });

  it('uses the latest slots after a rerender when deciding how to swap', async () => {
    const { result, rerender } = renderHook(() => useNavigationItems());
    configure({ slots: ['settings', 'food', 'workouts'] });
    rerender();

    await act(() => result.current.setNavSlot(1, 'workouts'));

    expect(mockSettingsService.swapNavSlots).toHaveBeenCalledWith(1, 'workouts', 3, 'settings');
  });
});

describe('isNavItemAvailable', () => {
  it('only gates the cycle destination when cycle tracking is inactive', () => {
    expect(NAV_ITEM_KEYS.filter((item) => !isNavItemAvailable(item, false))).toEqual(['cycle']);
  });

  it('allows every destination when cycle tracking is active', () => {
    expect(NAV_ITEM_KEYS.every((item) => isNavItemAvailable(item, true))).toBe(true);
  });
});
