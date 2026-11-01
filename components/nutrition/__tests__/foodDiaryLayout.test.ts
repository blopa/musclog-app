import type { MealType } from '@/database/models/NutritionLog';

import {
  buildTimeSections,
  formatHourLabel,
  formatItemTime,
  inferMealTypeFromHour,
  usableTimeOfDayMs,
} from '../foodDiaryLayout';
import type { MealGroup, ResolvedLogEntry } from '../foodTypes';

const emptyByType = <T>(): Record<MealType, T[]> => ({
  breakfast: [],
  lunch: [],
  dinner: [],
  snack: [],
  other: [],
});

function entry(
  id: string,
  utcIso: string,
  calories: number,
  timezone: string | null = '+00:00',
  createdAt = 0
): ResolvedLogEntry {
  return {
    log: { id, date: Date.parse(utcIso), timezone, createdAt },
    food: null,
    nutrients: { calories, protein: 1, carbs: 2, fat: 3, fiber: 0, alcohol: 0 },
    gramWeight: 100,
    displayName: id,
  } as unknown as ResolvedLogEntry;
}

function group(groupId: string, entries: ResolvedLogEntry[]): MealGroup {
  return {
    groupId,
    mealName: groupId,
    entries,
    totalNutrients: {
      calories: entries.reduce((sum, e) => sum + e.nutrients.calories, 0),
      protein: entries.length,
      carbs: entries.length * 2,
      fat: entries.length * 3,
    },
  };
}

describe('usableTimeOfDayMs', () => {
  it('treats exact local midnight as no usable time', () => {
    expect(
      usableTimeOfDayMs({ date: Date.parse('2026-03-01T00:00:00Z'), timezone: '+00:00' })
    ).toBeNull();
  });

  it('reads midnight in the recorded timezone, not the UTC one', () => {
    // 22:00Z is exactly midnight at +02:00.
    expect(
      usableTimeOfDayMs({ date: Date.parse('2026-03-01T22:00:00Z'), timezone: '+02:00' })
    ).toBeNull();
    expect(
      usableTimeOfDayMs({ date: Date.parse('2026-03-01T22:00:00Z'), timezone: '+00:00' })
    ).not.toBeNull();
  });
});

describe('buildTimeSections', () => {
  it('returns no sections for an empty diary', () => {
    expect(buildTimeSections(emptyByType(), emptyByType())).toEqual([]);
  });

  it('puts a single entry in its hour', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.lunch.push(entry('a', '2026-03-01T12:30:00Z', 400));
    const sections = buildTimeSections(ungrouped, emptyByType());
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ key: 'hour-12', hour: 12 });
    expect(sections[0].totals.calories).toBe(400);
  });

  it('orders hours ascending across meal types and keeps the category untouched', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.dinner.push(entry('late', '2026-03-01T19:10:00Z', 700));
    ungrouped.breakfast.push(entry('early', '2026-03-01T07:45:00Z', 300));
    ungrouped.snack.push(entry('mid', '2026-03-01T07:15:00Z', 100));
    const sections = buildTimeSections(ungrouped, emptyByType());
    expect(sections.map((s) => s.key)).toEqual(['hour-7', 'hour-19']);
    expect(sections[0].items.map((i) => (i.kind === 'log' ? i.entry.log.id : ''))).toEqual([
      'mid',
      'early',
    ]);
    expect(sections[0].items[0].mealType).toBe('snack');
  });

  it('sends midnight placeholders to a trailing "no time" section', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.other.push(entry('legacy', '2026-03-01T00:00:00Z', 50));
    ungrouped.lunch.push(entry('real', '2026-03-01T13:00:00Z', 500));
    const sections = buildTimeSections(ungrouped, emptyByType());
    expect(sections.map((s) => s.key)).toEqual(['hour-13', 'no-time']);
    expect(sections[1].hour).toBeNull();
  });

  it('keeps a grouped meal as one card at its earliest usable time', () => {
    const g = group('meal', [
      entry('x', '2026-03-01T12:00:00Z', 200),
      entry('y', '2026-03-01T12:05:00Z', 300),
    ]);
    const groups = emptyByType<MealGroup>();
    groups.lunch.push(g);
    const sections = buildTimeSections(emptyByType(), groups);
    expect(sections).toHaveLength(1);
    expect(sections[0].items).toHaveLength(1);
    expect(sections[0].items[0].kind).toBe('group');
    expect(sections[0].totals.calories).toBe(500);
  });

  it.each([
    {
      name: 'the earliest member follows a later member',
      entries: [
        entry('late', '2026-03-01T19:00:00Z', 200),
        entry('early', '2026-03-01T12:15:00Z', 300),
      ],
      hour: 12,
      label: '12:15',
    },
    {
      name: 'a midnight placeholder precedes a usable member',
      entries: [
        entry('placeholder', '2026-03-01T00:00:00Z', 200),
        entry('timed', '2026-03-01T12:15:00Z', 300),
      ],
      hour: 12,
      label: '12:15',
    },
    {
      name: 'members have different recorded timezones',
      entries: [
        entry('earlier-instant', '2026-03-01T10:00:00Z', 200, '+05:00'),
        entry('earlier-wall-clock', '2026-03-01T14:15:00Z', 300, '-02:00'),
      ],
      hour: 12,
      label: '12:15',
    },
  ])('uses the section time on the group card when $name', ({ entries, hour, label }) => {
    const groups = emptyByType<MealGroup>();
    groups.lunch.push(group('meal', entries));

    const sections = buildTimeSections(emptyByType(), groups);

    expect(sections).toHaveLength(1);
    expect(sections[0].hour).toBe(hour);
    expect(formatItemTime(sections[0].items[0], 'de-DE')).toBe(label);
  });

  it('omits the group card time when every member has only a midnight placeholder', () => {
    const groups = emptyByType<MealGroup>();
    groups.lunch.push(
      group('meal', [
        entry('utc-midnight', '2026-03-01T00:00:00Z', 200),
        entry('local-midnight', '2026-03-01T22:00:00Z', 300, '+02:00'),
      ])
    );

    const sections = buildTimeSections(emptyByType(), groups);

    expect(sections[0].key).toBe('no-time');
    expect(formatItemTime(sections[0].items[0], 'de-DE')).toBeUndefined();
  });

  it("buckets by each entry's recorded timezone, so travel does not move a meal", () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    // 23:30 at -05:00 is 04:30Z next day, still hour 23 on the wall clock it was eaten at.
    ungrouped.dinner.push(entry('tz', '2026-03-02T04:30:00Z', 600, '-05:00'));
    expect(buildTimeSections(ungrouped, emptyByType())[0].key).toBe('hour-23');
  });

  it('puts a 23:xx entry after midnight-adjacent 00:xx entries of the same day only by wall-clock time', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.snack.push(entry('night', '2026-03-01T23:50:00Z', 100));
    ungrouped.snack.push(entry('after', '2026-03-01T00:20:00Z', 100));
    expect(buildTimeSections(ungrouped, emptyByType()).map((s) => s.key)).toEqual([
      'hour-0',
      'hour-23',
    ]);
  });

  it('section totals add up to the day total regardless of grouping', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.breakfast.push(entry('a', '2026-03-01T08:00:00Z', 250));
    ungrouped.lunch.push(entry('b', '2026-03-01T13:00:00Z', 450));
    ungrouped.other.push(entry('c', '2026-03-01T00:00:00Z', 100));
    const groups = emptyByType<MealGroup>();
    groups.dinner.push(group('g', [entry('d', '2026-03-01T19:00:00Z', 800)]));
    const total = buildTimeSections(ungrouped, groups).reduce(
      (sum, s) => sum + s.totals.calories,
      0
    );
    expect(total).toBe(250 + 450 + 100 + 800);
  });

  it('orders equal times by creation time', () => {
    const ungrouped = emptyByType<ResolvedLogEntry>();
    ungrouped.lunch.push(entry('second', '2026-03-01T12:00:00Z', 1, '+00:00', 20));
    ungrouped.lunch.push(entry('first', '2026-03-01T12:00:00Z', 1, '+00:00', 10));
    const ids = buildTimeSections(ungrouped, emptyByType())[0].items.map((i) =>
      i.kind === 'log' ? i.entry.log.id : ''
    );
    expect(ids).toEqual(['first', 'second']);
  });
});

describe('formatting', () => {
  it('formats hour labels per locale (12h vs 24h)', () => {
    expect(formatHourLabel(14, 'en-US')).toMatch(/2\s?PM/i);
    expect(formatHourLabel(14, 'de-DE')).toContain('14');
  });

  it('formats an item time in its recorded timezone and omits unusable times', () => {
    const ok = entry('t', '2026-03-01T14:05:00Z', 1);
    expect(formatItemTime({ kind: 'log', mealType: 'lunch', entry: ok }, 'de-DE')).toContain(
      '14:05'
    );
    const none = entry('n', '2026-03-01T00:00:00Z', 1);
    expect(
      formatItemTime({ kind: 'log', mealType: 'lunch', entry: none }, 'en-US')
    ).toBeUndefined();
  });
});

describe('inferMealTypeFromHour', () => {
  it.each([
    [4, 'snack'],
    [5, 'breakfast'],
    [10, 'breakfast'],
    [11, 'lunch'],
    [14, 'lunch'],
    [15, 'dinner'],
    [21, 'dinner'],
    [22, 'snack'],
  ])('hour %i -> %s', (hour, expected) => {
    expect(inferMealTypeFromHour(hour)).toBe(expected);
  });
});
