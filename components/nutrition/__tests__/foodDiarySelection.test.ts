import {
  cardKeysOfMeal,
  diaryGroupKey,
  diaryLogKey,
  resolveDiarySelection,
  toggleSelectionKey,
} from '@/components/nutrition/foodDiarySelection';
import type { MealGroup, ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type NutritionLog from '@/database/models/NutritionLog';
import type { MealType } from '@/database/models/NutritionLog';

function entry(
  id: string,
  type: MealType,
  {
    groupId,
    gramWeight = 100,
    calories = 200,
  }: Partial<{
    groupId: string;
    gramWeight: number;
    calories: number;
  }> = {}
): ResolvedLogEntry {
  return {
    log: { id, type, groupId } as unknown as NutritionLog,
    food: null,
    nutrients: { calories, protein: 10, carbs: 20, fat: 5, fiber: 2, alcohol: 0 },
    gramWeight,
    displayName: id,
  };
}

function group(groupId: string, entries: ResolvedLogEntry[]): MealGroup {
  return {
    groupId,
    mealName: groupId,
    entries,
    totalNutrients: { calories: 0, protein: 0, carbs: 0, fat: 0 },
  };
}

function byType<T>(values: Partial<Record<MealType, T[]>>): Record<MealType, T[]> {
  return {
    breakfast: values.breakfast ?? [],
    lunch: values.lunch ?? [],
    dinner: values.dinner ?? [],
    snack: values.snack ?? [],
    other: values.other ?? [],
  };
}

const oats = entry('oats', 'breakfast');
const coffee = entry('coffee', 'breakfast', { gramWeight: 0, calories: 5 });
const bowlRice = entry('bowl-rice', 'lunch', { groupId: 'bowl', gramWeight: 150 });
const bowlChicken = entry('bowl-chicken', 'lunch', { groupId: 'bowl', gramWeight: 120 });
// The same group id logged into a second meal type renders as a second, separate card.
const bowlLeftover = entry('bowl-leftover', 'dinner', { groupId: 'bowl', gramWeight: 80 });
const apple = entry('apple', 'snack');

const ungrouped = byType({ breakfast: [oats, coffee], snack: [apple] });
const groups = byType({
  lunch: [group('bowl', [bowlRice, bowlChicken])],
  dinner: [group('bowl', [bowlLeftover])],
});

const resolve = (keys: string[]) => resolveDiarySelection(new Set(keys), ungrouped, groups);

describe('toggleSelectionKey', () => {
  it('adds a missing key and removes a present one without mutating the input', () => {
    const empty: ReadonlySet<string> = new Set();
    const added = toggleSelectionKey(empty, 'log:a');

    expect([...added]).toEqual(['log:a']);
    expect(empty.size).toBe(0);
    expect([...toggleSelectionKey(added, 'log:a')]).toEqual([]);
  });
});

describe('resolveDiarySelection', () => {
  it('resolves to nothing for an empty selection', () => {
    const selection = resolve([]);

    expect(selection.itemCount).toBe(0);
    expect(selection.entries).toEqual([]);
    expect(selection.commonMealType).toBeNull();
  });

  it('expands a selected group into every log it holds, counting it as one item', () => {
    const selection = resolve([diaryGroupKey('lunch', 'bowl')]);

    expect(selection.itemCount).toBe(1);
    expect(selection.entries.map((e) => e.log.id)).toEqual(['bowl-rice', 'bowl-chicken']);
    expect(selection.groups.map((g) => g.groupId)).toEqual(['bowl']);
  });

  it('keeps the same group id in two meal types as two separate cards', () => {
    const lunchOnly = resolve([diaryGroupKey('lunch', 'bowl')]);
    expect(lunchOnly.entries.map((e) => e.log.id)).not.toContain('bowl-leftover');

    const both = resolve([diaryGroupKey('lunch', 'bowl'), diaryGroupKey('dinner', 'bowl')]);
    expect(both.itemCount).toBe(2);
    expect(both.entries.map((e) => e.log.id)).toContain('bowl-leftover');
  });

  it('drops keys whose card is no longer in the diary', () => {
    const selection = resolve([diaryLogKey('oats'), diaryLogKey('deleted-log')]);

    expect(selection.itemCount).toBe(1);
    expect(selection.entries.map((e) => e.log.id)).toEqual(['oats']);
  });

  it('reports the shared meal type, or null for a selection spanning several meals', () => {
    expect(resolve([diaryLogKey('oats'), diaryLogKey('coffee')]).commonMealType).toBe('breakfast');

    const mixed = resolve([diaryLogKey('apple'), diaryLogKey('oats')]);
    expect(mixed.commonMealType).toBeNull();
    // Diary order, not selection order.
    expect(mixed.mealTypes).toEqual(['breakfast', 'snack']);
  });

  it('sums grams and nutrients across the selection, per-serving logs adding no grams', () => {
    const selection = resolve([diaryLogKey('oats'), diaryLogKey('coffee')]);

    expect(selection.totalGrams).toBe(100);
    expect(selection.totalNutrients.calories).toBe(205);
    expect(selection.totalNutrients.protein).toBe(20);
  });
});

describe('cardKeysOfMeal', () => {
  it('lists the grouped meals and the loose logs under one meal type, and nothing else', () => {
    expect([...cardKeysOfMeal('breakfast', ungrouped, groups)]).toEqual([
      diaryLogKey('oats'),
      diaryLogKey('coffee'),
    ]);
    expect([...cardKeysOfMeal('lunch', ungrouped, groups)]).toEqual([
      diaryGroupKey('lunch', 'bowl'),
    ]);
    expect(cardKeysOfMeal('other', ungrouped, groups).size).toBe(0);
  });

  it('resolves to the whole meal section: every log, each grouped meal counted once', () => {
    const lunch = resolveDiarySelection(
      cardKeysOfMeal('lunch', ungrouped, groups),
      ungrouped,
      groups
    );

    expect(lunch.entries.map((e) => e.log.id)).toEqual(['bowl-rice', 'bowl-chicken']);
    expect(lunch.itemCount).toBe(1);
    expect(lunch.commonMealType).toBe('lunch');

    const breakfast = resolveDiarySelection(
      cardKeysOfMeal('breakfast', ungrouped, groups),
      ungrouped,
      groups
    );
    expect(breakfast.itemCount).toBe(2);
    expect(breakfast.totalGrams).toBe(100);
  });
});
