import { planShareImport } from '@/utils/share/shareImportPlan';
import { MEAL_SHARE_SPEC, NUTRITION_DAY_SHARE_SPEC } from '@/utils/share/shareKinds';

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

  it('strips columns the table does not declare, so a crafted row cannot reach the model', () => {
    // Everything that survives planning is handed to WatermelonDB's raw-record sanitizer. The
    // allowlist remains the app-level trust boundary: a remote phone may only control the columns
    // this share kind deliberately exposes.
    const hostile = records();
    Object.assign(hostile.foods[0], {
      __proto__: { polluted: true },
      _raw: { id: 'spoofed' },
      collection: 'hijacked',
      mark_as_deleted: 1,
      unknown_future_column: 'from a newer app version',
    });

    const plan = planShareImport(MEAL_SHARE_SPEC, hostile, {
      generateId: ids(),
      nowMs: 1,
      resolutions: { foods: { 'food-reused': 'local-existing-food' } },
    });
    const food = plan.creates.find((item) => item.sourceId === 'food-created')?.row;

    expect(food).toBeDefined();
    for (const key of ['_raw', 'collection', 'mark_as_deleted', 'unknown_future_column']) {
      expect(food).not.toHaveProperty(key);
    }
    // The legitimate columns still come through — this is a filter, not a rejection.
    expect(food).toMatchObject({ calories: 100, name: 'Created food' });
    expect(Object.prototype.hasOwnProperty.call({}, 'polluted')).toBe(false);
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

  describe('a kind with no root row', () => {
    const dayRecords = () => ({
      food_portions: [],
      food_food_portions: [],
      foods: [{ calories: 100, id: 'food-1', name: 'Oats' }],
      nutrition_logs: [
        { amount: 80, date: 10, food_id: 'food-1', group_id: 'sender-meal', id: 'log-1' },
        { amount: 40, date: 10, food_id: 'food-1', group_id: 'sender-meal', id: 'log-2' },
        { amount: 20, date: 10, food_id: 'food-1', group_id: 'sender-other', id: 'log-3' },
        { amount: 10, date: 10, food_id: 'food-1', id: 'log-4' },
      ],
    });

    it('plans the whole graph and returns no root id', () => {
      const plan = planShareImport(NUTRITION_DAY_SHARE_SPEC, dayRecords(), {
        generateId: ids(),
        nowMs: 1,
      });

      // A day of eating is not a record, so there is nothing to be "about" — and nothing to fail
      // on either, which is what the rooted kinds do when their root is missing.
      expect(plan.rootId).toBeUndefined();
      expect(plan.creates.filter((item) => item.table === 'nutrition_logs')).toHaveLength(4);
    });

    it('mints one new group id per distinct incoming group', () => {
      const plan = planShareImport(NUTRITION_DAY_SHARE_SPEC, dayRecords(), {
        generateId: ids(),
        nowMs: 1,
      });
      const groups = plan.creates
        .filter((item) => item.table === 'nutrition_logs')
        .map((item) => item.row.group_id);

      // Entries logged as one meal stay one meal; a different group stays different; and no id the
      // sender chose survives, since it may name a `meals` row that means something else here.
      expect(groups[0]).toBe(groups[1]);
      expect(groups[2]).not.toBe(groups[0]);
      expect(groups[3]).toBeUndefined();
      expect(groups).not.toContain('sender-meal');
    });

    it('never mints a group id that collides with a row id', () => {
      const plan = planShareImport(NUTRITION_DAY_SHARE_SPEC, dayRecords(), {
        generateId: ids(),
        nowMs: 1,
      });
      const rowIds = plan.creates.map((item) => item.localId);
      const groups = plan.creates
        .filter((item) => item.table === 'nutrition_logs')
        .map((item) => item.row.group_id)
        .filter(Boolean);

      for (const group of groups) {
        expect(rowIds).not.toContain(group);
      }
    });
  });
});
