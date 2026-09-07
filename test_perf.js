const { performance } = require('perf_hooks');

// Simulate the issue and proposed solution using mock asynchronous functions
const numItems = 100;
const ingredients = Array.from({ length: numItems }).map((_, i) => ({ foodId: `food-${i}` }));

const mockDb = {
  get: () => ({
    find: async (id) => {
      // Simulate N+1 individual DB call latency
      await new Promise(resolve => setTimeout(resolve, 5));
      return { id };
    },
    query: (...args) => ({
      fetch: async () => {
        // Simulate batch query DB call latency
        await new Promise(resolve => setTimeout(resolve, 15));
        return ingredients.map(i => ({ id: i.foodId }));
      }
    })
  })
};

async function testNPlusOne() {
  const start = performance.now();
  for (const ingredient of ingredients) {
    if (ingredient.foodId) {
      await mockDb.get().find(ingredient.foodId);
    }
  }
  const end = performance.now();
  return end - start;
}

async function testBatch() {
  const start = performance.now();

  const foodIds = ingredients.map(i => i.foodId).filter(Boolean);

  // Batch fetch
  const foods = await mockDb.get().query().fetch();
  const foodMap = new Map();
  for (const food of foods) {
    foodMap.set(food.id, food);
  }

  for (const ingredient of ingredients) {
    if (ingredient.foodId) {
      const food = foodMap.get(ingredient.foodId);
      // use food
    }
  }
  const end = performance.now();
  return end - start;
}

async function run() {
  console.log('N+1 duration:', await testNPlusOne(), 'ms');
  console.log('Batch duration:', await testBatch(), 'ms');
}

run();
