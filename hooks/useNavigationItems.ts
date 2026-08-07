import { useCallback, useEffect, useMemo, useRef } from 'react';

import { NAV_ITEM_KEYS, type NavItemKey } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';

import { useMenstrualCycle } from './useMenstrualCycle';
import { useSettings } from './useSettings';

type SlotNumber = 1 | 2 | 3;

export type UseNavigationItemsResult = {
  rawSlots: Record<SlotNumber, NavItemKey>;
  isAiConfigured: boolean;
  isCycleActive: boolean;
  hasPendingCheckin: boolean;
  setNavSlot: (slot: SlotNumber, item: NavItemKey) => Promise<void>;
};

// Fallback items that are always available (never conditionally hidden). Derived from the
// canonical list so a new destination becomes eligible automatically; `cycle` is the only item
// `isNavItemAvailable` can reject. Order is not load-bearing — the fallback search takes the
// first *unused* entry, and with 3 slots one of the leading entries is always free.
const ALWAYS_AVAILABLE_ITEMS: NavItemKey[] = NAV_ITEM_KEYS.filter((item) => item !== 'cycle');

/**
 * Whether a navigation destination can currently be shown. `cycle` is the only one that is ever
 * hidden; `coach` deliberately stays available with no AI provider configured, because tapping it
 * opens `AINotConfiguredModal` with an "Open AI settings" CTA (see the AI-gating rule in
 * AGENTS.md — nav destinations may advertise AI, actions inside menus may not).
 *
 * Exported so the bottom bar, the account menu and the slot picker all ask the same question;
 * three copies of this predicate previously answered it in three slightly different ways.
 */
export function isNavItemAvailable(item: NavItemKey, isCycleActive: boolean): boolean {
  return item !== 'cycle' || isCycleActive;
}

/**
 * Ensures all slots have valid, renderable items by replacing unavailable items
 * with fallback items. This guarantees the navigation bar always shows 4 items
 * (Home + Camera + 3 slots).
 */
function ensureValidSlots(
  slots: Record<SlotNumber, NavItemKey>,
  isCycleActive: boolean
): Record<SlotNumber, NavItemKey> {
  const result: Record<SlotNumber, NavItemKey> = { ...slots };
  const usedItems = new Set<NavItemKey>();

  // First pass: mark all valid items as used
  ([1, 2, 3] as SlotNumber[]).forEach((slot) => {
    const item = slots[slot];
    if (isNavItemAvailable(item, isCycleActive)) {
      usedItems.add(item);
    }
  });

  // Second pass: replace unavailable items with fallback items
  ([1, 2, 3] as SlotNumber[]).forEach((slot) => {
    const item = slots[slot];
    if (!isNavItemAvailable(item, isCycleActive)) {
      // Find the first available fallback item that's not already used
      const fallback = ALWAYS_AVAILABLE_ITEMS.find((fallbackItem) => !usedItems.has(fallbackItem));
      if (fallback) {
        result[slot] = fallback;
        usedItems.add(fallback);
      } else {
        // If all fallbacks are used, use the first one anyway (shouldn't happen with 3 slots and 6 fallbacks)
        result[slot] = ALWAYS_AVAILABLE_ITEMS[0];
      }
    }
  });

  return result;
}

export function useNavigationItems(): UseNavigationItemsResult {
  const { isAiConfigured, navSlot1, navSlot2, navSlot3 } = useSettings();
  const { isActive: isCycleActive } = useMenstrualCycle();

  const rawSlots = useMemo(
    () => ({ 1: navSlot1, 2: navSlot2, 3: navSlot3 }),
    [navSlot1, navSlot2, navSlot3]
  );

  // Ensure all slots have valid, renderable items
  const validSlots = useMemo(
    () => ensureValidSlots(rawSlots, isCycleActive),
    [rawSlots, isCycleActive]
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
    isAiConfigured,
    isCycleActive,
    hasPendingCheckin: false,
    setNavSlot,
  };
}
