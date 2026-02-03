import { Database } from '@nozbe/watermelondb';

import Food from './models/Food';
import FoodPortion from './models/FoodPortion';

/**
 * Migration v1 -> v2: Move serving_unit and serving_amount to food_portions
 * This creates a default portion for each food based on the old serving fields
 */
export async function migrateV1toV2(database: Database): Promise<void> {
  const foodsTable = database.get<Food>('foods');
  const portionsTable = database.get<FoodPortion>('food_portions');

  // Get all foods (including soft-deleted)
  const allFoods = await foodsTable.query().fetch();

  // For each food, create a default portion if it doesn't already have one
  for (const food of allFoods) {
    // Check if this food already has any portions
    const existingPortions = await food.portions.fetch();

    if (existingPortions.length === 0) {
      // Create a default portion based on the old serving_unit and serving_amount
      // We'll do this in a single write transaction
      await database.write(async () => {
        // Re-fetch the food in this transaction to avoid stale data
        const foodInTx = await foodsTable.find(food.id);

        // Get the old serving values from the model
        // After the schema migration, these fields no longer exist on new records,
        // but existing records may still have them in the raw data
        const servingAmount = (foodInTx as any).servingAmount ?? 100;
        const servingUnit = (foodInTx as any).servingUnit ?? 'g';

        // Convert to grams if needed
        let gramWeight = servingAmount;
        if (servingUnit === 'oz') {
          gramWeight = servingAmount * 28.3495; // TODO: move this to a funcion with conversion stuff
        } else if (servingUnit === 'ml') {
          // For ml, assume 1:1 with grams (water assumption)
          gramWeight = servingAmount;
        }
        // For 'g' or other units, assume gramWeight = servingAmount

        // Create the default portion
        await portionsTable.create((portion) => {
          portion.foodId = foodInTx.id;
          portion.name = 'Default';
          portion.gramWeight = gramWeight;
          portion.createdAt = Date.now();
          portion.updatedAt = Date.now();
        });
      });
    }
  }
}
