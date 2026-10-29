import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import {
  NutritionService,
  scaleMealNutritionLogsToTotalGrams,
} from '@/database/services/NutritionService';
import {
  utcDayKeyFromLocalDate,
  utcNormalizedDayKey,
  wallClockDateInTimezone,
} from '@/utils/calendarDate';
import { widgetEvents } from '@/utils/widgetEvents';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    gte: jest.fn((value: unknown) => ({ kind: 'gte', value })),
    oneOf: jest.fn((values: unknown[]) => ({ kind: 'oneOf', values })),
    lt: jest.fn((value: unknown) => ({ kind: 'lt', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    skip: jest.fn((count: number) => ({ kind: 'skip', count })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    asc: 'asc',
    desc: 'desc',
  },
}));

// `@/database` merely re-exports this module, so mocking only that would leave
// `queryByIds` (and every model) holding the real instance and, through it, the native
// adapter.
jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(async (callback: () => Promise<void>) => callback()),
    batch: jest.fn(async () => undefined),
  },
}));

jest.mock('@/utils/widgetEvents', () => ({
  widgetEvents: { emitNutritionWidgetUpdate: jest.fn() },
}));

jest.mock('@/services/healthConnectNutrition', () => ({
  writeNutritionLogToHealthConnect: jest.fn(),
}));

jest.mock('@/database/services/MealService', () => ({ MealService: {} }));

// The copy path moves ciphertext verbatim and never decrypts, so the real helpers (which
// pull in expo-secure-store) are dead weight here.
jest.mock('@/database/encryptionHelpers', () => ({
  decryptNumber: jest.fn(),
  encryptNumber: jest.fn(),
  encryptNutritionLogSnapshot: jest.fn(),
}));

jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));

// Reaches the real database instance (and through it, the native adapter) which neither
// method under test touches.
jest.mock('@/database/nutritionDayCoverage', () => ({
  getNutritionDayCoverage: jest.fn(),
  loggedOrFastedDayKeys: jest.fn(),
}));

jest.mock('@/constants/database', () => ({
  REPAIR_DESCRIPTORS: { nutritionLogs: 'nutritionLogs' },
}));

jest.mock('@/database/services/DatabaseRepairService', () => ({
  DatabaseRepairService: {},
  retryAfterRepair: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));

const mockDatabase = database as jest.Mocked<typeof database>;

type LogOverrides = Partial<{
  id: string;
  date: number;
  timezone: string | null;
  type: string;
  amount: number;
  groupId: string;
  loggedMealName: string;
  externalId: string;
  calories: number;
}>;

/** A stand-in for a stored log — only the fields the copy path reads. */
function mockLog(overrides: LogOverrides = {}): NutritionLog {
  const {
    id = 'log-1',
    date = Date.UTC(2026, 6, 14, 8, 30),
    timezone = '+00:00',
    type = 'breakfast',
    amount = 100,
    groupId,
    loggedMealName,
    externalId,
    calories = 250,
  } = overrides;

  return {
    id,
    foodId: `food-${id}`,
    date,
    timezone,
    type,
    amount,
    portionId: undefined,
    externalId,
    loggedFoodNameRaw: `cipher-name-${id}`,
    loggedCaloriesRaw: `cipher-cal-${id}`,
    loggedProteinRaw: `cipher-pro-${id}`,
    loggedCarbsRaw: `cipher-carb-${id}`,
    loggedFatRaw: `cipher-fat-${id}`,
    loggedFiberRaw: `cipher-fib-${id}`,
    loggedMicrosRaw: `cipher-mic-${id}`,
    loggedNutriscore: 'b',
    loggedEcoscore: 'c',
    loggedNovaGroup: 3,
    snapshotBasis: 'per_100g',
    groupId,
    loggedMealName,
    getNutrients: jest.fn().mockResolvedValue({
      calories,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      alcohol: 0,
    }),
  } as unknown as NutritionLog;
}

/** Captures the records `prepareCreate` builds so assertions can read them back. */
function captureCreatedRecords() {
  const created: Record<string, unknown>[] = [];
  const prepareCreate = jest.fn((callback: (record: Record<string, unknown>) => void) => {
    const record: Record<string, unknown> = {};
    callback(record);
    created.push(record);
    return record;
  });

  mockDatabase.get.mockReturnValue({ prepareCreate } as any);
  return { created, prepareCreate };
}

/**
 * Gives `log` a `prepareUpdate` that applies the writer's callback to an empty draft, so a
 * test can tell which fields an update set (present in the draft) from those it left alone.
 */
function capturePreparedUpdate(log: NutritionLog) {
  const draft: Record<string, unknown> = {};
  (log as unknown as { prepareUpdate: jest.Mock }).prepareUpdate = jest.fn(
    (callback: (record: Record<string, unknown>) => void) => {
      callback(draft);
      return draft;
    }
  );

  return draft;
}

describe('NutritionService.copyNutritionLogsPreservingMealType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps each log on its own meal type instead of forcing a single one', async () => {
    const { created } = captureCreatedRecords();

    await NutritionService.copyNutritionLogsPreservingMealType(
      [
        mockLog({ id: 'a', type: 'breakfast' }),
        mockLog({ id: 'b', type: 'dinner' }),
        mockLog({ id: 'c', type: 'snack' }),
      ],
      new Date(2026, 7, 1)
    );

    expect(created.map((r) => r.type)).toEqual(['breakfast', 'dinner', 'snack']);
  });

  it('preserves groupId and loggedMealName so grouped meals survive the copy', async () => {
    const { created } = captureCreatedRecords();

    await NutritionService.copyNutritionLogsPreservingMealType(
      [
        mockLog({ id: 'a', groupId: 'group-1', loggedMealName: 'Chicken bowl' }),
        mockLog({ id: 'b', groupId: 'group-1', loggedMealName: 'Chicken bowl' }),
      ],
      new Date(2026, 7, 1)
    );

    expect(created.map((r) => r.groupId)).toEqual(['group-1', 'group-1']);
    expect(created.map((r) => r.loggedMealName)).toEqual(['Chicken bowl', 'Chicken bowl']);
  });

  it('copies the encrypted snapshot fields verbatim (no re-encryption)', async () => {
    const { created } = captureCreatedRecords();
    const source = mockLog({ id: 'a' });

    await NutritionService.copyNutritionLogsPreservingMealType([source], new Date(2026, 7, 1));

    expect(created[0]).toMatchObject({
      loggedFoodNameRaw: source.loggedFoodNameRaw,
      loggedCaloriesRaw: source.loggedCaloriesRaw,
      loggedProteinRaw: source.loggedProteinRaw,
      loggedCarbsRaw: source.loggedCarbsRaw,
      loggedFatRaw: source.loggedFatRaw,
      loggedFiberRaw: source.loggedFiberRaw,
      loggedMicrosRaw: source.loggedMicrosRaw,
      snapshotBasis: source.snapshotBasis,
    });
  });

  it('does not carry over externalId — a copy is not the same external record', async () => {
    const { created } = captureCreatedRecords();

    await NutritionService.copyNutritionLogsPreservingMealType(
      [mockLog({ id: 'a', externalId: 'health-connect-123' })],
      new Date(2026, 7, 1)
    );

    expect(created[0].externalId).toBeUndefined();
  });

  it('lands on the target day while preserving each source time-of-day', async () => {
    const { created } = captureCreatedRecords();
    const targetDate = new Date(2026, 7, 1);
    const breakfast = mockLog({ id: 'a', date: Date.UTC(2026, 6, 14, 8, 30), timezone: '+00:00' });
    const dinner = mockLog({ id: 'b', date: Date.UTC(2026, 6, 14, 19, 45), timezone: '+00:00' });

    await NutritionService.copyNutritionLogsPreservingMealType([breakfast, dinner], targetDate);

    const [copiedBreakfast, copiedDinner] = created.map((r) => r.date as number);

    // Both land on the target calendar day...
    const targetDayKey = utcDayKeyFromLocalDate(targetDate);
    expect(utcNormalizedDayKey(copiedBreakfast, created[0].timezone as string)).toBe(targetDayKey);
    expect(utcNormalizedDayKey(copiedDinner, created[1].timezone as string)).toBe(targetDayKey);

    // ...but the two source times are still distinct and match their originals.
    const breakfastWallClock = wallClockDateInTimezone(breakfast.date, breakfast.timezone);
    const dinnerWallClock = wallClockDateInTimezone(dinner.date, dinner.timezone);
    expect(new Date(copiedBreakfast).getHours()).toBe(breakfastWallClock.getHours());
    expect(new Date(copiedDinner).getHours()).toBe(dinnerWallClock.getHours());
    expect(copiedBreakfast).not.toBe(copiedDinner);
  });

  it('preserves the source wall-clock time when its stored timezone differs from the target', async () => {
    const { created } = captureCreatedRecords();
    // 18:45 in India is 13:15 UTC. Reading the instant directly would therefore
    // copy the wrong time-of-day onto the target date.
    const source = mockLog({
      date: Date.UTC(2026, 6, 14, 13, 15),
      timezone: '+05:30',
    });

    await NutritionService.copyNutritionLogsPreservingMealType([source], new Date(2026, 7, 1));

    const copiedWallClock = wallClockDateInTimezone(
      created[0].date as number,
      created[0].timezone as string
    );
    expect(copiedWallClock.getHours()).toBe(18);
    expect(copiedWallClock.getMinutes()).toBe(45);
  });

  it('returns the number of logs created and refreshes the widget', async () => {
    captureCreatedRecords();

    const count = await NutritionService.copyNutritionLogsPreservingMealType(
      [mockLog({ id: 'a' }), mockLog({ id: 'b' })],
      new Date(2026, 7, 1)
    );

    expect(count).toBe(2);
    expect(widgetEvents.emitNutritionWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it('opens no write and fires no widget event for an empty selection', async () => {
    captureCreatedRecords();

    const count = await NutritionService.copyNutritionLogsPreservingMealType(
      [],
      new Date(2026, 7, 1)
    );

    expect(count).toBe(0);
    expect(mockDatabase.write).not.toHaveBeenCalled();
    expect(widgetEvents.emitNutritionWidgetUpdate).not.toHaveBeenCalled();
  });
});

describe('NutritionService.getRecentLoggedDays', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /** Wires the range query to return `logs`. */
  function withLogs(logs: NutritionLog[]) {
    mockDatabase.get.mockReturnValue({
      query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(logs) }),
    } as any);
  }

  /** A log placed at local noon `daysAgo` days back, so day bucketing is unambiguous. */
  function logDaysAgo(daysAgo: number, id: string, calories = 100): NutritionLog {
    const day = new Date();
    day.setDate(day.getDate() - daysAgo);
    day.setHours(12, 0, 0, 0);
    const offsetMinutes = -day.getTimezoneOffset();
    const sign = offsetMinutes < 0 ? '-' : '+';
    const abs = Math.abs(offsetMinutes);
    const timezone = `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;

    return mockLog({ id, date: day.getTime(), timezone, calories });
  }

  it('buckets logs by day, newest first, with per-day totals', async () => {
    withLogs([
      logDaysAgo(1, 'a', 100),
      logDaysAgo(1, 'b', 250),
      logDaysAgo(3, 'c', 400),
      logDaysAgo(2, 'd', 50),
    ]);

    const days = await NutritionService.getRecentLoggedDays();

    expect(days.map((d) => d.itemCount)).toEqual([2, 1, 1]);
    expect(days.map((d) => d.calories)).toEqual([350, 50, 400]);
    expect(days[0].dayKey).toBeGreaterThan(days[1].dayKey);
    expect(days[1].dayKey).toBeGreaterThan(days[2].dayKey);
  });

  it('buckets an instant by each log stored timezone rather than the device timezone', async () => {
    jest.useFakeTimers({ now: Date.UTC(2026, 7, 3) });
    try {
      const instant = Date.UTC(2026, 7, 2, 0, 30);
      withLogs([
        mockLog({ id: 'east', date: instant, timezone: '+02:00', calories: 100 }),
        mockLog({ id: 'west', date: instant, timezone: '-02:00', calories: 200 }),
      ]);

      const days = await NutritionService.getRecentLoggedDays();

      expect(days).toEqual([
        { dayKey: Date.UTC(2026, 7, 2), itemCount: 1, calories: 100 },
        { dayKey: Date.UTC(2026, 7, 1), itemCount: 1, calories: 200 },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('respects the limit', async () => {
    const included = [logDaysAgo(1, 'a'), logDaysAgo(2, 'b')];
    const omitted = [logDaysAgo(3, 'c'), logDaysAgo(4, 'd')];
    withLogs([...included, ...omitted]);

    const days = await NutritionService.getRecentLoggedDays(2);

    expect(days).toHaveLength(2);
    for (const log of included) {
      expect(log.getNutrients).toHaveBeenCalledTimes(1);
    }
    for (const log of omitted) {
      expect(log.getNutrients).not.toHaveBeenCalled();
    }
  });

  it('omits the excluded day so the target day never offers to copy itself', async () => {
    const excluded = logDaysAgo(1, 'a');
    withLogs([excluded, logDaysAgo(2, 'b')]);

    const days = await NutritionService.getRecentLoggedDays(14, 60, {
      excludeDayKey: utcNormalizedDayKey(excluded.date, excluded.timezone),
    });

    expect(days).toHaveLength(1);
    expect(days[0].dayKey).not.toBe(utcNormalizedDayKey(excluded.date, excluded.timezone));
    expect(excluded.getNutrients).not.toHaveBeenCalled();
  });

  it('returns nothing when no days have logs', async () => {
    withLogs([]);

    expect(await NutritionService.getRecentLoggedDays()).toEqual([]);
  });
});

describe('NutritionService.normalizeAiMealIngredients', () => {
  /** A `foods` collection that counts how it was reached. */
  function wireFoods(rows: Record<string, unknown>[]) {
    const fetch = jest.fn().mockResolvedValue(rows);
    const query = jest.fn(() => ({ fetch }));
    const find = jest.fn(async (id: string) => {
      const row = rows.find((food) => food.id === id);
      if (!row) {
        throw new Error(`Record ${id} not found`);
      }

      return row;
    });

    mockDatabase.get.mockReturnValue({ find, query } as any);
    return { find, query };
  }

  const ingredient = (foodId: string | undefined, grams = 100) => ({
    kcal: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    grams,
    ...(foodId ? { foodId } : {}),
  });

  const storedFood = (id: string) => ({
    id,
    calories: 100,
    protein: 10,
    carbs: 20,
    fat: 5,
    fiber: 2,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves every ingredient with a single batched query, never a find() per row', async () => {
    const rows = Array.from({ length: 50 }, (_, index) => storedFood(`food-${index}`));
    const { find, query } = wireFoods(rows);

    const result = await NutritionService.normalizeAiMealIngredients(
      rows.map((food) => ingredient(food.id))
    );

    expect(query).toHaveBeenCalledTimes(1);
    expect(find).not.toHaveBeenCalled();
    expect(result).toHaveLength(50);
    // Scaled from the stored per-100g values, not the zeroes the LLM sent.
    expect(result[0]).toMatchObject({ kcal: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 });
  });

  it('collapses duplicate food ids into one set of query parameters', async () => {
    const { query } = wireFoods([storedFood('food-1')]);

    await NutritionService.normalizeAiMealIngredients([
      ingredient('food-1'),
      ingredient('food-1'),
      ingredient('food-1'),
    ]);

    expect(JSON.stringify(query.mock.calls[0])).toContain('"values":["food-1"]');
  });

  it('strips the foodId of a genuinely missing food while leaving its neighbours linked', async () => {
    wireFoods([storedFood('food-known')]);

    const [known, missing] = await NutritionService.normalizeAiMealIngredients([
      ingredient('food-known'),
      ingredient('food-gone'),
    ]);

    expect(known).toMatchObject({ foodId: 'food-known', kcal: 100 });
    expect(missing).not.toHaveProperty('foodId');
  });

  it('rejects when the lookup fails instead of silently unlinking every ingredient', async () => {
    // A swallowed failure would leave the map empty, strip every foodId, and log a
    // foundation-food meal at the zero macros the LLM deliberately sent.
    const fetch = jest.fn().mockRejectedValue(new Error('db unavailable'));
    mockDatabase.get.mockReturnValue({ query: jest.fn(() => ({ fetch })) } as any);

    await expect(
      NutritionService.normalizeAiMealIngredients([ingredient('food-1'), ingredient('food-2')])
    ).rejects.toThrow('db unavailable');
  });

  it('issues no query when no ingredient references a stored food', async () => {
    const { query } = wireFoods([]);

    const result = await NutritionService.normalizeAiMealIngredients([ingredient(undefined)]);

    expect(query).not.toHaveBeenCalled();
    expect(result).toEqual([ingredient(undefined)]);
  });
});

describe('NutritionService.logCustomMeal consumedTime', () => {
  const meal = { name: 'Oats', calories: 300, protein: 10, carbs: 50, fat: 5, foodId: 'food-1' };

  afterEach(() => jest.restoreAllMocks());

  it('logs the chosen time of day on the chosen day', async () => {
    const logFood = jest.spyOn(NutritionService, 'logFood').mockResolvedValue({} as NutritionLog);

    await NutritionService.logCustomMeal(
      meal,
      new Date(2026, 2, 10, 23, 59), // the day picked; its own time-of-day must not leak through
      'breakfast',
      100,
      { consumedTime: new Date(2020, 0, 1, 8, 30) } // only the wall-clock time matters
    );

    const consumed = logFood.mock.calls[0][1] as Date;
    expect([consumed.getFullYear(), consumed.getMonth(), consumed.getDate()]).toEqual([
      2026, 2, 10,
    ]);
    expect([consumed.getHours(), consumed.getMinutes()]).toEqual([8, 30]);
  });

  it('keeps "that day, right now" when no time is given', async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 1, 14, 5));
    const logFood = jest.spyOn(NutritionService, 'logFood').mockResolvedValue({} as NutritionLog);

    await NutritionService.logCustomMeal(meal, new Date(2026, 2, 10), 'lunch', 100);

    const consumed = logFood.mock.calls[0][1] as Date;
    expect([consumed.getMonth(), consumed.getDate()]).toEqual([2, 10]);
    expect([consumed.getHours(), consumed.getMinutes()]).toEqual([14, 5]);
    jest.useRealTimers();
  });
});

describe('NutritionService.groupNutritionLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('files every log under one group, name and meal type in a single batch', async () => {
    const logs = [mockLog({ id: 'a', type: 'breakfast' }), mockLog({ id: 'b', type: 'snack' })];
    const drafts = logs.map(capturePreparedUpdate);

    await NutritionService.groupNutritionLogs(logs, {
      groupId: 'group-new',
      mealName: 'Lunch bowl',
      mealType: 'lunch',
    });

    expect(mockDatabase.write).toHaveBeenCalledTimes(1);
    expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    expect(mockDatabase.batch).toHaveBeenCalledWith(...drafts);
    for (const draft of drafts) {
      expect(draft).toMatchObject({
        groupId: 'group-new',
        loggedMealName: 'Lunch bowl',
        type: 'lunch',
      });
    }

    expect(widgetEvents.emitNutritionWidgetUpdate).toHaveBeenCalledTimes(1);
  });

  it('leaves the names and meal type alone when only a group id is given (undo of unpack)', async () => {
    const log = mockLog({ id: 'a', loggedMealName: 'Chicken bowl' });
    const draft = capturePreparedUpdate(log);

    await NutritionService.groupNutritionLogs([log], { groupId: 'group-1' });

    expect(draft.groupId).toBe('group-1');
    expect('loggedMealName' in draft).toBe(false);
    expect('type' in draft).toBe(false);
  });

  it('opens no write for an empty selection', async () => {
    await NutritionService.groupNutritionLogs([], { groupId: 'group-1' });

    expect(mockDatabase.write).not.toHaveBeenCalled();
  });
});

describe('NutritionService.ungroupNutritionLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('clears the group id in one batch and keeps the logged meal name', async () => {
    const logs = [
      mockLog({ id: 'a', groupId: 'group-1', loggedMealName: 'Chicken bowl' }),
      mockLog({ id: 'b', groupId: 'group-1', loggedMealName: 'Chicken bowl' }),
    ];
    const drafts = logs.map(capturePreparedUpdate);

    await NutritionService.ungroupNutritionLogs(logs);

    expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
    for (const draft of drafts) {
      expect('groupId' in draft).toBe(true);
      expect(draft.groupId).toBeUndefined();
      expect('loggedMealName' in draft).toBe(false);
    }

    expect(widgetEvents.emitNutritionWidgetUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('NutritionService.moveNutritionLogsPreservingMealType', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('moves each log to the target day at its own time of day, keeping its meal type', async () => {
    const targetDate = new Date(2026, 7, 1);
    const breakfast = mockLog({ id: 'a', type: 'breakfast', date: Date.UTC(2026, 6, 14, 8, 30) });
    const dinner = mockLog({ id: 'b', type: 'dinner', date: Date.UTC(2026, 6, 14, 19, 45) });
    const [breakfastDraft, dinnerDraft] = [breakfast, dinner].map(capturePreparedUpdate);

    await NutritionService.moveNutritionLogsPreservingMealType([breakfast, dinner], targetDate);

    const targetDayKey = utcDayKeyFromLocalDate(targetDate);
    for (const [source, draft] of [
      [breakfast, breakfastDraft],
      [dinner, dinnerDraft],
    ] as const) {
      expect(utcNormalizedDayKey(draft.date as number, draft.timezone as string)).toBe(
        targetDayKey
      );
      expect(
        wallClockDateInTimezone(draft.date as number, draft.timezone as string).getHours()
      ).toBe(wallClockDateInTimezone(source.date, source.timezone).getHours());
      expect('type' in draft).toBe(false);
    }

    expect(mockDatabase.batch).toHaveBeenCalledTimes(1);
  });
});

describe('scaleMealNutritionLogsToTotalGrams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scales a per-serving log by the same ratio instead of zeroing it', async () => {
    const grams = mockLog({ id: 'rice', amount: 100 });
    const servings = mockLog({ id: 'bar', amount: 2 });
    (servings as unknown as { snapshotBasis: string }).snapshotBasis = 'per_serving';
    const [gramsDraft, servingsDraft] = [grams, servings].map(capturePreparedUpdate);

    // Only the rice has a gram weight; doubling the meal doubles the bars too.
    await scaleMealNutritionLogsToTotalGrams(
      [
        { log: grams, gramWeight: 100 },
        { log: servings, gramWeight: 0 },
      ],
      200
    );

    expect(gramsDraft.amount).toBe(200);
    expect(servingsDraft.amount).toBe(4);
  });
});
