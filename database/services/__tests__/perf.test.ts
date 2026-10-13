import { Q } from '@nozbe/watermelondb';
import { database } from '@/database/database-instance';

jest.mock('@/database/database-instance', () => {
  const mockFoodsQueryFetch = jest.fn().mockResolvedValue([{name: 'Apple', deletedAt: null}]);
  const mockMealsQueryFetch = jest.fn().mockResolvedValue([{name: 'Breakfast', deletedAt: null}]);
  const mockFoodsFind = jest.fn();
  const mockMealsFind = jest.fn();

  return {
    database: {
      get: jest.fn((tableName: string) => {
        if (tableName === 'food_food_portions') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(
                Array.from({ length: 100 }, (_, i) => ({ foodId: `food-${i}` }))
              )
            })
          };
        }
        if (tableName === 'meal_food_portions') {
          return {
            query: jest.fn().mockReturnValue({
              fetch: jest.fn().mockResolvedValue(
                Array.from({ length: 100 }, (_, i) => ({ mealId: `meal-${i}` }))
              )
            })
          };
        }
        if (tableName === 'foods') {
          return {
            find: mockFoodsFind,
            query: jest.fn().mockReturnValue({ fetch: mockFoodsQueryFetch })
          };
        }
        if (tableName === 'meals') {
          return {
            find: mockMealsFind,
            query: jest.fn().mockReturnValue({ fetch: mockMealsQueryFetch })
          };
        }
        return {
          query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) })
        };
      })
    },
    mockFoodsFind,
    mockMealsFind,
    mockFoodsQueryFetch,
    mockMealsQueryFetch,
  };
});

const { FoodPortionService } = require('@/database/services/FoodPortionService');
const dbMock = require('@/database/database-instance');

describe('Performance of getPortionUsageSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('measures N+1 calls', async () => {
    dbMock.mockFoodsFind.mockResolvedValue({ name: 'Apple', deletedAt: null });
    dbMock.mockMealsFind.mockResolvedValue({ name: 'Breakfast', deletedAt: null });

    const start = performance.now();
    const result = await FoodPortionService.getPortionUsageSummary('portion-123');
    const end = performance.now();

    console.log(`Execution time: ${end - start} ms`);

    console.log(`Foods find calls: ${dbMock.mockFoodsFind.mock.calls.length}`);
    console.log(`Meals find calls: ${dbMock.mockMealsFind.mock.calls.length}`);
    console.log(`Foods query fetch calls: ${dbMock.mockFoodsQueryFetch.mock.calls.length}`);
    console.log(`Meals query fetch calls: ${dbMock.mockMealsQueryFetch.mock.calls.length}`);

    expect(result).toBeDefined();

    // Assert N+1 is fixed
    expect(dbMock.mockFoodsFind).not.toHaveBeenCalled();
    expect(dbMock.mockMealsFind).not.toHaveBeenCalled();
    expect(dbMock.mockFoodsQueryFetch).toHaveBeenCalledTimes(1);
    expect(dbMock.mockMealsQueryFetch).toHaveBeenCalledTimes(1);
  });
});
