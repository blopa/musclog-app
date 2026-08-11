import { MuscleService } from '@/database/services/MuscleService';

jest.mock('@/data/exercisesData.json', () => [
  {
    __freeExerciseDbId: 'Bench_Press',
    exerciseIndex: 1,
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: ['pectoralis_major'],
    loadMultiplier: 1,
  },
  {
    __freeExerciseDbId: 'Squat',
    exerciseIndex: 2,
    muscleGroup: 'legs',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    targetMuscles: ['quadriceps'],
    loadMultiplier: 1.4,
  },
]);

jest.mock('@/lang/lang', () => ({
  __esModule: true,
  default: { language: 'en-US', t: (key: string) => key },
  EN_US: 'en-US',
  EXERCISES_JSON: {
    'en-US': [
      { exerciseSlug: 'Bench_Press', name: 'Bench Press', description: 'Press' },
      { exerciseSlug: 'Squat', name: 'Squat', description: 'Squat' },
    ],
  },
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
        fetch: jest.fn(async () =>
          table === 'exercises' ? exercises.filter(({ source }) => source === 'user') : links
        ),
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

  it('only falls back to English names for user exercises', async () => {
    await MuscleService.backfillExerciseMuscles(
      new Map([
        ['pectoralis_major', 'muscle-chest'],
        ['quadriceps', 'muscle-quads'],
      ])
    );

    expect(mockPreparedMuscleLinks).toEqual([
      expect.objectContaining({ exerciseId: 'user-bench', muscleId: 'muscle-chest' }),
    ]);
  });
});
