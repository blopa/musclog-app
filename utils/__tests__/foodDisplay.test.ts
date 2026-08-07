import type Food from '@/database/models/Food';

import { getFoodServingDisplay, getSimpleServingDisplay } from '@/utils/foodDisplay';

/** Minimal stand-in for a `Food` record: `getFoodServingDisplay` only calls this one method. */
function fakeFood(portion: { gramWeight?: number | null; name: string } | null): Food {
  return {
    getDefaultPortionAsync: jest.fn().mockResolvedValue(portion),
  } as unknown as Food;
}

function throwingFood(error: Error): Food {
  return {
    getDefaultPortionAsync: jest.fn().mockRejectedValue(error),
  } as unknown as Food;
}

describe('foodDisplay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getFoodServingDisplay', () => {
    it('renders "<amount> <unit> <portion name>" for the default portion', async () => {
      await expect(
        getFoodServingDisplay(fakeFood({ gramWeight: 150, name: 'Cup' }), 'metric', 'en-US')
      ).resolves.toBe('150 g Cup');
    });

    it('converts the portion to ounces for imperial users', async () => {
      // 150 g = 5.2911 oz
      await expect(
        getFoodServingDisplay(fakeFood({ gramWeight: 150, name: 'Cup' }), 'imperial', 'en-US')
      ).resolves.toBe('5.3 oz Cup');
    });

    it('formats the amount with the requested locale separator', async () => {
      await expect(
        getFoodServingDisplay(fakeFood({ gramWeight: 150, name: 'Tasse' }), 'imperial', 'de-DE')
      ).resolves.toBe('5,3 oz Tasse');
    });

    it('falls back to 100 g when the default portion has no gram weight', async () => {
      await expect(
        getFoodServingDisplay(fakeFood({ gramWeight: null, name: 'Serving' }), 'metric', 'en-US')
      ).resolves.toBe('100 g Serving');
    });

    it('falls back to a bare 100 g when the food has no default portion', async () => {
      await expect(getFoodServingDisplay(fakeFood(null), 'metric', 'en-US')).resolves.toBe('100 g');
    });

    it('defaults to metric / en-US when units and locale are omitted', async () => {
      await expect(
        getFoodServingDisplay(fakeFood({ gramWeight: 30, name: 'Slice' }))
      ).resolves.toBe('30 g Slice');
    });

    it('swallows a lookup failure and still returns a usable fallback string', async () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        getFoodServingDisplay(throwingFood(new Error('db down')), 'imperial', 'en-US')
      ).resolves.toBe('3.5 oz');

      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });
  });

  describe('getSimpleServingDisplay', () => {
    it('defaults to 100 g in metric / en-US', () => {
      expect(getSimpleServingDisplay()).toBe('100 g');
    });

    it('converts to ounces and localises the separator', () => {
      expect(getSimpleServingDisplay(100, 'imperial', 'en-US')).toBe('3.5 oz');
      expect(getSimpleServingDisplay(100, 'imperial', 'de-DE')).toBe('3,5 oz');
    });

    it('keeps grams verbatim in metric', () => {
      expect(getSimpleServingDisplay(250, 'metric', 'en-US')).toBe('250 g');
      expect(getSimpleServingDisplay(1500, 'metric', 'de-DE')).toBe('1500 g');
    });
  });
});
