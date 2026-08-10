import { MS_PER_SOLAR_DAY } from '../../../utils/calendarDate';

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
    dateOfBirth: Date.now() - 30 * 365 * MS_PER_SOLAR_DAY, // 30 years ago
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
    isDynamic: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    // `saveGoals` regenerates periodic check-ins, which soft-deletes the stale ones.
    markAsDeleted: jest.fn().mockResolvedValue(undefined),
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
  return {
    id: 'workout-1',
    templateId: 'template-1',
    workoutName: 'Test Workout',
    startedAt: Date.now(),
    completedAt: null,
    totalVolume: 0,
    caloriesBurned: null,
    exhaustionLevel: undefined,
    workoutScore: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    // Sets hang off `workout_log_exercises`, not off the log directly.
    logExercises: { fetch: jest.fn().mockResolvedValue([]) },
    completeWorkout: jest.fn().mockResolvedValue(undefined),
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    ...overrides,
  };
}

/**
 * Creates a mock WorkoutLogExercise model — the join between a workout log and an
 * exercise that every set now belongs to.
 */
export function createMockWorkoutLogExercise(overrides: Partial<any> = {}) {
  const fields = {
    id: 'log-exercise-1',
    workoutLogId: 'workout-1',
    exerciseId: 'exercise-1',
    exerciseOrder: 1,
    groupId: undefined,
    notes: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    ...overrides,
  };

  return {
    ...fields,
    _raw: {
      id: fields.id,
      workout_log_id: fields.workoutLogId,
      exercise_id: fields.exerciseId,
      exercise_order: fields.exerciseOrder,
      group_id: fields.groupId,
      notes: fields.notes,
      created_at: fields.createdAt,
      updated_at: fields.updatedAt,
      deleted_at: fields.deletedAt,
    },
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
  };
}

/**
 * Creates a mock WorkoutLogSet model
 */
export function createMockWorkoutLogSet(overrides: Partial<any> = {}) {
  const fields = {
    id: 'set-1',
    logExerciseId: 'log-exercise-1',
    workoutLogId: 'workout-1',
    exerciseId: 'exercise-1',
    reps: 10,
    weight: 100,
    partials: 0,
    restTimeAfter: 60,
    repsInReserve: 0,
    isSkipped: false,
    difficultyLevel: 5,
    setType: 'normal',
    groupId: undefined,
    setOrder: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    ...overrides,
  };

  return {
    ...fields,
    // Services read set values straight out of `_raw` (WatermelonDB's underlying row)
    // rather than through the model getters, so the mock has to carry the columns too.
    _raw: {
      id: fields.id,
      log_exercise_id: fields.logExerciseId,
      reps: fields.reps,
      weight: fields.weight,
      partials: fields.partials,
      rest_time_after: fields.restTimeAfter,
      reps_in_reserve: fields.repsInReserve,
      is_skipped: fields.isSkipped,
      difficulty_level: fields.difficultyLevel,
      set_type: fields.setType,
      set_order: fields.setOrder,
      created_at: fields.createdAt,
      updated_at: fields.updatedAt,
      deleted_at: fields.deletedAt,
    },
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
  };
}

/**
 * Creates a mock WorkoutTemplate model
 */
export function createMockWorkoutTemplate(overrides: Partial<any> = {}) {
  const template: any = {
    id: 'template-1',
    name: 'Test Template',
    description: 'Test Description',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    // Template sets hang off `workout_template_exercises`, not off the template directly.
    templateExercises: { fetch: jest.fn().mockResolvedValue([]) },
    schedules: { fetch: jest.fn().mockResolvedValue([]) },
    startWorkout: jest.fn().mockResolvedValue(createMockWorkoutLog()),
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    prepareUpdate: jest.fn((callback) => {
      callback(template);
      return template;
    }),
    ...overrides,
  };
  return template;
}

export function createMockWorkoutPlan(overrides: Partial<any> = {}) {
  const plan = {
    id: 'plan-1',
    name: 'Test Plan',
    cycleType: 'weekly',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    memberships: { fetch: jest.fn().mockResolvedValue([]) },
    prepareUpdate: jest.fn((callback) => {
      callback(plan);
      return plan;
    }),
    markAsDeleted: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return plan;
}

export function createMockWorkoutPlanTemplate(overrides: Partial<any> = {}) {
  const membership = {
    id: 'membership-1',
    planId: 'plan-1',
    templateId: 'template-1',
    weekDays: undefined,
    position: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    prepareUpdate: jest.fn((callback) => {
      callback(membership);
      return membership;
    }),
    ...overrides,
  };
  return membership;
}

/**
 * Creates a mock WorkoutTemplateExercise model
 */
export function createMockWorkoutTemplateExercise(overrides: Partial<any> = {}) {
  const templateExercise: any = {
    id: 'template-exercise-1',
    templateId: 'template-1',
    exerciseId: 'exercise-1',
    exerciseOrder: 1,
    groupId: undefined,
    notes: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    update: jest.fn((callback) => {
      callback({ updatedAt: Date.now() });
      return Promise.resolve();
    }),
    prepareUpdate: jest.fn((callback) => {
      callback(templateExercise);
      return templateExercise;
    }),
    ...overrides,
  };
  return templateExercise;
}

/**
 * Creates a mock WorkoutTemplateSet model
 */
export function createMockWorkoutTemplateSet(overrides: Partial<any> = {}) {
  const templateSet: any = {
    id: 'template-set-1',
    templateExerciseId: 'template-exercise-1',
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
    prepareUpdate: jest.fn((callback) => {
      callback(templateSet);
      return templateSet;
    }),
    ...overrides,
  };
  return templateSet;
}

/**
 * Creates a mock Schedule model
 */
export function createMockSchedule(overrides: Partial<any> = {}) {
  const schedule: any = {
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
    prepareUpdate: jest.fn((callback) => {
      callback(schedule);
      return schedule;
    }),
    ...overrides,
  };
  return schedule;
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
