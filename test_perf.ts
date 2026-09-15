import { performance } from 'perf_hooks';

// Simulate DB find
const mockFind = async (id: string) => {
  await new Promise(r => setTimeout(r, 1));
  return { id, calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 };
};

const mockQuery = async (ids: string[]) => {
  await new Promise(r => setTimeout(r, 1));
  return ids.map(id => ({ id, calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 }));
};

const roundToDecimalPlaces = (val: number) => val;

async function runBefore() {
    const ingredients = Array.from({ length: 100 }).map((_, i) => ({
      kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 100, foodId: `food_${i}`
    }));

    return Promise.all(
      ingredients.map(async (ingredient) => {
        if (!ingredient.foodId) {
          return ingredient;
        }
        try {
          const food = await mockFind(ingredient.foodId);
          const scale = ingredient.grams / 100;
          return {
            ...ingredient,
            kcal: roundToDecimalPlaces((food.calories ?? 0) * scale),
            protein: roundToDecimalPlaces((food.protein ?? 0) * scale),
            carbs: roundToDecimalPlaces((food.carbs ?? 0) * scale),
            fat: roundToDecimalPlaces((food.fat ?? 0) * scale),
            fiber: roundToDecimalPlaces((food.fiber ?? 0) * scale),
          };
        } catch (error) {
          return ingredient;
        }
      })
    );
}

async function runAfter() {
    const ingredients = Array.from({ length: 100 }).map((_, i) => ({
      kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 100, foodId: `food_${i}`
    }));

    const validFoodIds = Array.from(new Set(ingredients.map(i => i.foodId).filter(Boolean))) as string[];
    const foodMap = new Map();
    if (validFoodIds.length > 0) {
      try {
        const fetchedFoods = await mockQuery(validFoodIds);
        fetchedFoods.forEach(food => foodMap.set(food.id, food));
      } catch (e) {
      }
    }

    return ingredients.map((ingredient) => {
      if (!ingredient.foodId) return ingredient;

      const food = foodMap.get(ingredient.foodId);
      if (!food) {
          const { foodId: _, ...rest } = ingredient;
          return rest;
      }

      const scale = ingredient.grams / 100;
      return {
        ...ingredient,
        kcal: roundToDecimalPlaces((food.calories ?? 0) * scale),
        protein: roundToDecimalPlaces((food.protein ?? 0) * scale),
        carbs: roundToDecimalPlaces((food.carbs ?? 0) * scale),
        fat: roundToDecimalPlaces((food.fat ?? 0) * scale),
        fiber: roundToDecimalPlaces((food.fiber ?? 0) * scale),
      };
    });
}

async function main() {
    const start1 = performance.now();
    await runBefore();
    const end1 = performance.now();
    console.log(`Before: ${(end1 - start1).toFixed(2)} ms`);

    const start2 = performance.now();
    await runAfter();
    const end2 = performance.now();
    console.log(`After: ${(end2 - start2).toFixed(2)} ms`);
}

main();
