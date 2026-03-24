import { database } from '../../index';
import { SupplementService } from '../SupplementService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: any) => ({ field, condition })),
    eq: jest.fn((value: any) => value),
    sortBy: jest.fn(() => ({})),
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
    prepareCreate: jest.fn().mockResolvedValue({}),
    fetch: jest.fn().mockResolvedValue([]),
  };

  const mockWriter = {} as any;

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn((callback) => Promise.resolve(callback(mockWriter))),
    },
  };
});

const mockDatabase = database as jest.Mocked<typeof database>;

describe('SupplementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should get active supplements', async () => {
    const mockSupplements = [{ id: '1', name: 'Creatine' }];
    const mockQuery = {
      fetch: jest.fn().mockResolvedValue(mockSupplements),
    };

    mockDatabase.get.mockReturnValue({
      query: jest.fn().mockReturnValue(mockQuery),
    } as any);

    const result = await SupplementService.getActiveSupplements();
    expect(result).toBe(mockSupplements);
    expect(mockDatabase.get).toHaveBeenCalledWith('supplements');
  });

  it('should create a supplement', async () => {
    const mockCreate = jest.fn().mockResolvedValue({ id: '1', name: 'Creatine' });
    mockDatabase.get.mockReturnValue({
      create: mockCreate,
    } as any);

    await SupplementService.createSupplement({
      name: 'Creatine',
      dosage: '5g',
      hasReminder: true,
    });

    expect(mockDatabase.write).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalled();

    const createCall = mockCreate.mock.calls[0][0];
    const mockRecord = {} as any;
    createCall(mockRecord);
    expect(mockRecord.name).toBe('Creatine');
    expect(mockRecord.dosage).toBe('5g');
    expect(mockRecord.hasReminder).toBe(true);
  });
});
