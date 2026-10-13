/**
 * The platform-neutral half of writing a workout to a health store. Health Connect and HealthKit
 * each have their own activity enum, so each platform file maps `resolveHealthActivity`'s result to
 * its own constants — but WHICH activity a workout is has one definition, here, and is testable
 * without either native module.
 */
export type HealthActivity =
  'walking' | 'running' | 'strength' | 'cardio' | 'flexibility' | 'calisthenics' | 'other';

/**
 * A logged walk or run is the specific activity; anything else follows the workout type. The
 * activity wins over the type because a quick log is `type: 'cardio'` too, and generic cardio maps
 * to interval training on both platforms.
 */
export function resolveHealthActivity(
  workoutType: string | undefined,
  activity?: 'walk' | 'run'
): HealthActivity {
  if (activity === 'walk') {
    return 'walking';
  }

  if (activity === 'run') {
    return 'running';
  }

  switch (workoutType) {
    case 'strength':
    case 'cardio':
    case 'flexibility':
    case 'calisthenics':
      return workoutType;
    default:
      return 'other';
  }
}

/** Energy and distance for a health-store workout, leaving out whichever the session lacks. */
export function workoutTotals(payload: {
  caloriesBurned?: number | null;
  distanceM?: number | null;
}): { energyBurned?: number; distance?: number } | undefined {
  const totals: { energyBurned?: number; distance?: number } = {};
  if (payload.caloriesBurned != null && payload.caloriesBurned > 0) {
    totals.energyBurned = payload.caloriesBurned;
  }

  if (payload.distanceM != null && payload.distanceM > 0) {
    totals.distance = payload.distanceM;
  }

  return Object.keys(totals).length > 0 ? totals : undefined;
}
