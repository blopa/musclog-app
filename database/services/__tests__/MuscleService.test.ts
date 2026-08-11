import { MuscleService } from '@/database/services/MuscleService';

jest.mock('@/data/exercisesData.json', () => [
  {
    __exerciseName: 'Bench Press',
    __freeExerciseDbId: 'Bench_Press',
    exerciseIndex: 1,
    targetMuscles: ['pectoralis_major'],
  },
  {
    __exerciseName: 'Squat',
    __freeExerciseDbId: 'Squat',
    exerciseIndex: 2,
    targetMuscles: ['quadriceps'],
  },
]);

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

jest.mock('@/database/models/Exercise', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/ExerciseMuscle', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/Muscle', () => ({ __esModule: true, default: class {} }));

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ condition, field })),
    eq: jest.fn((value: unknown) => value),
  },
}));

jest.mock('../../database-instance', () => {
  const exercises = [
    { id: 'fx-Bench_Press', name: 'My renamed press', source: 'app' },
    { id: 'user-bench', name: 'Bench Press', source: 'user' },
    { id: 'user-other', name: 'Custom movement', source: 'user' },
    { id: 'fx-Squat', name: 'Squat', source: 'app' },
  ];
  const links = [{ exerciseId: 'fx-Squat', deletedAt: null }];
  const prepared: any[] = [];

  const database = {
    get: jest.fn((table: string) => ({
      query: jest.fn(() => ({
        fetch: jest.fn(async () => (table === 'exercises' ? exercises : links)),
      })),
      prepareCreate: jest.fn((callback: (record: any) => void) => {
        const record: any = {};
        callback(record);
        prepared.push(record);
        return record;
      }),
    })),
    write: jest.fn(async (callback: () => Promise<void>) => callback()),
    batch: jest.fn(async () => undefined),
  };

  return { database, mockPreparedMuscleLinks: prepared };
});

const { mockPreparedMuscleLinks } = jest.requireMock('../../database-instance') as {
  mockPreparedMuscleLinks: any[];
};

describe('MuscleService.backfillExerciseMuscles', () => {
  beforeEach(() => {
    mockPreparedMuscleLinks.length = 0;
    jest.clearAllMocks();
  });

  it('keys app rows by slug and only falls back to names for user exercises', async () => {
    await MuscleService.backfillExerciseMuscles(
      new Map([
        ['pectoralis_major', 'muscle-chest'],
        ['quadriceps', 'muscle-quads'],
      ])
    );

    expect(mockPreparedMuscleLinks).toEqual([
      expect.objectContaining({ exerciseId: 'fx-Bench_Press', muscleId: 'muscle-chest' }),
      expect.objectContaining({ exerciseId: 'user-bench', muscleId: 'muscle-chest' }),
    ]);
  });
});
