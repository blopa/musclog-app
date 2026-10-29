import type { MealType } from '@/database/models/NutritionLog';

import {
  MEAL_TYPES,
  type MealGroup,
  type NutrientTotals,
  type ResolvedLogEntry,
  sumNutrients,
} from './foodTypes';

/**
 * The food diary's bulk-selection model. Pure, so the rules that decide what a selection
 * contains run in the Jest `node` project.
 *
 * A selectable unit is one CARD: a loose log, or a whole grouped meal. A group is keyed by
 * its meal type as well as its id because the diary renders the same `group_id` in two
 * meal types as two cards (`mealGroupsByType`), and selecting one must not select the other.
 */
export type DiarySelectionKey = string;

export function diaryLogKey(logId: string): DiarySelectionKey {
  return `log:${logId}`;
}

export function diaryGroupKey(mealType: MealType, groupId: string): DiarySelectionKey {
  return `group:${mealType}:${groupId}`;
}

/**
 * Every card the diary draws under one meal type — its grouped meals and its loose logs —
 * as selection keys. "Act on the whole breakfast" is then an ordinary selection, resolved by
 * `resolveDiarySelection` like a long-press one.
 */
export function cardKeysOfMeal(
  mealType: MealType,
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>,
  mealGroupsByType: Record<MealType, MealGroup[]>
): Set<DiarySelectionKey> {
  return new Set([
    ...(mealGroupsByType[mealType] ?? []).map((group) => diaryGroupKey(mealType, group.groupId)),
    ...(ungroupedByType[mealType] ?? []).map((entry) => diaryLogKey(entry.log.id)),
  ]);
}

/** A new set with `key` added if it was missing, or removed if it was there. */
export function toggleSelectionKey(
  keys: ReadonlySet<DiarySelectionKey>,
  key: DiarySelectionKey
): ReadonlySet<DiarySelectionKey> {
  const next = new Set(keys);
  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  return next;
}

export type DiarySelection = {
  /** Every selected log, groups expanded, in diary order. */
  entries: ResolvedLogEntry[];
  /** The selected grouped meals. */
  groups: MealGroup[];
  /** Selected cards — a grouped meal counts once, however many logs it holds. */
  itemCount: number;
  /** Distinct meal types of the selected cards, in diary order. */
  mealTypes: MealType[];
  /** The one meal type every selected card shares, or null for a mixed selection. */
  commonMealType: MealType | null;
  /** Combined gram weight. Per-serving logs have none, so they add nothing. */
  totalGrams: number;
  totalNutrients: NutrientTotals;
};

/**
 * Resolve selection keys against what the diary currently shows. A key whose card is gone
 * (deleted, moved to another day, unpacked) simply does not resolve, so a selection prunes
 * itself by derivation rather than by an effect that edits the stored keys.
 */
export function resolveDiarySelection(
  keys: ReadonlySet<DiarySelectionKey>,
  ungroupedByType: Record<MealType, ResolvedLogEntry[]>,
  mealGroupsByType: Record<MealType, MealGroup[]>
): DiarySelection {
  const entries: ResolvedLogEntry[] = [];
  const groups: MealGroup[] = [];
  const mealTypes: MealType[] = [];
  let itemCount = 0;

  if (keys.size > 0) {
    for (const { type } of MEAL_TYPES) {
      const before = itemCount;

      for (const group of mealGroupsByType[type] ?? []) {
        if (keys.has(diaryGroupKey(type, group.groupId))) {
          groups.push(group);
          entries.push(...group.entries);
          itemCount++;
        }
      }

      for (const entry of ungroupedByType[type] ?? []) {
        if (keys.has(diaryLogKey(entry.log.id))) {
          entries.push(entry);
          itemCount++;
        }
      }

      if (itemCount > before) {
        mealTypes.push(type);
      }
    }
  }

  return {
    entries,
    groups,
    itemCount,
    mealTypes,
    commonMealType: mealTypes.length === 1 ? mealTypes[0] : null,
    totalGrams: entries.reduce((sum, entry) => sum + entry.gramWeight, 0),
    totalNutrients: sumNutrients(entries),
  };
}
