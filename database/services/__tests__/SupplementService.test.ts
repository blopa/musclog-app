import { Q } from '@nozbe/watermelondb';

import { database } from '@/database/database-instance';
import { SupplementService } from '@/database/services/SupplementService';

jest.mock('@nozbe/watermelondb', () => ({
  Q: {
    where: jest.fn((field: string, condition: unknown) => ({ field, condition })),
    eq: jest.fn((value: unknown) => value),
    sortBy: jest.fn((field: string, direction: string) => ({ field, direction })),
    asc: 'asc',
  },
}));

jest.mock('@/database/database-instance', () => {
  const mockQuery = {
    fetch: jest.fn().mockResolvedValue([]),
  };

  const mockCollection = {
    query: jest.fn().mockReturnValue(mockQuery),
    find: jest.fn(),
    create: jest.fn(),
  };

  return {
    database: {
      get: jest.fn().mockReturnValue(mockCollection),
      write: jest.fn(async (callback) => callback()),
    },
  };
});

const mockDatabase = database as jest.Mocked<typeof database>;

describe('SupplementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns active supplements ordered by creation date', async () => {
    const mockSupplements = [{ id: 'supp-1', name: 'Creatine' }];
    const mockFetch = jest.fn().mockResolvedValue(mockSupplements);

    mockDatabase.get.mockReturnValue({
      query: jest.fn().mockReturnValue({ fetch: mockFetch }),
    } as any);

    const result = await SupplementService.getActiveSupplements();

    expect(result).toBe(mockSupplements);
    expect(mockDatabase.get).toHaveBeenCalledWith('supplements');
    expect(Q.where).toHaveBeenCalledWith('deleted_at', null);
  });

  it('creates a supplement with trimmed name and reminder flag', async () => {
    const mockRecord = {} as any;
    const mockCreate = jest.fn().mockImplementation((callback) => {
      callback(mockRecord);
      return mockRecord;
    });

    mockDatabase.get.mockReturnValue({
      create: mockCreate,
    } as any);

    const result = await SupplementService.createSupplement({
      name: '  Creatine  ',
      hasReminder: true,
    });

    expect(mockDatabase.write).toHaveBeenCalled();
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockRecord.name).toBe('Creatine');
    expect(mockRecord.hasReminder).toBe(true);
    expect(typeof mockRecord.createdAt).toBe('number');
    expect(typeof mockRecord.updatedAt).toBe('number');
    expect(result).toBe(mockRecord);
  });
});
