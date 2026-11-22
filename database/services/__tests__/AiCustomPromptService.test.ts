import { database } from '@/database/database-instance';
import { AiCustomPromptService } from '@/database/services/AiCustomPromptService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
    or: jest.fn((...args: any[]) => args),
  },
}));

jest.mock('../../database-instance', () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
    extend: jest.fn(function () {
      return this;
    }),
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

jest.mock('../SettingsService', () => ({
  getMaxAiMemories: jest.fn().mockResolvedValue(50),
  setMaxAiMemories: jest.fn().mockResolvedValue(undefined),
}));

import SettingsServiceMock from '../SettingsService';

const SettingsServiceMock_ = SettingsServiceMock as any;
const mockDatabase = database as jest.Mocked<typeof database>;

describe('AiCustomPromptService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPrompt', () => {
    it('should create a system prompt by default', async () => {
      const mockCreate = jest.fn().mockResolvedValue({
        name: 'Test',
        content: 'Content',
        type: 'system',
        context: 'general',
      });
      mockDatabase.get.mockReturnValue({ create: mockCreate } as any);

      await AiCustomPromptService.createPrompt('Test', 'Content');

      expect(mockCreate).toHaveBeenCalled();
      const createCall = mockCreate.mock.calls[0][0];
      const mockPrompt = {} as any;
      createCall(mockPrompt);
      expect(mockPrompt.type).toBe('system');
      expect(mockPrompt.context).toBe('general');
    });

    it('should create a memory prompt when type is memory', async () => {
      const mockCreate = jest.fn().mockResolvedValue({});
      mockDatabase.get.mockReturnValue({
        query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
        create: mockCreate,
      } as any);

      await AiCustomPromptService.createPrompt('Test', 'Content', true, 'nutrition', 'memory');

      const createCall = mockCreate.mock.calls[0][0];
      const mockPrompt = {} as any;
      createCall(mockPrompt);
      expect(mockPrompt.type).toBe('memory');
      expect(mockPrompt.context).toBe('nutrition');
    });
  });

  describe('getActivePrompts', () => {
    it('should filter by type and context', async () => {
      const mockQuery = {
        fetch: jest.fn().mockResolvedValue([]),
        extend: jest.fn().mockReturnThis(),
      };
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
      };
      mockDatabase.get.mockReturnValue(mockCollection as any);

      await AiCustomPromptService.getActivePrompts('nutrition', 'memory');

      expect(mockCollection.query).toHaveBeenCalled();
      expect(mockQuery.extend).toHaveBeenCalled();
    });
  });

  describe('shared memories', () => {
    const DAY = 24 * 60 * 60 * 1000;

    const memoryRow = (id: string, content: string, createdAt: number, context = 'nutrition') => ({
      id,
      content,
      context,
      type: 'memory',
      createdAt,
      update: jest.fn().mockResolvedValue(undefined),
    });

    const setUpMemories = (rows: any[], maxMemories = 50) => {
      const create = jest.fn((builder: (prompt: any) => void) => {
        const prompt: any = {};
        builder(prompt);
        return Promise.resolve(prompt);
      });
      const fetch = jest.fn().mockResolvedValue(rows);
      const query = jest.fn().mockReturnValue({ fetch });
      (SettingsServiceMock_.getMaxAiMemories as jest.Mock).mockResolvedValue(maxMemories);
      mockDatabase.get.mockReturnValue({ query, create } as any);
      return { create, query };
    };

    it('does not insert a duplicate and returns the existing memory untouched', async () => {
      const existing = memoryRow('m1', 'Has a bad left knee', Date.now() - DAY);
      const { create } = setUpMemories([existing]);

      const result = await AiCustomPromptService.createPrompt(
        'Memory',
        'has a BAD left knee!',
        true,
        'exercise',
        'memory'
      );

      expect(create).not.toHaveBeenCalled();
      expect(result).toBe(existing);
      expect(existing.update).not.toHaveBeenCalled();
    });

    it('soft-deletes a superseded memory and inserts the new one with its own context', async () => {
      const old = memoryRow('m1', 'Has a bad left knee', Date.now() - DAY);
      const { create } = setUpMemories([old]);

      await AiCustomPromptService.createPrompt(
        'Memory',
        'Has a bad right knee',
        true,
        'exercise',
        'memory'
      );

      expect(old.update).toHaveBeenCalledTimes(1);
      const record: any = {};
      old.update.mock.calls[0][0](record);
      expect(record.deletedAt).toEqual(expect.any(Number));
      expect(record.updatedAt).toBe(record.deletedAt);

      expect(create).toHaveBeenCalledTimes(1);
      const prompt: any = {};
      create.mock.calls[0][0](prompt);
      expect(prompt.content).toBe('Has a bad right knee');
      expect(prompt.type).toBe('memory');
      expect(prompt.context).toBe('exercise');
    });

    it('inserts an unrelated memory as new', async () => {
      const old = memoryRow('m1', 'Prefers morning sessions', Date.now() - DAY);
      const { create } = setUpMemories([old]);

      await AiCustomPromptService.createPrompt(
        'Memory',
        'Vegetarian since 2020',
        true,
        'nutrition',
        'memory'
      );

      expect(old.update).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('counts the cap across contexts and evicts the oldest first', async () => {
      const rows = [
        memoryRow('new', 'Trains at night only', Date.now() - 1, 'nutrition'),
        memoryRow('mid', 'Owns a home gym', Date.now() - 2, 'exercise'),
        memoryRow('old', 'Lives near the coast', Date.now() - 3, 'general'),
      ];
      const { create, query } = setUpMemories(rows, 2);

      await AiCustomPromptService.createPrompt('Memory', 'Likes rowing', true, 'general', 'memory');

      // The query carries no context filter, so memories of every context count.
      const clauses = query.mock.calls[0];
      expect(JSON.stringify(clauses)).not.toContain('"context"');
      expect(rows[0].update).not.toHaveBeenCalled();
      expect(rows[1].update).toHaveBeenCalledTimes(1);
      expect(rows[2].update).toHaveBeenCalledTimes(1);
      expect(create).toHaveBeenCalledTimes(1);
    });

    it('returns memories of every context, newest first', async () => {
      const rows = [memoryRow('a', 'x', 2)];
      const fetch = jest.fn().mockResolvedValue(rows);
      const query = jest.fn().mockReturnValue({ fetch });
      mockDatabase.get.mockReturnValue({ query } as any);

      const result = await AiCustomPromptService.getMemoriesForPrompt();

      expect(result).toBe(rows);
      const clauses = JSON.stringify(query.mock.calls[0]);
      expect(clauses).not.toContain('"context"');
      expect(clauses).toContain('"memory"');
      expect(clauses).toContain('"created_at"');
    });
  });
});
