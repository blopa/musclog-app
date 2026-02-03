import Food from '../database/models/Food';

/**
 * Get a display string for the serving size of a food
 * Based on the food's default portion
 */
export async function getFoodServingDisplay(food: Food): Promise<string> {
  try {
    const defaultPortion = await food.getDefaultPortion();
    if (defaultPortion) {
      // Format as "100 g" or "1 Slice" etc.
      return `${Math.round(defaultPortion.gramWeight)} ${defaultPortion.name}`;
    }
  } catch (error) {
    console.error('Error getting serving display:', error);
  }
  // Fallback
  return '100 g';
}

/**
 * Get a simple gram-based serving display
 */
export function getSimpleServingDisplay(gramWeight: number = 100): string {
  return `${Math.round(gramWeight)} g`;
}
