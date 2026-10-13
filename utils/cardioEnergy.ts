/**
 * Calories burned by a steady walk or run, from the ACSM metabolic equations for level ground:
 *
 *   walking: VO2 = 0.1 · speed + 3.5      running: VO2 = 0.2 · speed + 3.5
 *
 * with speed in metres per minute and VO2 in ml/kg/min. Energy is VO2 × body mass × minutes, and one
 * litre of oxygen releases about 5 kcal. The 3.5 term is resting metabolism (1 MET), so this is a
 * GROSS figure: it includes what the body would have spent sitting still. That is the figure a watch
 * reports and the one Health Connect stores for a session; the app's daily energy balance is
 * TDEE-based and never adds workout calories on top, so a gross figure cannot double-count.
 *
 * The equations are valid for level ground at walking (about 50–100 m/min) and running
 * (above about 134 m/min) speeds. There is no incline term. A "walk" faster than the model's range
 * is still computed with the walking equation: the user said what they did, and silently switching
 * equations would make the result jump around a threshold.
 *
 * Source: ACSM's Guidelines for Exercise Testing and Prescription, metabolic calculations.
 */
export type CardioActivity = 'walk' | 'run';

const ML_O2_PER_KG_MIN_REST = 3.5;
const KCAL_PER_LITRE_O2 = 5;
const WALK_COEFFICIENT = 0.1;
const RUN_COEFFICIENT = 0.2;

export interface CardioEnergyInput {
  activity: CardioActivity;
  distanceM: number;
  durationS: number;
  bodyMassKg: number;
  /** Calories the user read off a watch. When given it wins over the estimate. */
  caloriesOverride?: number;
}

export function isCardioActivity(value: unknown): value is CardioActivity {
  return value === 'walk' || value === 'run';
}

/** Average speed in metres per minute, or 0 when it cannot be computed. */
export function averageSpeedMetersPerMinute(distanceM: number, durationS: number): number {
  if (!(distanceM > 0) || !(durationS > 0)) {
    return 0;
  }

  return distanceM / (durationS / 60);
}

/** Whole kilocalories, or 0 when the inputs cannot support an estimate. */
export function estimateCardioKcal({
  activity,
  distanceM,
  durationS,
  bodyMassKg,
  caloriesOverride,
}: CardioEnergyInput): number {
  if (caloriesOverride !== undefined && Number.isFinite(caloriesOverride) && caloriesOverride > 0) {
    return Math.round(caloriesOverride);
  }

  if (!(bodyMassKg > 0) || !(durationS > 0)) {
    return 0;
  }

  const speed = averageSpeedMetersPerMinute(distanceM, durationS);
  const coefficient = activity === 'run' ? RUN_COEFFICIENT : WALK_COEFFICIENT;
  const vo2 = coefficient * speed + ML_O2_PER_KG_MIN_REST;
  const minutes = durationS / 60;
  const kcal = ((vo2 * bodyMassKg * minutes) / 1000) * KCAL_PER_LITRE_O2;
  return Math.round(kcal);
}
