import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { WorkoutService } from '@/database/services/WorkoutService';
import {
  getNutritionLogHistoryPrompt,
  getRecentWorkoutsPrompt,
  getWorkoutLogHistoryPrompt,
} from '@/utils/coachPromptHistory';
import { differenceInCalendarDays, startOfDay } from 'date-fns';

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { getNutritionLogsForDateRange: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getNutritionLogHistoryDays: jest.fn(),
    getUnits: jest.fn(),
    getWorkoutHistoryDays: jest.fn(),
  },
}));

jest.mock('@/database/services/WorkoutService', () => ({
  WorkoutService: { getWorkoutHistory: jest.fn(), getWorkoutWithDetails: jest.fn() },
}));

const mockGetNutritionLogHistoryDays =
  SettingsService.getNutritionLogHistoryDays as jest.MockedFunction<any>;
const mockGetWorkoutHistoryDays = SettingsService.getWorkoutHistoryDays as jest.MockedFunction<any>;
const mockGetUnits = SettingsService.getUnits as jest.MockedFunction<any>;
const mockGetNutritionLogs =
  NutritionService.getNutritionLogsForDateRange as jest.MockedFunction<any>;
const mockGetWorkoutHistory = WorkoutService.getWorkoutHistory as jest.MockedFunction<any>;
const mockGetWorkoutWithDetails = WorkoutService.getWorkoutWithDetails as jest.MockedFunction<any>;

/** Local noon on the given local calendar day, so the day key is unambiguous. */
const localNoon = (year: number, month: number, day: number, hour = 12, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

type LogOverrides = {
  id?: string;
  date: number;
  groupId?: string | null;
  loggedMealName?: string | null;
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

const nutritionLog = (o: LogOverrides) => ({
  id: o.id ?? `log-${o.date}`,
  date: o.date,
  timezone: undefined,
  groupId: o.groupId ?? null,
  loggedMealName: o.loggedMealName ?? null,
  getDisplayName: jest.fn(async () => o.name ?? 'Food'),
  getNutrients: jest.fn(async () => ({
    calories: o.calories ?? 100,
    protein: o.protein ?? 10,
    carbs: o.carbs ?? 20,
    fat: o.fat ?? 5,
  })),
});

/** Parse the ```json block back out of the returned prompt. */
const parsePromptJson = (prompt: string) => {
  const lines = prompt.split('\n');
  return JSON.parse(lines[lines.indexOf('```json') + 1]);
};

/** The workout block after its one-line header: day headings and `- ` / indented lines. */
const workoutBody = (prompt: string) => prompt.split('\n').slice(1);

const DATE_HEADING = /^\d{4}-\d{2}-\d{2} (Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/;

describe('coachPromptHistory', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('getNutritionLogHistoryPrompt', () => {
    // The whole point of the setting is data minimisation: 'none' must short-circuit before any
    // query runs, so nothing about the user's diary is even read.
    it("returns '' without querying when the setting is 'none'", async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('none');

      await expect(getNutritionLogHistoryPrompt()).resolves.toBe('');
      expect(mockGetNutritionLogs).not.toHaveBeenCalled();
    });

    it("returns '' without querying for an unparseable or non-positive day count", async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('nonsense');
      await expect(getNutritionLogHistoryPrompt()).resolves.toBe('');

      mockGetNutritionLogHistoryDays.mockResolvedValue('0');
      await expect(getNutritionLogHistoryPrompt()).resolves.toBe('');

      expect(mockGetNutritionLogs).not.toHaveBeenCalled();
    });

    it("returns '' when there is no nutrition history in range", async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([]);

      await expect(getNutritionLogHistoryPrompt()).resolves.toBe('');
    });

    it('queries a range covering the configured number of days, inclusive of today', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([]);

      await getNutritionLogHistoryPrompt();

      const [startDate, endDate] = mockGetNutritionLogs.mock.calls[0];
      // 7 days inclusive => start is 6 calendar days back.
      expect(differenceInCalendarDays(endDate, startDate)).toBe(6);
      expect(startDate.getTime()).toBe(startOfDay(startDate).getTime());
    });

    it('groups entries by day (oldest day first) and orders each day oldest-first', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([
        nutritionLog({ id: 'a', date: localNoon(2026, 5, 20, 8), name: 'Oats' }),
        nutritionLog({ id: 'b', date: localNoon(2026, 5, 20, 19), name: 'Steak' }),
        nutritionLog({ id: 'c', date: localNoon(2026, 5, 19, 13), name: 'Salad' }),
      ]);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());

      expect(Object.keys(grouped)).toEqual(['2026-05-19 Tue', '2026-05-20 Wed']);
      expect(grouped['2026-05-20 Wed'].map((e: any) => e.name)).toEqual(['Oats', 'Steak']);
      expect(grouped['2026-05-20 Wed'][0].time).toBe('08:00');
      expect(grouped['2026-05-20 Wed'][1].time).toBe('19:00');
    });

    it('rounds macros and labels them with the compact kcal/p/c/f keys', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([
        nutritionLog({
          date: localNoon(2026, 5, 20, 8),
          name: 'Oats',
          calories: 350.4,
          protein: 12.6,
          carbs: 60.2,
          fat: 7.8,
        }),
      ]);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());

      expect(grouped['2026-05-20 Wed'][0]).toEqual({
        name: 'Oats',
        kcal: 350,
        p: '13g',
        c: '60g',
        f: '8g',
        time: '08:00',
      });
    });

    // The diary shows a saved/AI meal as one row; sending its ingredients individually would both
    // bloat the prompt and misrepresent what the user sees.
    it('merges same-day entries sharing a group_id into one item with summed macros', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([
        nutritionLog({
          id: 'i1',
          date: localNoon(2026, 5, 20, 12, 30),
          groupId: 'g1',
          loggedMealName: 'Chicken Bowl',
          calories: 300,
          protein: 30,
          carbs: 20,
          fat: 10,
        }),
        nutritionLog({
          id: 'i2',
          date: localNoon(2026, 5, 20, 12, 0),
          groupId: 'g1',
          loggedMealName: 'Chicken Bowl',
          calories: 200,
          protein: 10,
          carbs: 40,
          fat: 5,
        }),
      ]);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());

      expect(grouped['2026-05-20 Wed']).toHaveLength(1);
      expect(grouped['2026-05-20 Wed'][0]).toEqual({
        name: 'Chicken Bowl',
        kcal: 500,
        p: '40g',
        c: '60g',
        f: '15g',
        // The earliest timestamp in the group wins, so the meal is shown when it started.
        time: '12:00',
      });
    });

    it('does not merge the same group_id across two different days', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([
        nutritionLog({
          id: 'i1',
          date: localNoon(2026, 5, 20),
          groupId: 'g1',
          loggedMealName: 'M',
        }),
        nutritionLog({
          id: 'i2',
          date: localNoon(2026, 5, 19),
          groupId: 'g1',
          loggedMealName: 'M',
        }),
      ]);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());

      expect(grouped['2026-05-19 Tue']).toHaveLength(1);
      expect(grouped['2026-05-20 Wed']).toHaveLength(1);
    });

    it('falls back to the log display name when a grouped meal has no stored meal name', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      const log = nutritionLog({
        date: localNoon(2026, 5, 20),
        groupId: 'g1',
        loggedMealName: null,
        name: 'Rice',
      });
      mockGetNutritionLogs.mockResolvedValue([log]);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());

      expect(grouped['2026-05-20 Wed'][0].name).toBe('Rice');
      expect(log.getDisplayName).toHaveBeenCalled();
    });

    // Hard cap of 250 buckets keeps the prompt bounded for heavy loggers, and because the source
    // list is walked newest-first it is the *oldest* entries that get dropped.
    it('caps the prompt at 250 entries, keeping the newest', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('30');
      const logs = Array.from({ length: 300 }, (_, i) =>
        nutritionLog({ id: `log-${i}`, date: localNoon(2026, 5, 20, 0, i), name: `Food ${i}` })
      );
      mockGetNutritionLogs.mockResolvedValue(logs);

      const grouped = parsePromptJson(await getNutritionLogHistoryPrompt());
      const items = Object.values(grouped).flat() as any[];

      expect(items).toHaveLength(250);
      expect(items.some((e) => e.name === 'Food 299')).toBe(true);
      expect(items.some((e) => e.name === 'Food 0')).toBe(false);
    });

    it('explains the carbs convention and the time format in the prompt preamble', async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockResolvedValue([nutritionLog({ date: localNoon(2026, 5, 20) })]);

      const prompt = await getNutritionLogHistoryPrompt();

      expect(prompt).toContain('YYYY-MM-DD Ddd, oldest first');
      expect(prompt).toContain('c=carbs (includes fiber)');
      expect(prompt).toContain('24h local time logged');
      expect(prompt).toContain('```json');
    });

    // Prompt assembly must never take the coach down: a failed history read degrades to
    // "no history" rather than an error the user sees.
    it("returns '' when the query throws", async () => {
      mockGetNutritionLogHistoryDays.mockResolvedValue('7');
      mockGetNutritionLogs.mockRejectedValue(new Error('db down'));

      await expect(getNutritionLogHistoryPrompt()).resolves.toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('getWorkoutLogHistoryPrompt', () => {
    const workoutDetails = (overrides: Record<string, any> = {}) => ({
      workoutLog: {
        workoutName: 'Push Day',
        startedAt: localNoon(2026, 5, 20, 9),
        completedAt: localNoon(2026, 5, 20, 10),
        totalVolume: 5000,
        ...overrides.workoutLog,
      },
      sets: (
        overrides.sets ?? [
          { exerciseId: 'ex-1', weight: 100, reps: 5 },
          { exerciseId: 'ex-1', weight: 100, reps: 4 },
          { exerciseId: 'ex-2', weight: 40, reps: 12 },
        ]
      ).map((set: Record<string, unknown>) => ({
        completionStatus: 'performed',
        difficultyLevel: 5,
        ...set,
      })),
      exercises: overrides.exercises ?? [
        { id: 'ex-1', name: 'Bench Press' },
        { id: 'ex-2', name: 'Lateral Raise' },
      ],
    });

    it("returns '' without querying when the setting is 'none'", async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('none');

      await expect(getWorkoutLogHistoryPrompt()).resolves.toBe('');
      expect(mockGetWorkoutHistory).not.toHaveBeenCalled();
    });

    it("returns '' for an unparseable or non-positive day count", async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('abc');
      await expect(getWorkoutLogHistoryPrompt()).resolves.toBe('');

      expect(mockGetWorkoutHistory).not.toHaveBeenCalled();
    });

    it("returns '' when there is no workout history in range", async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([]);

      await expect(getWorkoutLogHistoryPrompt()).resolves.toBe('');
    });

    it('caps the query at 60 workouts regardless of the configured day range', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('365');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([]);

      await getWorkoutLogHistoryPrompt();

      expect(mockGetWorkoutHistory).toHaveBeenCalledWith(expect.any(Object), 60);
    });

    it('groups sets under their exercise name and reports duration and volume', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(workoutDetails());

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(workoutBody(prompt)).toEqual([
        '2026-05-20 Wed',
        '- Push Day, 60min, volume 5000kg',
        '  Bench Press: 100kg x5, 100kg x4',
        '  Lateral Raise: 40kg x12',
      ]);
    });

    it('does not tell the coach that skipped sets were performed', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(
        workoutDetails({
          sets: [
            { exerciseId: 'ex-1', weight: 100, reps: 5 },
            {
              exerciseId: 'ex-2',
              weight: 40,
              reps: 12,
              completionStatus: 'skipped',
              difficultyLevel: undefined,
            },
          ],
        })
      );

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(workoutBody(prompt)).toEqual([
        '2026-05-20 Wed',
        '- Push Day, 60min, volume 5000kg',
        '  Bench Press: 100kg x5',
      ]);
    });

    // Weights must be shown in the unit the user actually thinks in, or the coach's advice
    // ("add 5") lands in the wrong system.
    it('formats weights in the user’s unit and says so in the preamble', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('imperial');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(
        workoutDetails({ sets: [{ exerciseId: 'ex-1', weight: 100, reps: 5 }] })
      );

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(prompt).toContain('preferred unit (lbs)');
      expect(workoutBody(prompt)).toContain('  Bench Press: 220.5lbs x5');
      expect(workoutBody(prompt)).toContain('- Push Day, 60min, volume 11023.1lbs');
    });

    it('reports a zero duration for a workout that was never completed', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(
        workoutDetails({ workoutLog: { completedAt: null } })
      );

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(workoutBody(prompt)).toContain('- Push Day, 0min, volume 5000kg');
    });

    it('drops sets whose exercise is missing, and the whole workout when none resolve', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(
        workoutDetails({
          sets: [{ exerciseId: 'deleted-exercise', weight: 50, reps: 5 }],
          exercises: [],
        })
      );

      await expect(getWorkoutLogHistoryPrompt()).resolves.toBe('');
    });

    // One corrupt workout must not cost the coach the rest of the user's training history.
    it('skips a workout whose details fail to load but keeps the others', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
      mockGetWorkoutWithDetails.mockImplementation(async (id: string) => {
        if (id === 'w1') {
          throw new Error('missing rows');
        }
        return workoutDetails();
      });

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(workoutBody(prompt).filter((line) => line.startsWith('- '))).toHaveLength(1);
    });

    it('groups multiple workouts recorded on the same day under one day heading', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }, { id: 'w2' }]);
      mockGetWorkoutWithDetails.mockImplementation(async (id: string) =>
        workoutDetails({ workoutLog: { workoutName: id === 'w1' ? 'AM' : 'PM' } })
      );

      const prompt = await getWorkoutLogHistoryPrompt();
      const body = workoutBody(prompt);

      expect(body.filter((line) => !line.startsWith(' ') && !line.startsWith('- '))).toEqual([
        '2026-05-20 Wed',
      ]);
      expect(
        body.filter((line) => line.startsWith('- ')).map((line) => line.split(',')[0])
      ).toEqual(['- PM', '- AM']);
    });

    it('uses a YYYY-MM-DD Ddd heading for every day and no JSON fence', async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'w1' }]);
      mockGetWorkoutWithDetails.mockResolvedValue(workoutDetails());

      const prompt = await getWorkoutLogHistoryPrompt();

      expect(prompt).not.toContain('```');
      expect(prompt).toContain('oldest first');
      const headings = workoutBody(prompt).filter(
        (line) => !line.startsWith(' ') && !line.startsWith('- ')
      );
      expect(headings).toHaveLength(1);
      expect(headings[0]).toMatch(DATE_HEADING);
      expect(headings[0]).toBe('2026-05-20 Wed');
    });

    it('lists the most recent workouts oldest first through getRecentWorkoutsPrompt', async () => {
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([{ id: 'new' }, { id: 'old' }]);
      mockGetWorkoutWithDetails.mockImplementation(async (id: string) =>
        workoutDetails({
          workoutLog: {
            workoutName: id === 'new' ? 'Pull Day' : 'Push Day',
            startedAt: localNoon(2026, id === 'new' ? 5 : 4, 22, 9),
          },
        })
      );

      const prompt = await getRecentWorkoutsPrompt(2);

      expect(mockGetWorkoutHistory).toHaveBeenCalledWith(undefined, 2);
      expect(prompt.split('\n')[0]).toContain("The user's most recent workouts, oldest first.");
      expect(prompt).toContain('preferred unit (kg)');
      expect(
        workoutBody(prompt)
          .filter((line) => line.startsWith('- '))
          .map((line) => line.split(',')[0])
      ).toEqual(['- Push Day', '- Pull Day']);
      expect(workoutBody(prompt)[0]).toBe('2026-04-22 Wed');
    });

    it("getRecentWorkoutsPrompt returns '' when there are no workouts or the read fails", async () => {
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockResolvedValue([]);
      await expect(getRecentWorkoutsPrompt(5)).resolves.toBe('');

      mockGetWorkoutHistory.mockRejectedValue(new Error('db down'));
      await expect(getRecentWorkoutsPrompt(5)).resolves.toBe('');
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it("returns '' when the history query throws", async () => {
      mockGetWorkoutHistoryDays.mockResolvedValue('30');
      mockGetUnits.mockResolvedValue('metric');
      mockGetWorkoutHistory.mockRejectedValue(new Error('db down'));

      await expect(getWorkoutLogHistoryPrompt()).resolves.toBe('');
    });
  });
});
