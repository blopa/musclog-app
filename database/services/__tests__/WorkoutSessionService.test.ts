import { WorkoutSessionService } from '@/database/services/WorkoutSessionService';
import { kgToDisplay } from '@/utils/unitConversion';

const mockRecords: Record<string, any> = {};
let mockSiblings: any[] = [];
let mockUnits: 'metric' | 'imperial' = 'metric';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    sortBy: jest.fn(),
    asc: 'asc',
  },
}));

jest.mock('@/database/database-instance', () => ({
  database: {
    get: jest.fn((table: string) => ({
      find: jest.fn(async (id: string) => mockRecords[`${table}:${id}`]),
      query: jest.fn(() => ({ fetch: jest.fn(async () => mockSiblings) })),
    })),
    write: jest.fn((callback: () => unknown) => Promise.resolve(callback())),
    batch: jest.fn().mockResolvedValue(undefined),
  },
}));

const mockAutonomy = jest.fn();
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getProgressionMode: jest.fn(async () => 'weight_first'),
    get: jest.fn(async (setting: { type: string; defaultValue: unknown }) =>
      setting.type === 'workout_autonomy' ? mockAutonomy() : setting.defaultValue
    ),
  },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getUserBodyWeightKgForVolume: jest.fn(async () => 70) },
}));
let mockGym: any = null;
jest.mock('@/database/services/GymService', () => ({
  GymService: { getActiveGym: jest.fn(async () => mockGym) },
}));
jest.mock('@/database/services/ExerciseUserSettingsService', () => ({
  ExerciseUserSettingsService: { getWeightUnitsResolver: jest.fn(async () => () => mockUnits) },
}));

const row = (id: string, setOrder: number, status: string, extra: Record<string, unknown> = {}) => {
  const record: any = {
    id,
    setOrder,
    logExerciseId: 'le-1',
    completionStatus: status,
    setType: 'normal',
    weight: 77,
    reps: 6,
    repsInReserve: 2,
    deletedAt: null,
    ...extra,
  };
  record.prepareUpdate = jest.fn((updater: (draft: any) => void) => {
    updater(record);
    return record;
  });
  return record;
};

function install(sets: any[], equipmentType = 'barbell', mechanicType?: string) {
  mockSiblings = sets;
  for (const key of Object.keys(mockRecords)) {
    delete mockRecords[key];
  }
  for (const set of sets) {
    mockRecords[`workout_log_sets:${set.id}`] = set;
  }
  mockRecords['workout_logs:log-1'] = {
    id: 'log-1',
    completedAt: null,
    deletedAt: null,
    prepareUpdate: jest.fn((updater: (draft: any) => void) => {
      updater({});
      return {};
    }),
  };
  mockRecords['workout_log_exercises:le-1'] = {
    id: 'le-1',
    exerciseId: 'ex-1',
    workoutLogId: 'log-1',
    progressionJson: undefined,
  };
  mockRecords['exercises:ex-1'] = { id: 'ex-1', equipmentType, mechanicType };
}

const performed = { weight: 77, reps: 10, repsInReserve: 0 };

describe('WorkoutSessionService.saveSet re-targeting', () => {
  beforeEach(() => {
    mockGym = null;
    mockUnits = 'metric';
    mockAutonomy.mockResolvedValue('suggest');
  });

  it('persists the next set re-targeted from the one just performed, with its explanation', async () => {
    const [first, second] = [row('s1', 1, 'planned'), row('s2', 2, 'planned')];
    install([first, second]);

    await WorkoutSessionService.saveSet('log-1', 's1', 'performed', performed);

    expect(first.completionStatus).toBe('performed');
    expect(Number.isInteger(second.weight)).toBe(true);
    expect(JSON.parse(second.prescriptionJson)).toMatchObject({
      established: true,
      intraAdjustment: { cause: 'target_rir', field: 'weight' },
    });
  });

  it.each(['stretching', 'mobility', 'cardio'])(
    'does not re-target the next set of a %s exercise',
    async (mechanicType) => {
      const [first, second] = [
        row('s1', 1, 'planned', { weight: 0, reps: 10 }),
        row('s2', 2, 'planned', { weight: 0, reps: 10 }),
      ];
      install([first, second], 'bodyweight', mechanicType);

      await WorkoutSessionService.saveSet('log-1', 's1', 'performed', {
        weight: 0,
        reps: 10,
        repsInReserve: 0,
      });

      expect(first.completionStatus).toBe('performed');
      expect(second).toMatchObject({ weight: 0, reps: 10 });
      expect(second.prescriptionJson).toBeUndefined();
    }
  );

  it('changes nothing on the next set in manual mode', async () => {
    mockAutonomy.mockResolvedValue('manual');
    const [first, second] = [row('s1', 1, 'planned'), row('s2', 2, 'planned')];
    install([first, second]);

    await WorkoutSessionService.saveSet('log-1', 's1', 'performed', performed);

    expect(first.completionStatus).toBe('performed');
    expect(second).toMatchObject({ weight: 77, reps: 6 });
    expect(second.prescriptionJson).toBeUndefined();
  });

  it('rounds to whole pounds when the exercise is shown in pounds', async () => {
    mockUnits = 'imperial';
    const [first, second] = [row('s1', 1, 'planned'), row('s2', 2, 'planned')];
    install([first, second]);

    await WorkoutSessionService.saveSet('log-1', 's1', 'performed', performed);

    const shown = kgToDisplay(second.weight, 'imperial');
    expect(shown).toBeCloseTo(Math.round(shown), 6);
    expect(Number.isInteger(second.weight)).toBe(false);
  });

  it('snaps to a load the active gym can build', async () => {
    mockGym = {
      id: 'gym-1',
      barWeightKg: 20,
      plates: [
        { weightKg: 20, count: 20 },
        { weightKg: 10, count: 20 },
        { weightKg: 5, count: 20 },
        { weightKg: 2.5, count: 20 },
        { weightKg: 1.25, count: 20 },
      ],
      weightIncrementKg: 2.5,
      equipment: ['barbell'],
    };
    const [first, second] = [row('s1', 1, 'planned'), row('s2', 2, 'planned')];
    install([first, second]);

    await WorkoutSessionService.saveSet('log-1', 's1', 'performed', performed);

    expect(second.weight % 2.5).toBe(0);
  });

  it('does not re-target a working set from a warm-up', async () => {
    const warm = row('w', 1, 'planned', { setType: 'warmup', weight: 40, reps: 8 });
    const work = row('s2', 2, 'planned', { weight: 100, reps: 5 });
    install([warm, work]);

    await WorkoutSessionService.saveSet('log-1', 'w', 'performed', {
      weight: 40,
      reps: 8,
      repsInReserve: 4,
    });

    expect(work).toMatchObject({ weight: 100, reps: 5 });
  });

  it('re-targets the next set when a set in between is skipped', async () => {
    const [first, second, third] = [
      row('s1', 1, 'performed', performed),
      row('s2', 2, 'planned'),
      row('s3', 3, 'planned'),
    ];
    install([first, second, third]);

    await WorkoutSessionService.saveSet('log-1', 's2', 'skipped');

    expect(second.completionStatus).toBe('skipped');
    expect(JSON.parse(third.prescriptionJson)).toMatchObject({
      intraAdjustment: { cause: 'target_rir' },
    });
  });
});
