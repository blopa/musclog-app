import type { Units } from '@/constants/settings';

export function getWeightUnit(units: Units): 'kg' | 'lbs' {
  return units === 'imperial' ? 'lbs' : 'kg';
}

export function getHeightUnit(units: Units): 'cm' | 'in' {
  return units === 'imperial' ? 'in' : 'cm';
}

export function getWeightUnitI18nKey(units: Units): 'workoutSession.kg' | 'workoutSession.lb' {
  return units === 'imperial' ? 'workoutSession.lb' : 'workoutSession.kg';
}

export function getMassUnit(units: Units): 'g' | 'oz' {
  return units === 'imperial' ? 'oz' : 'g';
}

export function getMassUnitI18nKey(units: Units): 'food.unitOz' | 'food.unitGrams' {
  return units === 'imperial' ? 'food.unitOz' : 'food.unitGrams';
}
