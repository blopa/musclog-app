import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';

import { loadActivityWidgetDays, subscribeToActivityChanges } from '../activityWidgetData';

const mockWithChanges = jest.fn();

jest.mock('@/database/database-instance', () => ({
  database: { withChangesForTables: (...args: unknown[]) => mockWithChanges(...args) },
}));
jest.mock('@/database/repositories/ActivityHeatmapRepository', () => ({
  ActivityHeatmapRepository: { fetchDays: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

it('reads both sources for the 30 days ending today', async () => {
  const workouts = [{ date: '2026-10-17', value: 1 }];
  const nutrition = [{ date: '2026-10-16', value: 3 }];
  (ActivityHeatmapRepository.fetchDays as jest.Mock).mockImplementation(async (source: string) =>
    source === 'workouts' ? workouts : nutrition
  );
  const today = new Date(2026, 9, 17, 9);

  await expect(loadActivityWidgetDays(today)).resolves.toEqual({ workouts, nutrition });

  const calls = (ActivityHeatmapRepository.fetchDays as jest.Mock).mock.calls;
  expect(calls.map(([source]) => source).sort()).toEqual(['nutrition', 'workouts']);
  for (const [, start, end] of calls) {
    expect(end).toBe(today);
    // 30 days including today: the first is 29 days back.
    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(8);
    expect(start.getDate()).toBe(18);
  }
});

it('listens to workouts and food, and stops when asked', () => {
  const unsubscribe = jest.fn();
  const subscribe = jest.fn(() => ({ unsubscribe }));
  mockWithChanges.mockReturnValue({ subscribe });
  const listener = jest.fn();

  const stop = subscribeToActivityChanges(listener);

  expect(mockWithChanges).toHaveBeenCalledWith(['workout_logs', 'nutrition_logs']);
  expect(subscribe).toHaveBeenCalledWith(listener);
  stop();
  expect(unsubscribe).toHaveBeenCalled();
});
