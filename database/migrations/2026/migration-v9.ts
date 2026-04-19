import { unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV9 = {
  toVersion: 9,
  steps: [
    // Clean up orphan meal_foods and food_food_portions that reference
    // deleted or missing foods/food_portions. Prevents WatermelonDB relation errors.
    // meal_foods: soft-delete rows with invalid food_id (null, empty, soft-deleted, or missing)
    unsafeExecuteSql(
      "UPDATE meal_foods SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_id IS NULL OR food_id = '' OR food_id IN (SELECT id FROM foods WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM foods WHERE foods.id = meal_foods.food_id));"
    ),
    // meal_foods: soft-delete rows with invalid portion_id (empty, soft-deleted, or missing)
    unsafeExecuteSql(
      "UPDATE meal_foods SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND portion_id IS NOT NULL AND (portion_id = '' OR portion_id IN (SELECT id FROM food_portions WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM food_portions WHERE food_portions.id = meal_foods.portion_id));"
    ),
    // food_food_portions: soft-delete rows with invalid food_id
    unsafeExecuteSql(
      "UPDATE food_food_portions SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_id IS NULL OR food_id = '' OR food_id IN (SELECT id FROM foods WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM foods WHERE foods.id = food_food_portions.food_id));"
    ),
    // food_food_portions: soft-delete rows with invalid food_portion_id
    unsafeExecuteSql(
      "UPDATE food_food_portions SET deleted_at = strftime('%s', 'now') * 1000 WHERE deleted_at IS NULL AND (food_portion_id IS NULL OR food_portion_id = '' OR food_portion_id IN (SELECT id FROM food_portions WHERE deleted_at IS NOT NULL) OR NOT EXISTS (SELECT 1 FROM food_portions WHERE food_portions.id = food_food_portions.food_portion_id));"
    ),
  ],
};

export default migrationV9;
