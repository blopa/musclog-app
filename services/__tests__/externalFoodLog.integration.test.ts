/* eslint-disable simple-import-sort/imports -- Install the shared database mocks before importing services. */
// The real NutritionService over an in-memory database: the pure tests prove what is sent to it,
// this proves what it stores (the assistant's NET carbs become the canonical total, a grouped meal
// shares one group id, a matched foundation food is linked, not copied).
jest.mock('@/services/nutritionHealthExport', () => ({
  exportLogsToHealthPlatform: jest.fn(async () => {}),
  removeLogsFromHealthPlatform: jest.fn(async () => {}),
}));
jest.mock('@/utils/widgetEvents', () => ({
  widgetEvents: { emitNutritionWidgetUpdate: jest.fn() },
}));
import '@/database/services/__tests__/cycleTestSetup';

import { database } from '@/database/database-instance';
import Food from '@/database/models/Food';
import NutritionLog from '@/database/models/NutritionLog';
import { FOOD_LOG_MAJOR, FOOD_LOG_SCHEMA_ID } from '@/utils/aiFoodLog/contract';
import { sumIngredients } from '@/utils/aiFoodLog/logPlan';

import { logExternalFoods, readExternalFoodLog } from '../externalFoodLog';

const file = (foods: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: FOOD_LOG_SCHEMA_ID, version: FOOD_LOG_MAJOR, foods, ...extra });

// 200 g of rice with 56 g NET carbs and 4 g fiber: 60 g of total carbohydrate.
const rice = {
  name: 'White rice',
  grams: 200,
  calories: 260,
  protein: 5,
  carbs: 56,
  fat: 0.6,
  fiber: 4,
};
const chicken = { name: 'Chicken', grams: 150, calories: 248, protein: 46, carbs: 0, fat: 5.4 };

const day = new Date(2026, 10, 7);
const lunchtime = new Date(2026, 10, 7, 12, 45);

const storedLogs = () => database.get<NutritionLog>('nutrition_logs').query().fetch();

async function importAndLog(
  foods: unknown[],
  grouping: { group: boolean; mealName: string },
  extra: Record<string, unknown> = {}
) {
  const read = await readExternalFoodLog(file(foods, extra));
  if (!read.ok) {
    throw new Error(`file was refused: ${read.error}`);
  }

  await logExternalFoods({
    ingredients: read.ingredients,
    date: day,
    time: lunchtime,
    mealType: 'lunch',
    grouping,
  });
}

describe('logging an assistant-written file', () => {
  it("stores the assistant's net carbs as the canonical total carbs", async () => {
    await importAndLog([rice], { group: false, mealName: '' });

    const [log] = await storedLogs();
    const snapshot = await log.getDecryptedSnapshot();

    expect(log.amount).toBe(200);
    expect(log.type).toBe('lunch');
    expect(snapshot.loggedFoodName).toBe('White rice');
    // Per 100 g: 28 net + 2 fiber = 30 total, which is what every other food source stores.
    expect(snapshot.loggedCarbs).toBeCloseTo(30);
    expect(snapshot.loggedFiber).toBeCloseTo(2);
    expect(snapshot.loggedCalories).toBeCloseTo(130);
  });

  it('logs the day and time chosen in the review, on the meal chosen there', async () => {
    await importAndLog([rice], { group: false, mealName: '' });

    const [log] = await storedLogs();
    const logged = new Date(log.date);

    expect(logged.getFullYear()).toBe(2026);
    expect(logged.getMonth()).toBe(10);
    expect(logged.getDate()).toBe(7);
    expect(logged.getHours()).toBe(12);
    expect(logged.getMinutes()).toBe(45);
  });

  it('logs several foods as one meal when the person groups them', async () => {
    await importAndLog([chicken, rice], { group: true, mealName: 'Chicken and rice' });

    const logs = await storedLogs();

    expect(logs).toHaveLength(2);
    expect(logs[0].groupId).toBeTruthy();
    expect(logs[0].groupId).toBe(logs[1].groupId);
    expect(logs.map((log) => log.loggedMealName)).toEqual(['Chicken and rice', 'Chicken and rice']);
  });

  it('logs separate entries, sharing nothing, when the person does not', async () => {
    await importAndLog([chicken, rice], { group: false, mealName: 'Chicken and rice' });

    const logs = await storedLogs();

    expect(logs).toHaveLength(2);
    expect(logs.every((log) => !log.groupId && !log.loggedMealName)).toBe(true);
  });

  it('links a matched foundation food and uses its own macros for the amount', async () => {
    const banana = await database.write(() =>
      database.get<Food>('foods').create((food) => {
        food.name = 'Banana, raw';
        food.source = 'foundation';
        food.calories = 89;
        food.protein = 1.1;
        food.carbs = 22.8;
        food.fat = 0.3;
        food.fiber = 2.6;
        food.micros = {};
        food.isAiGenerated = false;
        food.isFavorite = false;
        food.createdAt = Date.now();
        food.updatedAt = Date.now();
      })
    );

    const read = await readExternalFoodLog(
      file([{ name: 'Banana', grams: 120, foodId: banana.id }])
    );
    expect(read).toMatchObject({
      ok: true,
      unresolvedNames: [],
      ingredients: [{ foodId: banana.id, kcal: 106.8 }],
    });

    await importAndLog([{ name: 'Banana', grams: 120, foodId: banana.id }], {
      group: false,
      mealName: '',
    });

    const foods = await database.get<Food>('foods').query().fetch();
    const [log] = await storedLogs();

    expect(foods).toHaveLength(1);
    expect(log.foodId).toBe(banana.id);
    expect(log.amount).toBe(120);
    expect((await log.getNutrients()).calories).toBeCloseTo(106.8);
  });

  it('shows in the review exactly the totals the diary reads back after logging', async () => {
    const banana = await database.write(() =>
      database.get<Food>('foods').create((food) => {
        food.name = 'Banana, raw';
        food.source = 'foundation';
        food.calories = 89;
        food.protein = 1.1;
        food.carbs = 22.8;
        food.fat = 0.3;
        food.fiber = 2.6;
        food.micros = {};
        food.isAiGenerated = false;
        food.isFavorite = false;
        food.createdAt = Date.now();
        food.updatedAt = Date.now();
      })
    );
    const foods = [rice, chicken, { name: 'Banana', grams: 120, foodId: banana.id }];

    const read = await readExternalFoodLog(file(foods));
    if (!read.ok) {
      throw new Error(`file was refused: ${read.error}`);
    }

    const reviewed = sumIngredients(read.ingredients);
    await logExternalFoods({
      ingredients: read.ingredients,
      date: day,
      time: lunchtime,
      mealType: 'lunch',
      grouping: { group: false, mealName: '' },
    });

    const stored = await Promise.all((await storedLogs()).map((log) => log.getNutrients()));
    const sum = (pick: (nutrients: (typeof stored)[number]) => number) =>
      stored.reduce((total, nutrients) => total + pick(nutrients), 0);

    expect(sum((n) => n.calories)).toBeCloseTo(reviewed.kcal, 1);
    expect(sum((n) => n.protein)).toBeCloseTo(reviewed.protein, 1);
    expect(sum((n) => n.carbs)).toBeCloseTo(reviewed.carbs, 1);
    expect(sum((n) => n.fat)).toBeCloseTo(reviewed.fat, 1);
  });

  it('leaves out a foundation id that is not in the database and brought no numbers', async () => {
    const read = await readExternalFoodLog(
      file([{ name: 'Mystery fruit', grams: 100, foodId: 'not-a-real-id' }, chicken])
    );

    expect(read).toMatchObject({
      ok: true,
      unresolvedNames: ['Mystery fruit'],
      ingredients: [{ name: 'Chicken' }],
    });
  });
});
