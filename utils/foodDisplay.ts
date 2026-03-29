import type { Units } from '../constants/settings';
import Food from '../database/models/Food';
import { formatAppDecimal, formatAppInteger } from './formatAppNumber';
import { getMassUnitLabel, gramsToDisplay } from './unitConversion';

/**
 * Get a display string for the serving size of a food
 * Based on the food's default portion.
 * @param food
 * @param units - When 'imperial', amount is shown in oz; otherwise g.
 */
export async function getFoodServingDisplay(
  food: Food,
  units: Units = 'metric',
  locale: string = 'en-US'
): Promise<string> {
  try {
    const defaultPortion = await food.getDefaultPortionAsync();
    if (defaultPortion) {
      const display = gramsToDisplay(defaultPortion.gramWeight, units);
      const rounded = display % 1 === 0 ? display : Math.round(display * 10) / 10;
      const unit = getMassUnitLabel(units);
      const amount =
        rounded % 1 === 0
          ? formatAppInteger(locale, rounded)
          : formatAppDecimal(locale, rounded, 1);
      return `${amount} ${unit} ${defaultPortion.name}`;
    }
  } catch (error) {
    console.error('Error getting serving display:', error);
  }
  const unit = getMassUnitLabel(units);
  return units === 'imperial'
    ? `${formatAppDecimal(locale, gramsToDisplay(100, units), 1)} ${unit}`
    : `100 ${unit}`;
}

/**
 * Get a simple mass-based serving display (g or oz based on units).
 */
export function getSimpleServingDisplay(
  gramWeight: number = 100,
  units: Units = 'metric',
  locale: string = 'en-US'
): string {
  const display = gramsToDisplay(gramWeight, units);
  const rounded = display % 1 === 0 ? display : Math.round(display * 10) / 10;
  const unit = getMassUnitLabel(units);
  const amount =
    rounded % 1 === 0 ? formatAppInteger(locale, rounded) : formatAppDecimal(locale, rounded, 1);
  return `${amount} ${unit}`;
}
