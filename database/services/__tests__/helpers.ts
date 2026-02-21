export function createMockDatabase() {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn().mockReturnThis(),
  };

  const mockCollection = {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({}),
    prepareCreate: jest.fn().mockReturnValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };

  const mockWriter = {} as any; // Mock writer interface

  return {
    get: jest.fn().mockReturnValue(mockCollection),
    write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
    batch: jest.fn().mockResolvedValue(undefined),
    collections: {
      get: jest.fn().mockReturnValue(mockCollection),
    },
  };
}

/**
 * Creates a mock Setting model
 */
export function createMockSetting(overrides: Partial<any> = {}) {
  return {
    id: 'setting-1',
    type: 'test_type',
    value: 'test_value',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ value: '', updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock User model
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    fullName: 'Test User',
    email: 'test@example.com',
    dateOfBirth: Date.now() - 30 * 365 * 24 * 60 * 60 * 1000, // 30 years ago
    gender: 'male' as const,
    fitnessGoal: 'hypertrophy',
    weightGoal: 'maintain',
    activityLevel: 3,
    liftingExperience: 'intermediate' as const,
    syncId: 'sync-123',
    externalAccountId: undefined,
    externalAccountProvider: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    updateProfile: jest.fn().mockResolvedValue(undefined),
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock NutritionGoal model
 */
export function createMockNutritionGoal(overrides: Partial<any> = {}) {
  return {
    id: 'goal-1',
    totalCalories: 2000,
    protein: 150,
    carbs: 200,
    fats: 65,
    fiber: 30,
    eatingPhase: 'maintain' as const,
    targetWeight: 75,
    targetBodyFat: 15,
    targetBmi: 23,
    targetFfmi: 20,
    targetDate: null,
    effectiveUntil: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock Exercise model
 */
export function createMockExercise(overrides: Partial<any> = {}) {
  return {
    id: 'exercise-1',
    name: 'Bench Press',
    description: 'Chest exercise',
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    mechanicType: 'compound',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    ...overrides,
  };
}

/**
 * Creates a mock WorkoutLog model
 */
export function createMockWorkoutLog(overrides: Partial<any> = {}) {
  const mockLogSetsQuery = {
    fetch: jest.fn().mockResolvedValue([]),
  };

  return {
    id: 'workout-1',
    templateId: 'template-1',
    workoutName: 'Test Workout',
    startedAt: Date.now(),
    completedAt: null,
    totalVolume: 0,
    caloriesBurned: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    logSets: mockLogSetsQuery,
    completeWorkout: jest.fn().mockResolvedValue(undefined),
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock WorkoutLogSet model
 */
export function createMockWorkoutLogSet(overrides: Partial<any> = {}) {
  return {
    id: 'set-1',
    workoutLogId: 'workout-1',
    exerciseId: 'exercise-1',
    reps: 10,
    weight: 100,
    partials: 0,
    restTimeAfter: 60,
    difficultyLevel: 5,
    isDropSet: false,
    groupId: undefined,
    setOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock WorkoutTemplate model
 */
export function createMockWorkoutTemplate(overrides: Partial<any> = {}) {
  const mockTemplateSetsQuery = {
    fetch: jest.fn().mockResolvedValue([]),
  };

  return {
    id: 'template-1',
    name: 'Test Template',
    description: 'Test Description',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    templateSets: mockTemplateSetsQuery,
    startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock WorkoutTemplateSet model
 */
export function createMockWorkoutTemplateSet(overrides: Partial<any> = {}) {
  return {
    id: 'template-set-1',
    templateId: 'template-1',
    exerciseId: 'exercise-1',
    targetReps: 10,
    targetWeight: 100,
    setOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock Schedule model
 */
export function createMockSchedule(overrides: Partial<any> = {}) {
  return {
    id: 'schedule-1',
    templateId: 'template-1',
    dayOfWeek: 'Monday',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Mock Q query builder
 */
export const mockQ = {
  where: jest.fn((field: string, condition: any) => ({ field, condition })),
  eq: jest.fn((value: any) => value),
  notEq: jest.fn((value: any) => value),
  gte: jest.fn((value: any) => value),
  lte: jest.fn((value: any) => value),
  oneOf: jest.fn((values: any[]) => values),
  sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
  take: jest.fn((count: number) => count),
  skip: jest.fn((count: number) => count),
  desc: 'desc' as const,
  asc: 'asc' as const,
};
