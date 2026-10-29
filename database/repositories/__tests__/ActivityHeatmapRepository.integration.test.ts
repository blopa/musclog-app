import { firstValueFrom } from 'rxjs';

import { database } from '@/database/database-instance';
import type NutritionLog from '@/database/models/NutritionLog';
import type WorkoutLog from '@/database/models/WorkoutLog';
import { ActivityHeatmapRepository } from '@/database/repositories/ActivityHeatmapRepository';

jest.mock('@/database/adapter', () => {
  const Loki = jest.requireActual('@nozbe/watermelondb/adapters/lokijs').default;

  return {
    __esModule: true,
    default: new Loki({
      schema: jest.requireActual('@/database/schema').schema,
      migrations: jest.requireActual('@/database/migrations').migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
      _testLokiAdapter: new (require('lokijs').LokiMemoryAdapter)(),
    }),
  };
});

const day = (dayOfMonth: number, hour = 12) => new Date(2026, 9, dayOfMonth, hour).getTime();
const START = new Date(2026, 9, 5);
const END = new Date(2026, 9, 18);

async function addWorkout(
  startedAt: number,
  extra: { completed?: boolean; deleted?: boolean } = {}
) {
  await database.write(async () => {
    await database.get<WorkoutLog>('workout_logs').create((record) => {
      Object.assign(record._raw, {
        started_at: startedAt,
        completed_at: extra.completed === false ? null : startedAt + 3_600_000,
        deleted_at: extra.deleted ? startedAt : null,
      });
    });
  });
}

async function addFood(
  date: number,
  type: string,
  extra: { timezone?: string; deleted?: boolean } = {}
) {
  await database.write(async () => {
    await database.get<NutritionLog>('nutrition_logs').create((record) => {
      Object.assign(record._raw, {
        date,
        type,
        timezone: extra.timezone ?? null,
        deleted_at: extra.deleted ? date : null,
      });
    });
  });
}

beforeEach(async () => {
  await database.write(async () => {
    await database.unsafeResetDatabase();
  });
});

describe('ActivityHeatmapRepository.observeWorkoutDays', () => {
  it('counts completed, live workouts inside the window by the day they started', async () => {
    await addWorkout(day(8, 7));
    await addWorkout(day(8, 18));
    await addWorkout(day(10));
    await addWorkout(day(11), { completed: false });
    await addWorkout(day(12), { deleted: true });
    await addWorkout(day(1)); // before the window
    await addWorkout(day(25)); // after it

    const days = await firstValueFrom(ActivityHeatmapRepository.observeWorkoutDays(START, END));

    expect(Object.fromEntries(days.map((d) => [d.date, d.value]))).toEqual({
      '2026-10-08': 2,
      '2026-10-10': 1,
    });
  });

  it('includes a workout on the last day however late it started', async () => {
    await addWorkout(new Date(2026, 9, 18, 23, 50).getTime());

    const days = await firstValueFrom(ActivityHeatmapRepository.observeWorkoutDays(START, END));

    expect(days).toEqual([{ date: '2026-10-18', value: 1 }]);
  });

  it('emits again when a workout is finished', async () => {
    const seen: number[] = [];
    const subscription = ActivityHeatmapRepository.observeWorkoutDays(START, END).subscribe(
      (days) => seen.push(days.length)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    await addWorkout(day(9));
    await new Promise((resolve) => setTimeout(resolve, 20));
    subscription.unsubscribe();

    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(1);
  });
});

describe('ActivityHeatmapRepository.observeMealDays', () => {
  it('values a day by its distinct meal types and skips deleted logs', async () => {
    await addFood(day(8, 8), 'breakfast');
    await addFood(day(8, 13), 'lunch');
    await addFood(day(8, 13), 'lunch');
    await addFood(day(9, 20), 'dinner');
    await addFood(day(9, 21), 'snack', { deleted: true });

    const days = await firstValueFrom(ActivityHeatmapRepository.observeMealDays(START, END));

    expect(Object.fromEntries(days.map((d) => [d.date, d.value]))).toEqual({
      '2026-10-08': 2,
      '2026-10-09': 1,
    });
  });

  it('keeps a log on the calendar day it was recorded in, whatever the device timezone', async () => {
    // 23:30 on the 8th in UTC-05:00 is already the 9th in UTC.
    await addFood(Date.UTC(2026, 9, 9, 4, 30), 'dinner', { timezone: '-05:00' });

    const days = await firstValueFrom(ActivityHeatmapRepository.observeMealDays(START, END));

    expect(days).toEqual([{ date: '2026-10-08', value: 1 }]);
  });

  it('drops logs outside the window even when the timezone buffer fetched them', async () => {
    await addFood(day(4, 23), 'dinner');
    await addFood(day(19, 1), 'breakfast');

    expect(await firstValueFrom(ActivityHeatmapRepository.observeMealDays(START, END))).toEqual([]);
  });

  it('re-emits when a log changes meal type in place', async () => {
    await addFood(day(8, 12), 'lunch');
    await addFood(day(8, 13), 'lunch');
    const seen: number[] = [];
    const subscription = ActivityHeatmapRepository.observeMealDays(START, END).subscribe((days) =>
      seen.push(days[0]?.value ?? 0)
    );
    await new Promise((resolve) => setTimeout(resolve, 20));

    await database.write(async () => {
      const [first] = await database.get<NutritionLog>('nutrition_logs').query().fetch();
      await first.update((record) => {
        record.type = 'dinner';
      });
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    subscription.unsubscribe();

    expect(seen[0]).toBe(1);
    expect(seen[seen.length - 1]).toBe(2);
  });
});

describe('ActivityHeatmapRepository.fetchWorkoutDays / fetchMealDays', () => {
  it('reads the same days the live queries emit, once', async () => {
    await addWorkout(day(8, 7));
    await addWorkout(day(8, 18));
    await addWorkout(day(11), { completed: false });
    await addWorkout(day(12), { deleted: true });
    await addFood(day(8, 8), 'breakfast');
    await addFood(day(8, 13), 'lunch');
    await addFood(day(8, 14), 'lunch');
    await addFood(day(9, 21), 'snack', { deleted: true });
    await addFood(day(19, 1), 'breakfast'); // inside the timezone buffer, outside the window

    const fetched = {
      workouts: await ActivityHeatmapRepository.fetchWorkoutDays(START, END),
      meals: await ActivityHeatmapRepository.fetchMealDays(START, END),
    };

    expect(fetched.workouts).toEqual([{ date: '2026-10-08', value: 2 }]);
    expect(fetched.meals).toEqual([{ date: '2026-10-08', value: 2 }]);
    expect(fetched.workouts).toEqual(
      await firstValueFrom(ActivityHeatmapRepository.observeWorkoutDays(START, END))
    );
    expect(fetched.meals).toEqual(
      await firstValueFrom(ActivityHeatmapRepository.observeMealDays(START, END))
    );
  });
});
