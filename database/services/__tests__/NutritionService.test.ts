import { database } from '@/database';
import type NutritionLog from '@/database/models/NutritionLog';
import { NutritionService } from '@/database/services/NutritionService';
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
    lt: jest.fn((value: unknown) => ({ kind: 'lt', value })),
    sortBy: jest.fn((field: string, direction: string) => ({ kind: 'sortBy', field, direction })),
    skip: jest.fn((count: number) => ({ kind: 'skip', count })),
    take: jest.fn((count: number) => ({ kind: 'take', count })),
    asc: 'asc',
    desc: 'desc',
  },
}));

jest.mock('@/database', () => ({
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

jest.mock('@/database/services/DatabaseRepairService', () => ({
  DatabaseRepairService: {},
  REPAIR_DESCRIPTORS: { nutritionLogs: 'nutritionLogs' },
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

  it('respects the limit', async () => {
    withLogs([logDaysAgo(1, 'a'), logDaysAgo(2, 'b'), logDaysAgo(3, 'c'), logDaysAgo(4, 'd')]);

    const days = await NutritionService.getRecentLoggedDays(2);

    expect(days).toHaveLength(2);
  });

  it('omits the excluded day so the target day never offers to copy itself', async () => {
    const excluded = logDaysAgo(1, 'a');
    withLogs([excluded, logDaysAgo(2, 'b')]);

    const days = await NutritionService.getRecentLoggedDays(14, 60, {
      excludeDayKey: utcNormalizedDayKey(excluded.date, excluded.timezone),
    });

    expect(days).toHaveLength(1);
    expect(days[0].dayKey).not.toBe(utcNormalizedDayKey(excluded.date, excluded.timezone));
  });

  it('returns nothing when no days have logs', async () => {
    withLogs([]);

    expect(await NutritionService.getRecentLoggedDays()).toEqual([]);
  });
});
