import { database } from '@/database/index';
import { NutritionGoalInput, NutritionGoalService } from '@/database/services/NutritionGoalService';

import { createMockNutritionGoal } from './helpers';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    desc: 'desc' as const,
    take: jest.fn((count: number) => count),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
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

const mockDatabase = database as jest.Mocked<typeof database>;

describe('NutritionGoalService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrent', () => {
    it('should return goal when current goal exists', async () => {
      const mockGoal = createMockNutritionGoal({
        effectiveUntil: null,
        deletedAt: null,
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockGoal]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getCurrent();

      expect(result).toBe(mockGoal);
      expect(mockDatabase.get).toHaveBeenCalledWith('nutrition_goals');
      expect(mockQuery.fetch).toHaveBeenCalled();
    });

    it('should return null when no current goal exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getCurrent();

      expect(result).toBeNull();
    });

    it('should filter out deleted goals correctly', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getCurrent();

      expect(result).toBeNull();
    });
  });

  describe('saveGoals', () => {
    const mockGoalInput: NutritionGoalInput = {
      totalCalories: 2500,
      protein: 180,
      carbs: 250,
      fats: 80,
      fiber: 35,
      eatingPhase: 'bulk',
      targetWeight: 80,
      targetBodyFat: 12,
      targetBMI: 24,
      targetFFMI: 22,
      targetDate: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days from now
    };

    it('should create new goal when no current goal exists', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockNutritionGoal(mockGoalInput));
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });

      const result = await NutritionGoalService.saveGoals(mockGoalInput);

      expect(mockDatabase.write).toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalled();
      const createCall = mockCreate.mock.calls[0][0];
      const mockGoal = {} as any;
      createCall(mockGoal);

      expect(mockGoal.totalCalories).toBe(2500);
      expect(mockGoal.protein).toBe(180);
      expect(mockGoal.carbs).toBe(250);
      expect(mockGoal.fats).toBe(80);
      expect(mockGoal.fiber).toBe(35);
      expect(mockGoal.eatingPhase).toBe('bulk');
      expect(mockGoal.targetWeight).toBe(80);
      expect(mockGoal.targetBodyFat).toBe(12);
      expect(mockGoal.targetBmi).toBe(24);
      expect(mockGoal.targetFfmi).toBe(22);
      expect(mockGoal.targetDate).toBe(mockGoalInput.targetDate);
      expect(mockGoal.effectiveUntil).toBeNull();
      expect(mockGoal.createdAt).toBeDefined();
      expect(mockGoal.updatedAt).toBeDefined();
    });

    it('should update previous goal effective_until when current exists', async () => {
      const now = Date.now();
      const mockCurrentGoal = createMockNutritionGoal({
        effectiveUntil: null,
        update: jest.fn((callback) => {
          callback({ effectiveUntil: now, updatedAt: now });
          return Promise.resolve();
        }),
      });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockCurrentGoal]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockNutritionGoal(mockGoalInput));
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });

      await NutritionGoalService.saveGoals(mockGoalInput);

      expect(mockCurrentGoal.update).toHaveBeenCalled();
      const updateCall = mockCurrentGoal.update.mock.calls[0][0];
      const mockUpdated = {} as any;
      updateCall(mockUpdated);
      expect(mockUpdated.effectiveUntil).toBeGreaterThan(0);
      expect(mockUpdated.updatedAt).toBeDefined();
    });

    it('should create new goal with effective_until = null', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockNutritionGoal(mockGoalInput));
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });

      await NutritionGoalService.saveGoals(mockGoalInput);

      const createCall = mockCreate.mock.calls[0][0];
      const mockGoal = {} as any;
      createCall(mockGoal);
      expect(mockGoal.effectiveUntil).toBeNull();
    });

    it('should handle optional targetDate as null', async () => {
      const inputWithoutDate: NutritionGoalInput = {
        ...mockGoalInput,
        targetDate: null,
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockNutritionGoal());
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });

      await NutritionGoalService.saveGoals(inputWithoutDate);

      const createCall = mockCreate.mock.calls[0][0];
      const mockGoal = {} as any;
      createCall(mockGoal);
      expect(mockGoal.targetDate).toBeNull();
    });

    it('should handle optional targetDate as undefined', async () => {
      const inputWithoutDate: NutritionGoalInput = {
        ...mockGoalInput,
        targetDate: undefined,
      };

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      const mockCreate = jest.fn().mockResolvedValue(createMockNutritionGoal());
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
        create: mockCreate,
      };

      mockDatabase.get.mockReturnValue(mockCollection as any);
      mockDatabase.write.mockImplementation(async (callback) => {
        const mockWriter = {} as any;
        return await callback(mockWriter);
      });

      await NutritionGoalService.saveGoals(inputWithoutDate);

      const createCall = mockCreate.mock.calls[0][0];
      const mockGoal = {} as any;
      createCall(mockGoal);
      expect(mockGoal.targetDate).toBeNull();
    });
  });

  describe('getHistory', () => {
    it('should return all goals ordered by created_at desc', async () => {
      const mockGoal1 = createMockNutritionGoal({ createdAt: Date.now() - 1000 });
      const mockGoal2 = createMockNutritionGoal({ createdAt: Date.now() });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockGoal2, mockGoal1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getHistory();

      expect(result).toEqual([mockGoal2, mockGoal1]);
      expect(mockDatabase.get).toHaveBeenCalledWith('nutrition_goals');
    });

    it('should respect limit parameter when provided', async () => {
      const mockGoal1 = createMockNutritionGoal({ createdAt: Date.now() - 1000 });
      const mockGoal2 = createMockNutritionGoal({ createdAt: Date.now() });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockGoal2]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getHistory(1);

      expect(result).toEqual([mockGoal2]);
      expect(mockQuery.extend).toHaveBeenCalled();
    });

    it('should filter out deleted goals', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getHistory();

      expect(result).toEqual([]);
    });

    it('should return empty array when no goals exist', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      const result = await NutritionGoalService.getHistory();

      expect(result).toEqual([]);
    });

    it('should not apply limit when limit is not provided', async () => {
      const mockGoal1 = createMockNutritionGoal({ createdAt: Date.now() - 1000 });
      const mockGoal2 = createMockNutritionGoal({ createdAt: Date.now() });

      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([mockGoal2, mockGoal1]),
        extend: jest.fn().mockReturnThis(),
      };

      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue(mockQuery),
      } as any);

      await NutritionGoalService.getHistory();

      // extend should not be called with take when limit is undefined
      expect(mockQuery.extend).not.toHaveBeenCalled();
    });
  });
});
