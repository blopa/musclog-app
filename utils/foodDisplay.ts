import type { Units } from '../constants/settings';
import Food from '../database/models/Food';
import { formatDisplayGrams } from './formatDisplayWeight';
import { getMassUnitLabel } from './unitConversion';

/**
 * Get a display string for the serving size of a food
 * Based on the food's default portion.
 * @param food
 * @param units - When 'imperial', amount is shown in oz; otherwise g.
 * @param locale
 */
export async function getFoodServingDisplay(
  food: Food,
  units: Units = 'metric',
  locale: string = 'en-US'
): Promise<string> {
  try {
    const defaultPortion = await food.getDefaultPortionAsync();
    if (defaultPortion) {
      const unit = getMassUnitLabel(units);
      const amount = formatDisplayGrams(locale, units, defaultPortion.gramWeight);
      return `${amount} ${unit} ${defaultPortion.name}`;
    }
  } catch (error) {
    console.error('Error getting serving display:', error);
  }
  const unit = getMassUnitLabel(units);
  return `${formatDisplayGrams(locale, units, 100)} ${unit}`;
}

/**
 * Get a simple mass-based serving display (g or oz based on units).
 */
export function getSimpleServingDisplay(
  gramWeight: number = 100,
  units: Units = 'metric',
  locale: string = 'en-US'
): string {
  const unit = getMassUnitLabel(units);
  return `${formatDisplayGrams(locale, units, gramWeight)} ${unit}`;
}
