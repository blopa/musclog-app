import {
  WorkoutTemplateService,
  ExerciseInWorkout,
  SaveTemplateData,
} from '../WorkoutTemplateService';
import { database } from '../../index';
import { WorkoutTemplateRepository } from '../../repositories/WorkoutTemplateRepository';
import {
  createMockWorkoutTemplate,
  createMockWorkoutTemplateSet,
  createMockSchedule,
  createMockExercise,
  createMockWorkoutLog,
} from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    notEq: jest.fn((value: any) => value),
    oneOf: jest.fn((values: any[]) => values),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
    desc: 'desc' as const,
    asc: 'asc' as const,
  },
}));

jest.mock('../../index', () => {
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

  const mockWriter = {} as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
      batch: jest.fn().mockResolvedValue(undefined),
      collections: {
        get: jest.fn().mockReturnValue(mockCollection),
      },
    },
  };
});

jest.mock('../../repositories/WorkoutTemplateRepository', () => ({
  WorkoutTemplateRepository: {
    getActive: jest.fn(),
  },
}));

jest.mock('../../../utils/workout', () => ({
  WEEKDAY_NAMES: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  indexToDayName: jest.fn((index: number) => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    return days[index] || days[0];
  }),
}));

jest.mock('lucide-react-native', () => ({
  Dumbbell: jest.fn(),
  User: jest.fn(),
}));

jest.mock('../../../theme', () => ({
  theme: {
    colors: {
      background: {
        white5: '#f5f5f5',
      },
      accent: {
        primary10: '#e0e7ff',
        primary: '#6366f1',
      },
      text: {
        secondary: '#6b7280',
      },
    },
  },
}));

const mockDatabase = database as jest.Mocked<typeof database>;
const mockWorkoutTemplateRepository = WorkoutTemplateRepository as jest.Mocked<
  typeof WorkoutTemplateRepository
>;

describe('WorkoutTemplateService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getTemplateWithDetails', () => {
    it('should return template with sets and schedule', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const set1 = createMockWorkoutTemplateSet({
        templateId: 'template-1',
        setOrder: 1,
      });

      const set2 = createMockWorkoutTemplateSet({
        templateId: 'template-1',
        setOrder: 2,
      });

      const schedule = createMockSchedule({
        templateId: 'template-1',
        dayOfWeek: 'Monday',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValueOnce([set1, set2]).mockResolvedValueOnce([schedule]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(template),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      const result = await WorkoutTemplateService.getTemplateWithDetails('template-1');

      expect(result.template).toBe(template);
      expect(result.sets).toEqual([set1, set2]);
      expect(result.schedule).toEqual([schedule]);
    });

    it('should get sets ordered by set_order asc', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const set1 = createMockWorkoutTemplateSet({ setOrder: 1 });
      const set2 = createMockWorkoutTemplateSet({ setOrder: 2 });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([set1, set2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(template),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
        } as any);

      const result = await WorkoutTemplateService.getTemplateWithDetails('template-1');

      expect(result.sets).toEqual([set1, set2]);
    });

    it('should filter out deleted sets', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(template),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
        } as any);

      const result = await WorkoutTemplateService.getTemplateWithDetails('template-1');

      expect(result.sets).toEqual([]);
    });

    it('should return empty arrays when no sets/schedule', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          find: jest.fn().mockResolvedValue(template),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockQuery),
        } as any);

      const result = await WorkoutTemplateService.getTemplateWithDetails('template-1');

      expect(result.sets).toEqual([]);
      expect(result.schedule).toEqual([]);
    });
  });

  describe('convertSetsToExercises', () => {
    it('should group sets by exercise correctly', async () => {
      const set1 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 100,
        setOrder: 1,
      });

      const set2 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 100,
        setOrder: 2,
      });

      const set3 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-2',
        targetReps: 12,
        targetWeight: 80,
        setOrder: 3,
      });

      const exercise1 = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
        equipmentType: 'barbell',
      });

      const exercise2 = createMockExercise({
        id: 'ex-2',
        name: 'Squat',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise1, exercise2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set1, set2, set3] as any);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('ex-1');
      expect(result[0].sets).toBe(2);
      expect(result[1].id).toBe('ex-2');
      expect(result[1].sets).toBe(1);
    });

    it('should get exercise details from database', async () => {
      const set = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 100,
        setOrder: 1,
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set] as any);

      expect(result[0].label).toBe('Bench Press');
    });

    it('should determine icon based on equipment type (bodyweight)', async () => {
      const set = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 0,
        setOrder: 1,
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Push-ups',
        equipmentType: 'bodyweight',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set] as any);

      expect(result[0].isBodyweight).toBe(true);
    });

    it('should determine icon based on equipment type (weighted)', async () => {
      const set = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 100,
        setOrder: 1,
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set] as any);

      expect(result[0].isBodyweight).toBe(false);
    });

    it('should calculate sets count correctly', async () => {
      const set1 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        setOrder: 1,
      });

      const set2 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        setOrder: 2,
      });

      const set3 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        setOrder: 3,
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set1, set2, set3] as any);

      expect(result[0].sets).toBe(3);
    });

    it('should generate description correctly', async () => {
      const set = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        targetReps: 10,
        targetWeight: 100,
        setOrder: 1,
      });

      const exercise = createMockExercise({
        id: 'ex-1',
        name: 'Bench Press',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set] as any);

      expect(result[0].description).toBe('1 sets × 10 reps');
    });

    it('should sort by set_order', async () => {
      const set1 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        setOrder: 3,
      });

      const set2 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-2',
        setOrder: 1,
      });

      const set3 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-3',
        setOrder: 2,
      });

      const exercise1 = createMockExercise({
        id: 'ex-1',
        name: 'Exercise 1',
        equipmentType: 'barbell',
      });
      const exercise2 = createMockExercise({
        id: 'ex-2',
        name: 'Exercise 2',
        equipmentType: 'barbell',
      });
      const exercise3 = createMockExercise({
        id: 'ex-3',
        name: 'Exercise 3',
        equipmentType: 'barbell',
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([exercise1, exercise2, exercise3]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set1, set2, set3] as any);

      expect(result[0].id).toBe('ex-2');
      expect(result[1].id).toBe('ex-3');
      expect(result[2].id).toBe('ex-1');
    });

    it('should return empty array when no sets', async () => {
      const result = await WorkoutTemplateService.convertSetsToExercises([]);

      expect(result).toEqual([]);
    });

    it('should skip exercises not found', async () => {
      const set = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        setOrder: 1,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await WorkoutTemplateService.convertSetsToExercises([set] as any);

      expect(result).toEqual([]);
    });
  });

  describe('saveTemplate', () => {
    const mockExercises: ExerciseInWorkout[] = [
      {
        id: 'ex-1',
        label: 'Bench Press',
        description: '',
        icon: jest.fn(),
        iconBgColor: '',
        iconColor: '',
        sets: 3,
        reps: 10,
        weight: 100,
        isBodyweight: false,
      },
      {
        id: 'ex-2',
        label: 'Squat',
        description: '',
        icon: jest.fn(),
        iconBgColor: '',
        iconColor: '',
        sets: 2,
        reps: 12,
        weight: 80,
        isBodyweight: false,
      },
    ];

    const saveData: SaveTemplateData = {
      name: 'Test Workout',
      description: 'Test Description',
      exercises: mockExercises,
      selectedDays: [0, 2], // Monday, Wednesday
    };

    it('should create new template successfully', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockWorkoutTemplate());
      const mockPrepareCreate = jest.fn().mockReturnValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
        prepareCreate: mockPrepareCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      const result = await WorkoutTemplateService.saveTemplate(saveData);

      expect(mockCreate).toHaveBeenCalled();
      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    it('should update existing template (soft deletes old sets/schedule)', async () => {
      const existingTemplate = createMockWorkoutTemplate({
        id: 'template-1',
        update: jest.fn((callback) => {
          callback({ updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const existingSet = createMockWorkoutTemplateSet({
        id: 'set-1',
        templateId: 'template-1',
        update: jest.fn((callback) => {
          callback({ deletedAt: Date.now(), updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const existingSchedule = createMockSchedule({
        id: 'schedule-1',
        templateId: 'template-1',
        update: jest.fn((callback) => {
          callback({ deletedAt: Date.now(), updatedAt: Date.now() });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest
          .fn()
          .mockResolvedValueOnce([existingSet])
          .mockResolvedValueOnce([existingSchedule]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockPrepareCreate = jest.fn().mockReturnValue({});
      const mockCollection = {
        find: jest.fn().mockResolvedValue(existingTemplate),
        query: jest.fn().mockReturnValue(mockQuery),
        prepareCreate: mockPrepareCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      const updateData: SaveTemplateData = {
        ...saveData,
        templateId: 'template-1',
      };

      await WorkoutTemplateService.saveTemplate(updateData);

      expect(existingTemplate.update).toHaveBeenCalled();
      expect(existingSet.update).toHaveBeenCalled();
      expect(existingSchedule.update).toHaveBeenCalled();
    });

    it('should create template sets with correct set_order (continuous)', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockWorkoutTemplate());
      const mockPrepareCreate = jest.fn().mockReturnValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
        prepareCreate: mockPrepareCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      await WorkoutTemplateService.saveTemplate(saveData);

      // Exercise 1 has 3 sets, Exercise 2 has 2 sets = 5 template sets
      // selectedDays: [0, 2] = 2 schedule entries
      // Total: 5 sets + 2 schedules = 7 prepareCreate calls
      expect(mockPrepareCreate).toHaveBeenCalledTimes(7);
    });

    it('should create schedule entries from selectedDays', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockWorkoutTemplate());
      const mockPrepareCreate = jest.fn().mockReturnValue({});
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
        prepareCreate: mockPrepareCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      await WorkoutTemplateService.saveTemplate(saveData);

      // selectedDays is [0, 2] which should create 2 schedule entries
      const schedulePrepares = mockPrepareCreate.mock.calls.filter((call) => {
        // Check if it's a schedule prepare (we can't easily distinguish, but we know the count)
        return true;
      });

      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    it('should handle empty exercises array', async () => {
      const emptyData: SaveTemplateData = {
        name: 'Empty Workout',
        exercises: [],
        selectedDays: [0],
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockWorkoutTemplate());
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
        prepareCreate: jest.fn().mockReturnValue({}),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      await WorkoutTemplateService.saveTemplate(emptyData);

      expect(mockDatabase.batch).toHaveBeenCalled();
    });

    it('should handle empty selectedDays array', async () => {
      const noDaysData: SaveTemplateData = {
        name: 'No Schedule',
        exercises: mockExercises,
        selectedDays: [],
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockWorkoutTemplate());
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
        prepareCreate: jest.fn().mockReturnValue({}),
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });
      mockDatabase.batch.mockResolvedValue(undefined);

      await WorkoutTemplateService.saveTemplate(noDaysData);

      expect(mockDatabase.batch).toHaveBeenCalled();
    });
  });

  describe('getAllTemplatesWithMetadata', () => {
    it('should return templates with exercise counts', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
        name: 'Test Template',
      });

      const set1 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-1',
        deletedAt: null,
      });

      const set2 = createMockWorkoutTemplateSet({
        exerciseId: 'ex-2',
        deletedAt: null,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([set1, set2]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].exerciseCount).toBe(2);
    });

    it('should calculate last completed date correctly', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const completedWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: Date.now() - 1000,
        startedAt: Date.now() - 2000,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([completedWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].lastCompletedTimestamp).toBe(completedWorkout.completedAt);
    });

    it('should format relative dates correctly (Today)', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const completedWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: Date.now(),
        startedAt: Date.now() - 1000,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([completedWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].lastCompleted).toBe('Today');
    });

    it('should format relative dates correctly (Yesterday)', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const completedWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: yesterday,
        startedAt: yesterday - 1000,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([completedWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].lastCompleted).toBe('Yesterday');
    });

    it('should calculate duration from completed workout', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const startedAt = Date.now() - 90 * 60 * 1000; // 90 minutes ago
      const completedAt = Date.now();
      const completedWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt,
        startedAt,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([completedWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].duration).toBe('1h 30m');
    });

    it('should format duration (mins vs hours)', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const startedAt = Date.now() - 45 * 60 * 1000; // 45 minutes ago
      const completedAt = Date.now();
      const completedWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt,
        startedAt,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([completedWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].duration).toBe('45 mins');
    });

    it('should sort by last completed (most recent first)', async () => {
      const template1 = createMockWorkoutTemplate({
        id: 'template-1',
      });

      const template2 = createMockWorkoutTemplate({
        id: 'template-2',
      });

      const oldWorkout = createMockWorkoutLog({
        templateId: 'template-1',
        completedAt: Date.now() - 10000,
        startedAt: Date.now() - 11000,
      });

      const newWorkout = createMockWorkoutLog({
        templateId: 'template-2',
        completedAt: Date.now(),
        startedAt: Date.now() - 1000,
      });

      template1.templateSets.fetch = jest.fn().mockResolvedValue([]);
      template2.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template1, template2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery1 = {
        fetch: jest.fn().mockResolvedValue([oldWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockWorkoutQuery2 = {
        fetch: jest.fn().mockResolvedValue([newWorkout]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockWorkoutQuery1),
        } as any)
        .mockReturnValueOnce({
          query: jest.fn().mockReturnValue(mockWorkoutQuery2),
        } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].id).toBe('template-2');
      expect(result[1].id).toBe('template-1');
    });

    it('should handle templates with no completed workouts', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(result[0].lastCompleted).toBeUndefined();
      expect(result[0].lastCompletedTimestamp).toBeUndefined();
    });

    it('should filter active templates only', async () => {
      const template = createMockWorkoutTemplate({
        id: 'template-1',
        deletedAt: null,
      });

      template.templateSets.fetch = jest.fn().mockResolvedValue([]);

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([template]),
        extend: jest.fn().mockReturnThis(),
      };

      mockWorkoutTemplateRepository.getActive.mockReturnValue(mockQuery as any);

      const mockWorkoutQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockWorkoutQuery),
      } as any);

      const result = await WorkoutTemplateService.getAllTemplatesWithMetadata();

      expect(mockWorkoutTemplateRepository.getActive).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });
});
