/* eslint-disable @typescript-eslint/no-require-imports */
import { MACRO_STREAK_STATE } from '@/constants/misc';
import { NutritionService } from '@/database/services/NutritionService';
import { getMacroStreak } from '@/utils/macroStreak';

jest.mock('@react-native-async-storage/async-storage', () => {
  const storageData: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(storageData[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        storageData[key] = value;
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        Object.keys(storageData).forEach((k) => delete storageData[k]);
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { getMacroLoggingStreak: jest.fn() },
}));

const mockStorage = require('@react-native-async-storage/async-storage').default;
const mockGetStreak = NutritionService.getMacroLoggingStreak as jest.Mock;

const NOON_DAY_1 = new Date('2026-06-15T12:00:00').getTime();
const NOON_DAY_2 = new Date('2026-06-16T12:00:00').getTime();
const NOON_DAY_3 = new Date('2026-06-17T12:00:00').getTime();

describe('utils/macroStreak', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await mockStorage.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('computes and persists the streak on the first read of a day', async () => {
    jest.setSystemTime(NOON_DAY_1);
    mockGetStreak.mockResolvedValue(5);

    const result = await getMacroStreak();

    expect(result).toEqual({ currentStreak: 5, bestStreak: 5 });
    expect(mockGetStreak).toHaveBeenCalledTimes(1);
    const persisted = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
    expect(persisted.currentStreak).toBe(5);
    expect(persisted.bestStreak).toBe(5);
    expect(mockStorage.setItem.mock.calls[0][0]).toBe(MACRO_STREAK_STATE);
  });

  it('returns the cached value without recomputing on a second read the same day', async () => {
    jest.setSystemTime(NOON_DAY_1);
    mockGetStreak.mockResolvedValue(5);
    await getMacroStreak();

    mockGetStreak.mockResolvedValue(999); // would change the result if recomputed
    const result = await getMacroStreak();

    expect(result).toEqual({ currentStreak: 5, bestStreak: 5 });
    expect(mockGetStreak).toHaveBeenCalledTimes(1);
  });

  it('keeps the best streak when a new day has a shorter current streak', async () => {
    jest.setSystemTime(NOON_DAY_1);
    mockGetStreak.mockResolvedValue(8);
    await getMacroStreak();

    jest.setSystemTime(NOON_DAY_2);
    mockGetStreak.mockResolvedValue(2);
    const result = await getMacroStreak();

    expect(result).toEqual({ currentStreak: 2, bestStreak: 8 });
  });

  it('promotes the best streak when a new day exceeds it', async () => {
    jest.setSystemTime(NOON_DAY_1);
    mockGetStreak.mockResolvedValue(3);
    await getMacroStreak();

    jest.setSystemTime(NOON_DAY_3);
    mockGetStreak.mockResolvedValue(10);
    const result = await getMacroStreak();

    expect(result).toEqual({ currentStreak: 10, bestStreak: 10 });
  });

  it('recomputes when stored state is corrupt', async () => {
    jest.setSystemTime(NOON_DAY_1);
    await mockStorage.setItem(MACRO_STREAK_STATE, 'not-json');
    mockGetStreak.mockResolvedValue(4);

    const result = await getMacroStreak();

    expect(result).toEqual({ currentStreak: 4, bestStreak: 4 });
    expect(mockGetStreak).toHaveBeenCalledTimes(1);
  });
});
