import { addColumns, createTable, unsafeExecuteSql } from '@nozbe/watermelondb/Schema/migrations';

const migrationV15 = {
  toVersion: 15,
  steps: [
    addColumns({
      table: 'foods',
      columns: [{ name: 'nutrition_basis', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'nutrition_logs',
      columns: [{ name: 'snapshot_basis', type: 'string', isOptional: true }],
    }),
    addColumns({
      table: 'food_portions',
      columns: [
        { name: 'kind', type: 'string', isOptional: true },
        { name: 'scope', type: 'string', isOptional: true },
        { name: 'owner_type', type: 'string', isOptional: true },
        { name: 'owner_id', type: 'string', isOptional: true, isIndexed: true },
      ],
    }),
    unsafeExecuteSql('ALTER TABLE food_portions ADD COLUMN gram_weight_temp REAL;'),
    unsafeExecuteSql(
      'UPDATE food_portions SET gram_weight_temp = gram_weight WHERE gram_weight IS NOT NULL;'
    ),
    unsafeExecuteSql('ALTER TABLE food_portions DROP COLUMN gram_weight;'),
    unsafeExecuteSql('ALTER TABLE food_portions ADD COLUMN gram_weight REAL;'),
    unsafeExecuteSql(
      'UPDATE food_portions SET gram_weight = gram_weight_temp WHERE gram_weight_temp IS NOT NULL;'
    ),
    unsafeExecuteSql('ALTER TABLE food_portions DROP COLUMN gram_weight_temp;'),
    addColumns({
      table: 'meals',
      columns: [
        { name: 'nutrition_basis', type: 'string', isOptional: true },
        { name: 'recipe_servings_count', type: 'number', isOptional: true },
        { name: 'default_portion_name', type: 'string', isOptional: true },
        { name: 'serving_grams', type: 'number', isOptional: true },
      ],
    }),
    createTable({
      name: 'meal_food_portions',
      columns: [
        { name: 'meal_id', type: 'string', isIndexed: true },
        { name: 'food_portion_id', type: 'string', isIndexed: true },
        { name: 'is_default', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
    unsafeExecuteSql(
      "UPDATE foods SET nutrition_basis = 'per_100g' WHERE nutrition_basis IS NULL;"
    ),
    unsafeExecuteSql(
      "UPDATE nutrition_logs SET snapshot_basis = 'per_100g' WHERE snapshot_basis IS NULL;"
    ),
    unsafeExecuteSql(
      "UPDATE meals SET nutrition_basis = 'per_recipe', recipe_servings_count = 1 WHERE nutrition_basis IS NULL;"
    ),
    unsafeExecuteSql(
      "UPDATE food_portions SET source = 'basic' WHERE source = 'app' OR source IS NULL OR source = '';"
    ),
    unsafeExecuteSql("UPDATE food_portions SET source = 'custom' WHERE source = 'user';"),
    unsafeExecuteSql("UPDATE food_portions SET kind = 'mass' WHERE kind IS NULL;"),
    unsafeExecuteSql(
      "UPDATE food_portions SET scope = CASE WHEN source = 'basic' THEN 'global' ELSE 'private' END WHERE scope IS NULL;"
    ),
  ],
};

export default migrationV15;
