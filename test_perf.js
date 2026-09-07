// Simulate DB find
const mockFind = async (id) => {
  await new Promise(r => setTimeout(r, 1)); // WatermelonDB JSI operations are faster, but network/DB calls have latency. We'll simulate 5ms latency for each DB hit for a more realistic WatermelonDB find scenario. Wait, Watermelon JSI is synchronous but the find returns a Promise so there is event loop tick. Let's use 1ms per find vs 1ms for the whole batch query.
  return { id, calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 };
};

const mockQuery = async (ids) => {
  await new Promise(r => setTimeout(r, 1));
  return ids.map(id => ({ id, calories: 100, protein: 10, carbs: 20, fat: 5, fiber: 2 }));
};

const roundToDecimalPlaces = (val) => val;

async function runBefore() {
    const ingredients = Array.from({ length: 100 }).map((_, i) => ({
      kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 100, foodId: `food_${i}`
    }));

    // Process them sequentially to simulate the actual cost if Promise.all wasn't parallelizing perfectly or if the DB connection becomes a bottleneck
    // Wait, the original code uses Promise.all so they are in parallel but each one awaits on the DB.
    return Promise.all(
      ingredients.map(async (ingredient) => {
        if (!ingredient.foodId) {
          return ingredient;
        }
        try {
          // For a true DB, each find is a query `select * from foods where id=?`
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

    const validFoodIds = Array.from(new Set(ingredients.map(i => i.foodId).filter(Boolean)));
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
    let beforeSum = 0;
    let afterSum = 0;
    for (let i = 0; i < 10; i++) {
        const start1 = performance.now();
        await runBefore();
        const end1 = performance.now();
        beforeSum += end1 - start1;

        const start2 = performance.now();
        await runAfter();
        const end2 = performance.now();
        afterSum += end2 - start2;
    }
    console.log(`Before Avg: ${(beforeSum / 10).toFixed(2)} ms`);
    console.log(`After Avg: ${(afterSum / 10).toFixed(2)} ms`);
}

main();
