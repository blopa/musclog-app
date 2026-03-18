import { Q } from '@nozbe/watermelondb';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { NavItemKey } from '../constants/settings';
import { database } from '../database';
import type NutritionCheckin from '../database/models/NutritionCheckin';
import { SettingsService } from '../database/services/SettingsService';
import { useMenstrualCycle } from './useMenstrualCycle';
import { useSettings } from './useSettings';

type SlotNumber = 1 | 2 | 3;

export type UseNavigationItemsResult = {
  rawSlots: Record<SlotNumber, NavItemKey>;
  isAiFeaturesEnabled: boolean;
  isCycleActive: boolean;
  hasPendingCheckin: boolean;
  setNavSlot: (slot: SlotNumber, item: NavItemKey) => Promise<void>;
};

// Fallback items that are always available (never conditionally hidden)
const ALWAYS_AVAILABLE_ITEMS: NavItemKey[] = [
  'workouts',
  'food',
  'profile',
  'settings',
  'progress',
];

/**
 * Checks if a navigation item is currently available/visible.
 */
function isItemAvailable(
  item: NavItemKey,
  isAiFeaturesEnabled: boolean,
  isCycleActive: boolean,
  hasPendingCheckin: boolean
): boolean {
  if (item === 'coach' && !isAiFeaturesEnabled) {
    return false;
  }

  if (item === 'cycle' && !isCycleActive) {
    return false;
  }

  if (item === 'checkin' && !hasPendingCheckin) {
    return false;
  }

  return true;
}

/**
 * Ensures all slots have valid, renderable items by replacing unavailable items
 * with fallback items. This guarantees the navigation bar always shows 4 items
 * (Home + Camera + 3 slots).
 */
function ensureValidSlots(
  slots: Record<SlotNumber, NavItemKey>,
  isAiFeaturesEnabled: boolean,
  isCycleActive: boolean,
  hasPendingCheckin: boolean
): Record<SlotNumber, NavItemKey> {
  const result: Record<SlotNumber, NavItemKey> = { ...slots };
  const usedItems = new Set<NavItemKey>();

  // First pass: mark all valid items as used
  ([1, 2, 3] as SlotNumber[]).forEach((slot) => {
    const item = slots[slot];
    if (isItemAvailable(item, isAiFeaturesEnabled, isCycleActive, hasPendingCheckin)) {
      usedItems.add(item);
    }
  });

  // Second pass: replace unavailable items with fallback items
  ([1, 2, 3] as SlotNumber[]).forEach((slot) => {
    const item = slots[slot];
    if (!isItemAvailable(item, isAiFeaturesEnabled, isCycleActive, hasPendingCheckin)) {
      // Find the first available fallback item that's not already used
      const fallback = ALWAYS_AVAILABLE_ITEMS.find((fallbackItem) => !usedItems.has(fallbackItem));
      if (fallback) {
        result[slot] = fallback;
        usedItems.add(fallback);
      } else {
        // If all fallbacks are used, use the first one anyway (shouldn't happen with 3 slots and 5 fallbacks)
        result[slot] = ALWAYS_AVAILABLE_ITEMS[0];
      }
    }
  });

  return result;
}

export function useNavigationItems(): UseNavigationItemsResult {
  const { isAiFeaturesEnabled, navSlot1, navSlot2, navSlot3 } = useSettings();
  const { isActive: isCycleActive } = useMenstrualCycle();
  const [hasPendingCheckin, setHasPendingCheckin] = useState(false);

  useEffect(() => {
    const subscription = database
      .get<NutritionCheckin>('nutrition_checkins')
      .query(
        Q.where('completed', Q.notEq(true)),
        Q.where('checkin_date', Q.lte(Date.now())),
        Q.where('deleted_at', Q.eq(null))
      )
      .observe()
      .subscribe((checkins) => {
        setHasPendingCheckin(checkins.length > 0);
      });

    return () => subscription.unsubscribe();
  }, []);

  const rawSlots = useMemo(
    () => ({ 1: navSlot1, 2: navSlot2, 3: navSlot3 }),
    [navSlot1, navSlot2, navSlot3]
  );

  // Ensure all slots have valid, renderable items
  const validSlots = useMemo(
    () => ensureValidSlots(rawSlots, isAiFeaturesEnabled, isCycleActive, hasPendingCheckin),
    [rawSlots, isAiFeaturesEnabled, isCycleActive, hasPendingCheckin]
  );

  // Keep a ref synced to the latest slot values so that async swap operations
  // always read the current state even across re-renders mid-await.
  const slotsRef = useRef<Record<SlotNumber, NavItemKey>>(validSlots);

  useEffect(() => {
    slotsRef.current = validSlots;
  }, [validSlots]);

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
    rawSlots: validSlots,
    isAiFeaturesEnabled,
    isCycleActive,
    hasPendingCheckin,
    setNavSlot,
  };
}
