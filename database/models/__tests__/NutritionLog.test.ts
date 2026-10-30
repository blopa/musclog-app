import { decryptJson, decryptNumber, decryptOptionalString } from '@/database/encryptionHelpers';
import NutritionLog from '@/database/models/NutritionLog';

jest.mock('@nozbe/watermelondb', () => ({ Model: class {} }));
jest.mock('@nozbe/watermelondb/decorators', () => ({
  field: jest.fn(() => jest.fn()),
  relation: jest.fn(() => jest.fn()),
  writer: jest.fn((_target, _property, descriptor) => descriptor),
}));
jest.mock('@/database/models/Food', () => ({ __esModule: true, default: class {} }));
jest.mock('@/database/models/FoodPortion', () => ({ __esModule: true, default: class {} }));
jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('@/utils/handleError', () => ({ handleError: jest.fn() }));
// Each "ciphertext" in these tests is the plaintext itself, so a call count is a decrypt count.
jest.mock('@/database/encryptionHelpers', () => ({
  decryptNumber: jest.fn(async (cipher?: string) => (cipher ? Number(cipher) : 0)),
  decryptOptionalString: jest.fn(async (cipher?: string) => cipher ?? ''),
  decryptJson: jest.fn(async (cipher?: string) => (cipher ? JSON.parse(cipher) : {})),
}));

const mockDecryptNumber = decryptNumber as jest.MockedFunction<typeof decryptNumber>;

function makeLog(fields: Record<string, unknown>): NutritionLog {
  return Object.assign(Object.create(NutritionLog.prototype), {
    amount: 200,
    loggedFoodNameRaw: 'Oats',
    loggedCaloriesRaw: '380',
    loggedProteinRaw: '13',
    loggedCarbsRaw: '67',
    loggedFatRaw: '7',
    loggedFiberRaw: '10',
    loggedMicrosRaw: '',
    ...fields,
  });
}

describe('NutritionLog.getNutrients', () => {
  beforeEach(() => jest.clearAllMocks());

  /**
   * Every value is its own AES decrypt with a key derivation, and summaries call this for every
   * log in a 30-day window. It used to decrypt the whole snapshot twice (once in hasSnapshot, once
   * for the numbers) including the food name it never reads — ~12 decrypts per log instead of 5.
   */
  it('decrypts each macro once and never the food name', async () => {
    const nutrients = await makeLog({}).getNutrients();

    expect(nutrients).toEqual({
      calories: 760,
      protein: 26,
      carbs: 134,
      fat: 14,
      fiber: 20,
      alcohol: 0,
    });
    expect(mockDecryptNumber).toHaveBeenCalledTimes(5);
    expect(decryptJson).toHaveBeenCalledTimes(1);
    expect(decryptOptionalString).not.toHaveBeenCalled();
  });

  it('multiplies per-serving snapshots by the serving count', async () => {
    const nutrients = await makeLog({ snapshotBasis: 'per_serving', amount: 2 }).getNutrients();

    expect(nutrients.calories).toBe(760);
    expect(nutrients.fiber).toBe(20);
    expect(mockDecryptNumber).toHaveBeenCalledTimes(5);
  });

  it('keeps reading alcohol from the logged micros', async () => {
    const nutrients = await makeLog({
      amount: 100,
      loggedMicrosRaw: JSON.stringify({ alcohol: 8 }),
    }).getNutrients();

    expect(nutrients.alcohol).toBe(8);
  });

  it('clamps negative logged values to zero', async () => {
    const nutrients = await makeLog({ amount: 100, loggedFiberRaw: '-3' }).getNutrients();

    expect(nutrients.fiber).toBe(0);
  });

  it('falls back to the food when the snapshot is not usable', async () => {
    mockDecryptNumber.mockResolvedValueOnce(Number.NaN);
    const food = {
      resolvedNutritionBasis: 'per_100g',
      micros: {},
      getNutrientsForAmount: jest.fn(() => ({
        calories: 50,
        protein: 1,
        carbs: 2,
        fat: 3,
        fiber: 4,
      })),
    };

    const nutrients = await makeLog({ food: Promise.resolve(food) }).getNutrients();

    expect(food.getNutrientsForAmount).toHaveBeenCalledWith(200);
    expect(nutrients).toEqual({ calories: 50, protein: 1, carbs: 2, fat: 3, fiber: 4, alcohol: 0 });
  });
});

describe('NutritionLog.hasSnapshot', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reports a complete snapshot without decrypting the food name', async () => {
    await expect(makeLog({}).hasSnapshot()).resolves.toBe(true);
    expect(decryptOptionalString).not.toHaveBeenCalled();
  });

  it('reports an unusable snapshot', async () => {
    mockDecryptNumber.mockResolvedValueOnce(Number.NaN);
    await expect(makeLog({}).hasSnapshot()).resolves.toBe(false);
  });
});
