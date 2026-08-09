import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

const fetchQueues: Record<string, unknown[][]> = {};

jest.mock('@/database/database-instance', () => ({
  database: {
    get: (table: string) => ({
      query: () => ({
        fetch: async () => fetchQueues[table]?.shift() ?? [],
      }),
    }),
  },
}));

jest.mock('@/database/nutritionDayCoverage', () => ({
  addFastedZeroDaysToMap: jest.fn().mockResolvedValue(undefined),
}));

import { NutritionCheckinService } from '@/database/services/NutritionCheckinService';

const start = Date.UTC(2026, 0, 1);
const day = (index: number) => start + index * MS_PER_SOLAR_DAY;

const weight = (index: number, value: number, unit = 'kg') => ({
  date: day(index),
  timezone: 'UTC',
  getDecrypted: jest.fn().mockResolvedValue({ value, unit }),
});

const nutrition = (index: number, calories = 2000) => ({
  date: day(index),
  timezone: 'UTC',
  getDecryptedSnapshot: jest.fn().mockResolvedValue({ loggedCalories: calories }),
});

it('uses warmed trend weight for status while preserving raw seven-day bars', async () => {
  const checkin = {
    id: 'checkin-1',
    nutritionGoalId: 'goal-1',
    checkinDate: day(40),
    timezone: 'UTC',
    targetWeight: 84,
  } as any;

  fetchQueues.nutrition_checkins = [[checkin]];
  fetchQueues.user_metrics = [
    [weight(10, 100), weight(35, 80), weight(36, 80), weight(38, 80)],
    [],
  ];
  fetchQueues.nutrition_logs = [[nutrition(35), nutrition(36), nutrition(37)]];
  fetchQueues.workout_logs = [[], []];

  const result = await NutritionCheckinService.getCheckinMetrics(checkin);

  expect(result.scaleWeightAverage).toBe(80);
  expect(result.dailyWeights.filter((value) => value > 0)).toEqual([80, 80, 80]);
  expect(result.trendWeight).toBeGreaterThan(84);
  expect(result.targetWeightDelta).toBeGreaterThan(0);
  expect(result.status).toBe('behind');
  expect(result.hasTrendData).toBe(true);
  expect(result.hasEnoughData).toBe(true);
});
