import { useCallback, useEffect, useRef } from 'react';

import type { NavItemKey } from '../constants/settings';
import { SettingsService } from '../database/services/SettingsService';
import { useMenstrualCycle } from './useMenstrualCycle';
import { useSettings } from './useSettings';

type SlotNumber = 1 | 2 | 3;

export type UseNavigationItemsResult = {
  rawSlots: Record<SlotNumber, NavItemKey>;
  isAiFeaturesEnabled: boolean;
  isCycleActive: boolean;
  setNavSlot: (slot: SlotNumber, item: NavItemKey) => Promise<void>;
};

export function useNavigationItems(): UseNavigationItemsResult {
  const { isAiFeaturesEnabled, navSlot1, navSlot2, navSlot3 } = useSettings();
  const { isActive: isCycleActive } = useMenstrualCycle();

  // Keep a ref synced to the latest slot values so that async swap operations
  // always read the current state even across re-renders mid-await.
  const slotsRef = useRef<Record<SlotNumber, NavItemKey>>({
    1: navSlot1,
    2: navSlot2,
    3: navSlot3,
  });

  useEffect(() => {
    slotsRef.current = { 1: navSlot1, 2: navSlot2, 3: navSlot3 };
  }, [navSlot1, navSlot2, navSlot3]);

  const setNavSlot = useCallback(async (slot: SlotNumber, item: NavItemKey) => {
    // Snapshot BEFORE any awaits to avoid stale closure issues
    const current = { ...slotsRef.current };
    const otherSlots = ([1, 2, 3] as SlotNumber[]).filter((s) => s !== slot);
    const swapSlot = otherSlots.find((s) => current[s] === item);

    if (swapSlot) {
      // Atomic swap: both writes happen in a single DB transaction so the nav
      // bar never sees the intermediate state where both slots show the same item.
      await SettingsService.swapNavSlots(slot, item, swapSlot, current[slot]);
    } else {
      await SettingsService.setNavSlot(slot, item);
    }
  }, []);

  return {
    rawSlots: { 1: navSlot1, 2: navSlot2, 3: navSlot3 },
    isAiFeaturesEnabled,
    isCycleActive,
    setNavSlot,
  };
}
