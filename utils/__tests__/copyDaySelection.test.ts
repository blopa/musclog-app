import type { ResolvedLogEntry } from '@/components/nutrition/foodTypes';
import type { MealType } from '@/database/models/NutritionLog';
import {
  allCopyDayItemIds,
  buildCopyDaySections,
  copyDaySelectionSummary,
  selectedLogIds,
} from '@/utils/copyDaySelection';

type EntryOverrides = {
  id: string;
  type: MealType;
  calories?: number;
  groupId?: string;
  loggedMealName?: string;
  displayName?: string;
};

function entry({
  id,
  type,
  calories = 100,
  groupId,
  loggedMealName,
  displayName = `Food ${id}`,
}: EntryOverrides): ResolvedLogEntry {
  return {
    log: { id, type, groupId, loggedMealName } as ResolvedLogEntry['log'],
    food: null,
    nutrients: { calories, protein: 0, carbs: 0, fat: 0, fiber: 0, alcohol: 0 },
    gramWeight: 100,
    displayName,
  };
}

const NONE: ReadonlySet<string> = new Set();

describe('buildCopyDaySections', () => {
  it('keeps loose logs as individual rows', () => {
    const sections = buildCopyDaySections([
      entry({ id: 'a', type: 'breakfast' }),
      entry({ id: 'b', type: 'breakfast' }),
    ]);

    expect(sections).toHaveLength(1);
    expect(sections[0].mealType).toBe('breakfast');
    expect(sections[0].items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(sections[0].items.every((i) => i.kind === 'single')).toBe(true);
  });

  it('collapses logs sharing a groupId into one row carrying every log id', () => {
    const sections = buildCopyDaySections([
      entry({
        id: 'a',
        type: 'lunch',
        groupId: 'g1',
        loggedMealName: 'Chicken bowl',
        calories: 300,
      }),
      entry({
        id: 'b',
        type: 'lunch',
        groupId: 'g1',
        loggedMealName: 'Chicken bowl',
        calories: 200,
      }),
      entry({ id: 'c', type: 'lunch', calories: 50 }),
    ]);

    const [group, loose] = sections[0].items;
    expect(group).toMatchObject({
      id: 'g1',
      kind: 'group',
      label: 'Chicken bowl',
      logIds: ['a', 'b'],
      calories: 500,
    });
    expect(loose).toMatchObject({ id: 'c', kind: 'single', logIds: ['c'] });
  });

  it('orders sections by the canonical meal-type order and omits empty ones', () => {
    const sections = buildCopyDaySections([
      entry({ id: 'a', type: 'snack' }),
      entry({ id: 'b', type: 'breakfast' }),
      entry({ id: 'c', type: 'dinner' }),
    ]);

    expect(sections.map((s) => s.mealType)).toEqual(['breakfast', 'dinner', 'snack']);
  });

  it('places a group where its first log appeared, not at the end', () => {
    const sections = buildCopyDaySections([
      entry({ id: 'a', type: 'dinner' }),
      entry({ id: 'b', type: 'dinner', groupId: 'g1', loggedMealName: 'Stew' }),
      entry({ id: 'c', type: 'dinner' }),
      entry({ id: 'd', type: 'dinner', groupId: 'g1', loggedMealName: 'Stew' }),
    ]);

    expect(sections[0].items.map((i) => i.id)).toEqual(['a', 'g1', 'c']);
  });

  it('falls back to the display name when a group has no meal name', () => {
    const sections = buildCopyDaySections([
      entry({ id: 'a', type: 'other', groupId: 'g1', displayName: 'Leftovers' }),
    ]);

    expect(sections[0].items[0].label).toBe('Leftovers');
  });

  it('returns no sections for an empty day', () => {
    expect(buildCopyDaySections([])).toEqual([]);
  });
});

describe('selectedLogIds', () => {
  const sections = buildCopyDaySections([
    entry({ id: 'a', type: 'breakfast' }),
    entry({ id: 'b', type: 'lunch', groupId: 'g1', loggedMealName: 'Bowl' }),
    entry({ id: 'c', type: 'lunch', groupId: 'g1', loggedMealName: 'Bowl' }),
    entry({ id: 'd', type: 'dinner' }),
  ]);

  it('selects every log when nothing is deselected', () => {
    expect(selectedLogIds(sections, NONE).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('drops every log of a group when its row is deselected', () => {
    expect(selectedLogIds(sections, new Set(['g1'])).sort()).toEqual(['a', 'd']);
  });

  it('drops only the one log when a loose row is deselected', () => {
    expect(selectedLogIds(sections, new Set(['a'])).sort()).toEqual(['b', 'c', 'd']);
  });

  it('selects nothing when every row is deselected', () => {
    expect(selectedLogIds(sections, new Set(allCopyDayItemIds(sections)))).toEqual([]);
  });
});

describe('copyDaySelectionSummary', () => {
  const sections = buildCopyDaySections([
    entry({ id: 'a', type: 'breakfast', calories: 100 }),
    entry({ id: 'b', type: 'lunch', groupId: 'g1', loggedMealName: 'Bowl', calories: 300 }),
    entry({ id: 'c', type: 'lunch', groupId: 'g1', loggedMealName: 'Bowl', calories: 200 }),
  ]);

  it('counts a group as one item but all of its logs', () => {
    expect(copyDaySelectionSummary(sections, NONE)).toEqual({
      itemCount: 2,
      logCount: 3,
      calories: 600,
    });
  });

  it('tracks deselection', () => {
    expect(copyDaySelectionSummary(sections, new Set(['g1']))).toEqual({
      itemCount: 1,
      logCount: 1,
      calories: 100,
    });
  });

  it('is zeroed when nothing is selected', () => {
    expect(copyDaySelectionSummary(sections, new Set(['a', 'g1']))).toEqual({
      itemCount: 0,
      logCount: 0,
      calories: 0,
    });
  });
});

describe('allCopyDayItemIds', () => {
  it('returns one id per row, groups included once', () => {
    const sections = buildCopyDaySections([
      entry({ id: 'a', type: 'breakfast' }),
      entry({ id: 'b', type: 'lunch', groupId: 'g1' }),
      entry({ id: 'c', type: 'lunch', groupId: 'g1' }),
    ]);

    expect(allCopyDayItemIds(sections)).toEqual(['a', 'g1']);
  });
});
