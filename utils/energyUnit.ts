import type { EnergyUnit } from '@/constants/settings';

import { formatAppInteger } from './formatAppNumber';

/**
 * Energy is stored and computed in kilocalories everywhere. The `energy_unit` setting only changes
 * how it is SHOWN and typed, so conversion happens at the edge and nowhere else. 1 kcal is exactly
 * 4.184 kJ (the thermochemical calorie).
 */
export const KJ_PER_KCAL = 4.184;

export function kcalToKj(kcal: number): number {
  return kcal * KJ_PER_KCAL;
}

export function kjToKcal(kj: number): number {
  return kj / KJ_PER_KCAL;
}

/** Kilocalories as the number to show in `unit` (not rounded). */
export function energyToDisplay(kcal: number, unit: EnergyUnit): number {
  return unit === 'kj' ? kcalToKj(kcal) : kcal;
}

/** A number the person typed in `unit`, as the kilocalories to store (not rounded). */
export function displayToEnergyKcal(value: number, unit: EnergyUnit): number {
  return unit === 'kj' ? kjToKcal(value) : value;
}

/**
 * Whole-number amount in `unit`, formatted like `formatAppInteger` (ungrouped like every kcal count
 * for grouping; no unit label).
 * Display only; never persist the string.
 */
export function formatEnergyAmount(
  locale: string,
  kcal: number,
  unit: EnergyUnit,
  options?: Intl.NumberFormatOptions
): string {
  return formatAppInteger(locale, Math.round(energyToDisplay(kcal, unit)), options);
}

/**
 * Typed energy that was shown rounded: the stored kcal if the person did not change the field,
 * otherwise the converted entry. Without this, opening a goal and saving it unchanged would round
 * trip kcal → kJ → kcal and drift by a calorie.
 */
export function energyKcalAfterEdit(
  originalKcal: number,
  enteredDisplayValue: number,
  unit: EnergyUnit
): number {
  if (Math.round(energyToDisplay(originalKcal, unit)) === Math.round(enteredDisplayValue)) {
    return originalKcal;
  }

  return Math.round(displayToEnergyKcal(enteredDisplayValue, unit));
}
