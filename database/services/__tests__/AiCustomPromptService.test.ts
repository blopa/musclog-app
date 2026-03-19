import { database } from '../../index';
import { AiCustomPromptService } from '../AiCustomPromptService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    sortBy: jest.fn((field: string, direction: any) => ({ field, direction })),
    or: jest.fn((...args: any[]) => args),
  },
}));

jest.mock('../../index', () => {
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
      };
      const mockCollection = {
        query: jest.fn().mockReturnValue(mockQuery),
      };
      mockDatabase.get.mockReturnValue(mockCollection as any);

      await AiCustomPromptService.getActivePrompts('nutrition', 'memory');

      expect(mockCollection.query).toHaveBeenCalled();
    });
  });
});
