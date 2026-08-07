import { MEAL_TYPES, type ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type { MealType } from '@/database/models/NutritionLog';

/**
 * Selection model for "copy a past day into this one".
 *
 * Grouped meals (logs sharing a `group_id`) collapse into a single tickable row —
 * copying half of an AI-generated or saved meal would leave a group that no longer
 * adds up, so a group is always all-or-nothing. Loose logs stay individual rows.
 * This mirrors how the diary itself splits a day (`ungroupedByType` vs
 * `mealGroupsByType` in `app/app/nutrition/food.tsx`).
 *
 * Selection is tracked as the set of *deselected* row ids rather than selected ones,
 * so "everything ticked" is the natural empty state and rows that arrive later (a
 * different source day being loaded) are ticked without an initialization pass.
 */

export type CopyDayItemKind = 'group' | 'single';

export type CopyDayItem = {
  /** Log id for a loose entry, group id for a grouped meal. Unique within a day. */
  id: string;
  kind: CopyDayItemKind;
  label: string;
  /** Every log this row would copy. */
  logIds: string[];
  calories: number;
};

export type CopyDaySection = {
  mealType: MealType;
  titleKey: string;
  items: CopyDayItem[];
};

export type CopyDaySelectionSummary = {
  itemCount: number;
  logCount: number;
  calories: number;
};

/**
 * Build the preview sections for a source day. Sections with no items are omitted,
 * so the modal never renders an empty "Lunch" heading; ordering follows the diary's
 * canonical {@link MEAL_TYPES}.
 */
export function buildCopyDaySections(entries: ResolvedLogEntry[]): CopyDaySection[] {
  return MEAL_TYPES.map(({ type, titleKey }) => ({
    mealType: type,
    titleKey,
    items: buildItemsForMealType(entries, type),
  })).filter((section) => section.items.length > 0);
}

function buildItemsForMealType(entries: ResolvedLogEntry[], mealType: MealType): CopyDayItem[] {
  const mealEntries = entries.filter((entry) => entry.log.type === mealType);
  const items: CopyDayItem[] = [];
  // Insertion-ordered so grouped meals appear where their first log sat, keeping the
  // preview in the same order the user saw on the source day.
  const groups = new Map<string, ResolvedLogEntry[]>();

  for (const entry of mealEntries) {
    const groupId = entry.log.groupId;

    if (!groupId) {
      items.push({
        id: entry.log.id,
        kind: 'single',
        label: entry.displayName,
        logIds: [entry.log.id],
        calories: entry.nutrients.calories,
      });
      continue;
    }

    const existing = groups.get(groupId);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(groupId, [entry]);
      // Placeholder keeps the group in first-seen position; filled in below.
      items.push({ id: groupId, kind: 'group', label: '', logIds: [], calories: 0 });
    }
  }

  return items.map((item) => {
    if (item.kind === 'single') {
      return item;
    }

    const groupEntries = groups.get(item.id) ?? [];
    return {
      ...item,
      label: groupEntries[0]?.log.loggedMealName || groupEntries[0]?.displayName || '',
      logIds: groupEntries.map((entry) => entry.log.id),
      calories: groupEntries.reduce((sum, entry) => sum + entry.nutrients.calories, 0),
    };
  });
}

/** Rows currently ticked, in section order. */
export function selectedItems(
  sections: CopyDaySection[],
  deselectedItemIds: ReadonlySet<string>
): CopyDayItem[] {
  return sections.flatMap((section) =>
    section.items.filter((item) => !deselectedItemIds.has(item.id))
  );
}

/** The logs a confirm would actually write. */
export function selectedLogIds(
  sections: CopyDaySection[],
  deselectedItemIds: ReadonlySet<string>
): string[] {
  return selectedItems(sections, deselectedItemIds).flatMap((item) => item.logIds);
}

/** Totals for the footer: "copying N items · X kcal". */
export function copyDaySelectionSummary(
  sections: CopyDaySection[],
  deselectedItemIds: ReadonlySet<string>
): CopyDaySelectionSummary {
  const items = selectedItems(sections, deselectedItemIds);

  return {
    itemCount: items.length,
    logCount: items.reduce((sum, item) => sum + item.logIds.length, 0),
    calories: items.reduce((sum, item) => sum + item.calories, 0),
  };
}

/** Every row id in the day — the "deselect all" target. */
export function allCopyDayItemIds(sections: CopyDaySection[]): string[] {
  return sections.flatMap((section) => section.items.map((item) => item.id));
}
