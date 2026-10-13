import { database } from '@/database/database-instance';
import { fetchMapByIds } from '@/database/queryByIds';
import { FoodPortionService } from '@/database/services/FoodPortionService';

jest.mock('@/database/database-instance', () => ({ database: { get: jest.fn() } }));
jest.mock('@/database/queryByIds', () => ({ fetchMapByIds: jest.fn() }));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: jest.fn((k: string) => k) } }));

const mockGet = database.get as jest.Mock;
const mockFetchMapByIds = fetchMapByIds as jest.Mock;

function installLinks(foodLinks: { foodId: string }[], mealLinks: { mealId: string }[]) {
  mockGet.mockImplementation((table: string) => ({
    query: () => ({
      fetch: jest.fn().mockResolvedValue(table === 'food_food_portions' ? foodLinks : mealLinks),
    }),
  }));
}

describe('FoodPortionService.getPortionUsageSummary', () => {
  beforeEach(() => jest.clearAllMocks());

  it('resolves names through the batched helper and de-duplicates them', async () => {
    installLinks(
      [{ foodId: 'f1' }, { foodId: 'f2' }, { foodId: 'f3' }],
      [{ mealId: 'm1' }, { mealId: 'm1' }]
    );
    mockFetchMapByIds.mockImplementation(async (table: string) =>
      table === 'foods'
        ? new Map([
            ['f1', { name: 'Rice' }],
            ['f2', { name: 'Rice' }],
          ])
        : new Map([['m1', { name: 'Bowl' }]])
    );

    await expect(FoodPortionService.getPortionUsageSummary('p1')).resolves.toEqual({
      foods: ['Rice'],
      meals: ['Bowl'],
    });
    expect(mockFetchMapByIds).toHaveBeenCalledWith(
      'foods',
      'id',
      ['f1', 'f2', 'f3'],
      expect.anything()
    );
  });

  it('skips links whose record is missing or soft-deleted (filtered in the query)', async () => {
    installLinks([{ foodId: 'gone' }], [{ mealId: 'gone' }]);
    mockFetchMapByIds.mockResolvedValue(new Map());

    await expect(FoodPortionService.getPortionUsageSummary('p1')).resolves.toEqual({
      foods: [],
      meals: [],
    });
    expect(mockFetchMapByIds).toHaveBeenCalledTimes(2);
  });
});
