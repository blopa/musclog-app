import { planShareImport } from '@/utils/share/shareImportPlan';
import { MEAL_SHARE_SPEC } from '@/utils/share/shareKinds';

const records = () => ({
  food_food_portions: [
    {
      food_id: 'food-reused',
      food_portion_id: 'portion-for-reused-food',
      id: 'link-reused-food',
      is_default: true,
    },
  ],
  food_portions: [
    {
      id: 'private-portion',
      name: 'Bowl',
      owner_id: 'meal-1',
      owner_type: 'meal',
      scope: 'private',
      source: 'basic',
    },
    { id: 'portion-for-reused-food', name: 'Bar', scope: 'global' },
    { id: 'meal-food-portion', name: 'Scoop', scope: 'global' },
    { id: 'orphan-portion', name: 'Orphan', scope: 'global' },
  ],
  foods: [
    {
      _changed: 'name',
      _status: 'updated',
      calories: 100,
      id: 'food-created',
      is_favorite: true,
      name: 'Created food',
    },
    { calories: 200, id: 'food-reused', name: 'Existing food' },
    { _status: 'deleted', id: 'food-deleted', name: 'Deleted food' },
  ],
  meal_food_portions: [
    {
      food_portion_id: 'private-portion',
      id: 'meal-private-link',
      is_default: true,
      meal_id: 'meal-1',
    },
  ],
  meal_foods: [
    {
      amount: 2,
      food_id: 'food-created',
      id: 'meal-food-1',
      meal_id: 'meal-1',
      portion_id: 'meal-food-portion',
    },
    { amount: 1, food_id: 'food-reused', id: 'meal-food-2', meal_id: 'meal-1' },
  ],
  meals: [
    {
      id: 'meal-1',
      image_url: 'share-asset:mealImage',
      is_favorite: true,
      name: 'Shared meal',
    },
  ],
});

const ids = () => {
  let next = 0;
  return () => `local-${++next}`;
};

describe('planShareImport', () => {
  it('sanitizes, resolves, drops, prunes and rewrites the graph', () => {
    const plan = planShareImport(MEAL_SHARE_SPEC, records(), {
      assets: { mealImage: 'file:///meals/imported.jpg' },
      generateId: ids(),
      nowMs: 1234,
      resolutions: { foods: { 'food-reused': 'local-existing-food' } },
    });

    expect(plan.reused).toContainEqual({
      localId: 'local-existing-food',
      sourceId: 'food-reused',
      table: 'foods',
    });
    expect(plan.creates.some((item) => item.sourceId === 'food-reused')).toBe(false);
    expect(plan.creates.some((item) => item.sourceId === 'food-deleted')).toBe(false);
    expect(plan.creates.some((item) => item.sourceId === 'link-reused-food')).toBe(false);
    expect(plan.creates.some((item) => item.sourceId === 'portion-for-reused-food')).toBe(false);
    expect(plan.creates.some((item) => item.sourceId === 'orphan-portion')).toBe(false);
    expect(plan.creates.some((item) => item.sourceId === 'meal-food-portion')).toBe(true);

    const meal = plan.creates.find((item) => item.table === 'meals')?.row;
    expect(meal).toMatchObject({
      created_at: 1234,
      image_url: 'file:///meals/imported.jpg',
      is_favorite: false,
      updated_at: 1234,
    });

    const food = plan.creates.find((item) => item.sourceId === 'food-created')?.row;
    expect(food).toMatchObject({ created_at: 1234, is_favorite: false, updated_at: 1234 });
    expect(food).not.toHaveProperty('_changed');
    expect(food).not.toHaveProperty('_status');

    const privatePortion = plan.creates.find((item) => item.sourceId === 'private-portion')?.row;
    expect(privatePortion).toMatchObject({
      owner_id: plan.rootId,
      owner_type: 'meal',
      source: 'custom',
    });

    const mealFood = plan.creates.find((item) => item.sourceId === 'meal-food-1')?.row;
    expect(mealFood).toMatchObject({
      food_id: plan.idMap.foods['food-created'],
      meal_id: plan.rootId,
      portion_id: plan.idMap.food_portions['meal-food-portion'],
    });
    const reusedMealFood = plan.creates.find((item) => item.sourceId === 'meal-food-2')?.row;
    expect(reusedMealFood?.food_id).toBe('local-existing-food');
  });

  it('drops unresolved asset references without failing the import', () => {
    const plan = planShareImport(MEAL_SHARE_SPEC, records(), {
      generateId: ids(),
      nowMs: 1,
      resolutions: { foods: { 'food-reused': 'local-existing-food' } },
    });
    expect(plan.creates.find((item) => item.table === 'meals')?.row).not.toHaveProperty(
      'image_url'
    );
  });

  it('throws instead of leaking a sender id through a missing foreign key', () => {
    const broken = records();
    broken.meal_foods[0].food_id = 'absent-food';
    expect(() =>
      planShareImport(MEAL_SHARE_SPEC, broken, {
        generateId: ids(),
        nowMs: 1,
        resolutions: { foods: { 'food-reused': 'local-existing-food' } },
      })
    ).toThrow(/references missing food_id:absent-food/);
  });
});
