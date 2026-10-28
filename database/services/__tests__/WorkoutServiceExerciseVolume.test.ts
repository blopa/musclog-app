import { database } from '@/database/database-instance';
import { fetchByIds } from '@/database/queryByIds';
import { loadWorkoutEnergyProfile } from '@/database/services/workoutEnergyProfile';
import { UserMetricService } from '@/database/services/UserMetricService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { calculateExerciseVolume } from '@/utils/workoutCalculator';

import { createMockWorkoutLog, createMockWorkoutLogSet } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
  },
}));
jest.mock('../../index', () => require('../../database-instance'));
jest.mock('../../database-instance', () => ({ database: { get: jest.fn() } }));
jest.mock('@/database/queryByIds', () => ({ fetchByIds: jest.fn(), fetchMapByIds: jest.fn() }));
jest.mock('@/database/services/workoutEnergyProfile', () => ({
  loadWorkoutEnergyProfile: jest.fn(),
}));
jest.mock('../WorkoutAnalytics', () => ({ WorkoutAnalytics: {} }));
jest.mock('@/utils/activeWorkoutStorage', () => ({}));
jest.mock('../UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn() },
}));
jest.mock('@/services/healthConnectWorkout', () => ({ writeWorkoutToHealthConnect: jest.fn() }));

const find = jest.fn();
const fetchByIdsMock = fetchByIds as jest.Mock;

beforeEach(() => {
  jest.resetAllMocks();
  (database.get as jest.Mock).mockReturnValue({ find });
});

describe('WorkoutService.getExerciseVolumeHistory', () => {
  const exercise = { id: 'ex-1', equipmentType: 'barbell' };
  const logA = createMockWorkoutLog({ id: 'log-a', startedAt: 100, completedAt: 150 });
  const logB = createMockWorkoutLog({ id: 'log-b', startedAt: 200, completedAt: 250 });
  const logExercises = [
    { id: 'le-a', workoutLogId: 'log-a' },
    { id: 'le-b', workoutLogId: 'log-b' },
  ];

  it('is empty for a workout that was not started from a template', async () => {
    find.mockResolvedValue(createMockWorkoutLog({ id: 'log-a', templateId: undefined }));
    const byTemplate = jest.spyOn(WorkoutService, 'getWorkoutLogsByTemplate');

    expect(await WorkoutService.getExerciseVolumeHistory('log-a', 'ex-1')).toEqual([]);
    expect(byTemplate).not.toHaveBeenCalled();
  });

  it('looks at the last sessions of the template up to and including this one', async () => {
    find.mockResolvedValue(
      createMockWorkoutLog({ id: 'log-b', templateId: 'tpl-1', startedAt: 200 })
    );
    const byTemplate = jest.spyOn(WorkoutService, 'getWorkoutLogsByTemplate').mockResolvedValue([]);
    fetchByIdsMock.mockResolvedValue([]);

    await WorkoutService.getExerciseVolumeHistory('log-b', 'ex-1', 7);

    expect(byTemplate).toHaveBeenCalledWith('tpl-1', {
      timeframe: { startDate: 0, endDate: 200 },
      limit: 7,
    });
  });

  it('counts only performed working sets of the exercise, per session', async () => {
    find.mockImplementation(async (id: string) =>
      id === 'ex-1'
        ? exercise
        : createMockWorkoutLog({ id: 'log-b', templateId: 'tpl-1', startedAt: 200 })
    );
    jest.spyOn(WorkoutService, 'getWorkoutLogsByTemplate').mockResolvedValue([logB, logA]);
    (UserMetricService.getUserBodyWeightKgForVolume as jest.Mock).mockResolvedValue(80);
    const working = (id: string, logExerciseId: string, weight: number) =>
      createMockWorkoutLogSet({ id, logExerciseId, weight, reps: 5, repsInReserve: 0 });
    const setsA = [working('a1', 'le-a', 100), working('a2', 'le-a', 100)];
    const setsB = [
      working('b1', 'le-b', 110),
      createMockWorkoutLogSet({
        id: 'b-warm',
        logExerciseId: 'le-b',
        weight: 40,
        setType: 'warmup',
      }),
      createMockWorkoutLogSet({ id: 'b-plan', logExerciseId: 'le-b', completionStatus: 'planned' }),
    ];
    fetchByIdsMock.mockResolvedValueOnce(logExercises).mockResolvedValueOnce([...setsA, ...setsB]);

    const history = await WorkoutService.getExerciseVolumeHistory('log-b', 'ex-1');

    expect(history).toEqual([
      {
        id: 'log-b',
        date: 200,
        volume: calculateExerciseVolume([setsB[0]] as never, exercise, 80),
      },
      { id: 'log-a', date: 100, volume: calculateExerciseVolume(setsA as never, exercise, 80) },
    ]);
  });

  it('leaves out sessions where the exercise has no performed working set', async () => {
    find.mockImplementation(async (id: string) =>
      id === 'ex-1'
        ? exercise
        : createMockWorkoutLog({ id: 'log-b', templateId: 'tpl-1', startedAt: 200 })
    );
    jest.spyOn(WorkoutService, 'getWorkoutLogsByTemplate').mockResolvedValue([logB, logA]);
    (UserMetricService.getUserBodyWeightKgForVolume as jest.Mock).mockResolvedValue(0);
    fetchByIdsMock
      .mockResolvedValueOnce(logExercises)
      .mockResolvedValueOnce([createMockWorkoutLogSet({ id: 'a1', logExerciseId: 'le-a' })]);

    const history = await WorkoutService.getExerciseVolumeHistory('log-b', 'ex-1');

    expect(history.map((entry) => entry.id)).toEqual(['log-a']);
  });
});

describe('WorkoutService.estimateWorkoutKcal', () => {
  const profile = { weightKg: 80, heightCm: 180, gender: 'male' as const };

  it('is 0 without a body to estimate for, and reads nothing else', async () => {
    (loadWorkoutEnergyProfile as jest.Mock).mockResolvedValue(null);
    const details = jest.spyOn(WorkoutService, 'getWorkoutWithDetails');

    expect(await WorkoutService.estimateWorkoutKcal('log-a')).toBe(0);
    expect(details).not.toHaveBeenCalled();
  });

  it('uses a profile it is given instead of loading one', async () => {
    jest.spyOn(WorkoutService, 'getWorkoutWithDetails').mockResolvedValue({
      sets: [],
      exercises: [],
    } as never);

    expect(await WorkoutService.estimateWorkoutKcal('log-a', profile)).toBe(0);
    expect(loadWorkoutEnergyProfile).not.toHaveBeenCalled();
  });
});
