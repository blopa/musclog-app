import { database } from '@/database/database-instance';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import { writeWorkoutToHealthConnect } from '@/services/healthConnectWorkout';
import { type CardioActivity, estimateCardioKcal, isCardioActivity } from '@/utils/cardioEnergy';
import { appExerciseId } from '@/utils/exerciseImage';
import { handleError } from '@/utils/handleError';
import { getCurrentTimezone } from '@/utils/timezone';

import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';

/**
 * The catalogue movements a quick walk/run log points at. There is no plain outdoor "walking"
 * entry in free-exercise-db; the trail one is the closest, and the treadmill entries exist for
 * both activities.
 */
const CARDIO_CATALOGUE_SLUGS = {
  outdoor: { walk: 'Trail_Running_Walking', run: 'Trail_Running_Walking' },
  treadmill: { walk: 'Walking_Treadmill', run: 'Running_Treadmill' },
} as const;
const MAX_CARDIO_DURATION_S = 24 * 60 * 60;

export interface CardioSessionInput {
  activity: CardioActivity;
  distanceM: number;
  durationS: number;
  /** When the walk or run ended; it started `durationS` earlier. */
  endedAt: number;
  /** Already localized ("Walk" / "Run"): the service has no copy of its own. */
  workoutName: string;
  treadmill?: boolean;
  caloriesOverride?: number;
}

export class CardioLogService {
  /**
   * Logs a finished walk or run in one step: no session to start, no sets to tick off.
   *
   * It writes ONE completed `workout_logs` row (`type: 'cardio'`, `activity`, `distance_m`) and one
   * `workout_log_exercises` row naming the catalogue movement — and deliberately NO sets. A set
   * is a repetition with a load; inventing "1 rep at 0 kg" to make a walk look like a lift would
   * put a fabricated performed set into volume, PRs and the set-lifecycle accounting. Every reader
   * of a log therefore has to cope with an exercise that has none, and the ones that matter do:
   * the rolling workout count is `completed_at`-based, volume/PR queries group by sets, and the
   * detail view and history card read `distance_m` for a cardio log instead.
   *
   * Calories come from the ACSM estimate unless the user read a number off a watch. The Health
   * Connect / HealthKit write is best effort and never fails the log.
   */
  static async logCardioSession(input: CardioSessionInput): Promise<WorkoutLog> {
    const { activity, distanceM, durationS, endedAt, workoutName } = input;
    if (!isCardioActivity(activity)) {
      throw new Error(`Unsupported cardio activity: ${String(activity)}`);
    }

    if (!Number.isFinite(distanceM) || distanceM <= 0) {
      throw new Error('A cardio log needs a distance greater than zero');
    }

    if (!Number.isFinite(durationS) || durationS <= 0 || durationS > MAX_CARDIO_DURATION_S) {
      throw new Error('A cardio log needs a duration between a second and 24 hours');
    }

    const bodyMassKg = await UserMetricService.getUserBodyWeightKgForVolume();
    const caloriesBurned = estimateCardioKcal({
      activity,
      distanceM,
      durationS,
      bodyMassKg,
      caloriesOverride: input.caloriesOverride,
    });
    const startedAt = endedAt - Math.round(durationS * 1000);
    const exerciseId = appExerciseId(
      CARDIO_CATALOGUE_SLUGS[input.treadmill ? 'treadmill' : 'outdoor'][activity]
    );

    const workoutLog = await database.write(async () => {
      const now = Date.now();
      const logs = database.get<WorkoutLog>('workout_logs');
      const log = logs.prepareCreate((record) => {
        record.workoutName = workoutName;
        record.templateId = undefined;
        record.type = 'cardio';
        record.activity = activity;
        record.distanceM = distanceM;
        record.startedAt = startedAt;
        record.completedAt = endedAt;
        record.timezone = getCurrentTimezone();
        record.totalVolume = 0;
        record.caloriesBurned = caloriesBurned > 0 ? caloriesBurned : undefined;
        record.exhaustionLevel = undefined;
        record.workoutScore = undefined;
        record.createdAt = now;
        record.updatedAt = now;
      });
      const logExercise = database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .prepareCreate((record) => {
          record.workoutLogId = log.id;
          record.exerciseId = exerciseId;
          record.exerciseOrder = 0;
          record.createdAt = now;
          record.updatedAt = now;
        });
      await database.batch(log, logExercise);
      return log;
    });

    try {
      const units = await SettingsService.getUnits();
      const hcRecordId = await writeWorkoutToHealthConnect({
        workoutName,
        startedAt,
        completedAt: endedAt,
        caloriesBurned: caloriesBurned > 0 ? caloriesBurned : undefined,
        workoutType: 'cardio',
        units,
        activity,
        distanceM,
      });
      if (hcRecordId) {
        await database.write(async () => {
          await workoutLog.update((record) => {
            record.externalId = hcRecordId;
          });
        });
      }
    } catch (err) {
      console.warn('Health Connect cardio write failed:', err);
      handleError(err, 'CardioLogService.logCardioSession.healthWrite');
    }

    return workoutLog;
  }
}
