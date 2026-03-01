#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Food deduplication script for JSON export data
 *
 * Usage: node deduplicate-foods.js <input-file> [output-file]
 *
 * If output-file is not specified, it will overwrite the input file
 */

// Interface definitions for better understanding
/**
 * @typedef {Object} Food
 * @property {string} id
 * @property {boolean} is_ai_generated
 * @property {string} name
 * @property {string|null} brand
 * @property {string|null} barcode
 * @property {number} calories
 * @property {number} protein
 * @property {number} carbs
 * @property {number} fat
 * @property {number} fiber
 * @property {string|null} micros_json
 * @property {boolean} is_favorite
 * @property {string} source
 * @property {string|null} image_url
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string|null} deleted_at
 */

/**
 * @typedef {Object} NutritionLog
 * @property {string} id
 * @property {string} food_id
 * @property {string} type
 * @property {number} amount
 * @property {string|null} portion_id
 * @property {string} logged_food_name
 * @property {number} logged_calories
 * @property {number} logged_protein
 * @property {number} logged_carbs
 * @property {number} logged_fat
 * @property {number} logged_fiber
 * @property {string|null} logged_micros_json
 * @property {number} date
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string|null} deleted_at
 */

/**
 * @typedef {Object} MealFood
 * @property {string} id
 * @property {string} meal_id
 * @property {string} food_id
 * @property {number} amount
 * @property {string|null} portion_id
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string|null} deleted_at
 */

/**
 * @typedef {Object} FoodFoodPortion
 * @property {string} id
 * @property {string} food_id
 * @property {string} food_portion_id
 * @property {boolean} is_default
 * @property {number} created_at
 * @property {number} updated_at
 * @property {string|null} deleted_at
 */

/**
 * @typedef {Object} DatabaseData
 * @property {Food[]} foods
 * @property {NutritionLog[]} nutrition_logs
 * @property {MealFood[]} meal_foods
 * @property {FoodFoodPortion[]} food_food_portions
 * @property {any[]} other arrays...
 */

class FoodDeduplicator {
  constructor() {
    this.duplicatesRemoved = 0;
    this.foodIdMap = new Map(); // oldFoodId -> newFoodId to keep
  }

  /**
   * Main deduplication function
   * @param {DatabaseData} data - The database data
   * @returns {DatabaseData} - Deduplicated data
   */
  deduplicateFoods(data) {
    console.log('Starting food deduplication...');

    const activeFoods = data.foods.filter((food) => food.deleted_at === null);
    console.log(`Processing ${activeFoods.length} active foods`);

    const processedGroups = new Set();

    // First pass: find duplicates by barcode (highest priority)
    console.log('Phase 1: Finding duplicates by barcode...');
    const foodsByBarcode = this.groupFoodsByBarcode(activeFoods);
    this.processBarcodeDuplicates(foodsByBarcode, processedGroups);

    // Second pass: find duplicates by nutritional profile
    console.log('Phase 2: Finding duplicates by nutritional profile...');
    const foodsByProfile = this.groupFoodsByProfile(activeFoods, processedGroups);
    this.processProfileDuplicates(foodsByProfile, processedGroups);

    // Update references and remove duplicates
    console.log('Phase 3: Updating references and removing duplicates...');
    this.updateReferencesAndRemoveDuplicates(data);

    console.log(`Deduplication complete. Removed ${this.duplicatesRemoved} duplicate foods.`);
    return data;
  }

  /**
   * Group foods by barcode
   * @param {Food[]} foods
   * @returns {Map<string, Food[]>}
   */
  groupFoodsByBarcode(foods) {
    const foodsByBarcode = new Map();

    for (const food of foods) {
      if (food.barcode) {
        if (!foodsByBarcode.has(food.barcode)) {
          foodsByBarcode.set(food.barcode, []);
        }
        foodsByBarcode.get(food.barcode).push(food);
      }
    }

    return foodsByBarcode;
  }

  /**
   * Group foods by nutritional profile
   * @param {Food[]} foods
   * @param {Set<string>} processedGroups
   * @returns {Map<string, Food[]>}
   */
  groupFoodsByProfile(foods, processedGroups) {
    const foodsByProfile = new Map();

    for (const food of foods) {
      // Skip foods already processed by barcode
      if (food.barcode && processedGroups.has(`barcode:${food.barcode}`)) {
        continue;
      }

      const profileKey = this.createFoodProfileKey(food);
      if (!foodsByProfile.has(profileKey)) {
        foodsByProfile.set(profileKey, []);
      }
      foodsByProfile.get(profileKey).push(food);
    }

    return foodsByProfile;
  }

  /**
   * Process barcode duplicates
   * @param {Map<string, Food[]>} foodsByBarcode
   * @param {Set<string>} processedGroups
   */
  processBarcodeDuplicates(foodsByBarcode, processedGroups) {
    for (const [barcode, duplicateFoods] of foodsByBarcode) {
      if (duplicateFoods.length > 1) {
        console.log(`Found ${duplicateFoods.length} duplicates with barcode: ${barcode}`);
        const foodToKeep = this.selectBestFoodToKeep(duplicateFoods);
        const foodsToDelete = duplicateFoods.filter((f) => f.id !== foodToKeep.id);

        for (const foodToDelete of foodsToDelete) {
          this.foodIdMap.set(foodToDelete.id, foodToKeep.id);
        }

        processedGroups.add(`barcode:${barcode}`);
      }
    }
  }

  /**
   * Process profile duplicates
   * @param {Map<string, Food[]>} foodsByProfile
   * @param {Set<string>} processedGroups
   */
  processProfileDuplicates(foodsByProfile, processedGroups) {
    for (const [profile, duplicateFoods] of foodsByProfile) {
      if (duplicateFoods.length > 1) {
        console.log(`Found ${duplicateFoods.length} duplicates with profile: ${profile}`);
        const foodToKeep = this.selectBestFoodToKeep(duplicateFoods);
        const foodsToDelete = duplicateFoods.filter((f) => f.id !== foodToKeep.id);

        for (const foodToDelete of foodsToDelete) {
          this.foodIdMap.set(foodToDelete.id, foodToKeep.id);
        }

        processedGroups.add(`profile:${profile}`);
      }
    }
  }

  /**
   * Create a unique key for food based on name and nutritional profile
   * @param {Food} food
   * @returns {string}
   */
  createFoodProfileKey(food) {
    const normalizedName = (food.name || '').toLowerCase().trim();
    const calories = Math.round(food.calories);
    const protein = Math.round(food.protein * 10) / 10; // Round to 1 decimal
    const carbs = Math.round(food.carbs * 10) / 10;
    const fat = Math.round(food.fat * 10) / 10;

    return `${normalizedName}|${calories}|${protein}|${carbs}|${fat}`;
  }

  /**
   * Select the best food to keep from a group of duplicates
   * @param {Food[]} duplicateFoods
   * @returns {Food}
   */
  selectBestFoodToKeep(duplicateFoods) {
    // Sort by priority: AI-generated first, then by completeness, then by creation date
    const sorted = [...duplicateFoods].sort((a, b) => {
      // AI-generated foods take priority
      if (a.is_ai_generated && !b.is_ai_generated) {
        return -1;
      }
      if (!a.is_ai_generated && b.is_ai_generated) {
        return 1;
      }

      // Prefer foods with more complete data (brand, micros, etc.)
      const aScore = this.calculateFoodCompletenessScore(a);
      const bScore = this.calculateFoodCompletenessScore(b);
      if (aScore !== bScore) {
        return bScore - aScore;
      }

      // Prefer older entries (original)
      return a.created_at - b.created_at;
    });

    return sorted[0];
  }

  /**
   * Calculate a score for food completeness
   * @param {Food} food
   * @returns {number}
   */
  calculateFoodCompletenessScore(food) {
    let score = 0;

    if (food.brand) {
      score += 2;
    }
    if (food.barcode) {
      score += 3;
    }
    if (food.micros_json && food.micros_json !== '{}' && food.micros_json !== '') {
      score += 2;
    }
    if (food.fiber > 0) {
      score += 1;
    }
    if (food.source === 'user') {
      score += 1;
    } // Prefer user-entered over unknown

    return score;
  }

  /**
   * Update all references and remove duplicates
   * @param {DatabaseData} data
   */
  updateReferencesAndRemoveDuplicates(data) {
    // Update nutrition_logs
    if (data.nutrition_logs) {
      for (const log of data.nutrition_logs) {
        if (this.foodIdMap.has(log.food_id)) {
          log.food_id = this.foodIdMap.get(log.food_id);
          log._changed = log._changed ? `${log._changed},food_id` : 'food_id';
        }
      }
    }

    // Update meal_foods
    if (data.meal_foods) {
      for (const mealFood of data.meal_foods) {
        if (this.foodIdMap.has(mealFood.food_id)) {
          mealFood.food_id = this.foodIdMap.get(mealFood.food_id);
          mealFood._changed = mealFood._changed ? `${mealFood._changed},food_id` : 'food_id';
        }
      }
    }

    // Update food_food_portions
    if (data.food_food_portions) {
      for (const foodFoodPortion of data.food_food_portions) {
        if (this.foodIdMap.has(foodFoodPortion.food_id)) {
          foodFoodPortion.food_id = this.foodIdMap.get(foodFoodPortion.food_id);
          foodFoodPortion._changed = foodFoodPortion._changed
            ? `${foodFoodPortion._changed},food_id`
            : 'food_id';
        }
      }
    }

    // Remove duplicate foods
    const originalFoodCount = data.foods.length;
    data.foods = data.foods.filter((food) => !this.foodIdMap.has(food.id));
    this.duplicatesRemoved = originalFoodCount - data.foods.length;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.error('Usage: node deduplicate-foods.js <input-file> [output-file]');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile;

  try {
    // Read input file
    console.log(`Reading input file: ${inputFile}`);
    const rawData = fs.readFileSync(inputFile, 'utf8');
    const data = JSON.parse(rawData);

    // Perform deduplication
    const deduplicator = new FoodDeduplicator();
    const deduplicatedData = deduplicator.deduplicateFoods(data);

    // Write output file
    console.log(`Writing output file: ${outputFile}`);
    fs.writeFileSync(outputFile, JSON.stringify(deduplicatedData, null, 2));

    console.log('✅ Food deduplication completed successfully!');
    console.log(`📊 Summary: ${deduplicator.duplicatesRemoved} duplicate foods removed`);
  } catch (error) {
    console.error('❌ Error during deduplication:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = FoodDeduplicator;
