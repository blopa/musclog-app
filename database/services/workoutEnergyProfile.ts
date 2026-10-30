import { UserMetricService } from '@/database/services/UserMetricService';
import { UserService } from '@/database/services/UserService';
import type { WorkoutEnergyProfile } from '@/utils/workoutKcalEstimate';

/** Height assumed when none is on file, so a missing height does not block the estimate. */
const FALLBACK_HEIGHT_CM = 175;

/**
 * The body the energy estimate is for: the current user's latest weight and height. Null when
 * there is no user or no weight on file, since the estimate is meaningless without them.
 */
export async function loadWorkoutEnergyProfile(): Promise<WorkoutEnergyProfile | null> {
  const [user, weightKg, heightCm] = await Promise.all([
    UserService.getCurrentUser(),
    UserMetricService.getLatestWeightKg(),
    UserMetricService.getLatestHeightCm(),
  ]);

  if (!user || !(weightKg != null && weightKg > 0)) {
    return null;
  }

  const resolvedHeightCm = heightCm ?? FALLBACK_HEIGHT_CM;
  return resolvedHeightCm > 0
    ? { weightKg, heightCm: resolvedHeightCm, gender: user.gender || 'other' }
    : null;
}
