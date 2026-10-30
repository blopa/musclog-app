import { type Model, Q } from '@nozbe/watermelondb';

import { SETTINGS } from '@/constants/settingDefinitions';
import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import { selectRetargets } from '@/utils/intraSessionRetarget';
import { loadStepFor } from '@/utils/loadIncrement';
import { progressesLoad } from '@/utils/progressionProjection';
import { parseProgressionRule } from '@/utils/progressionRuleSchema';
import { computeIntraSessionAdjustment, parseStartAdjustment } from '@/utils/setAdjustment';
import { writeSetEffort } from '@/utils/setEffort';
import { parseSetPrescription, serializeSetPrescription } from '@/utils/setPrescription';
import {
  assertValidWorkoutSetDifficultyLevel,
  isWarmupSet,
  type WorkoutSetCompletionStatus,
} from '@/utils/workoutSetCompletion';

import { ExerciseUserSettingsService } from './ExerciseUserSettingsService';
import { GymService } from './GymService';
import { SettingsService } from './SettingsService';
import { UserMetricService } from './UserMetricService';

export type SessionSetValues = {
  weight: number;
  reps: number;
  partials?: number;
  repsInReserve?: number;
  difficultyLevel?: number;
  manual?: boolean;
};

/** Both workout views commit through this writer; UI components never calculate progression. */
export class WorkoutSessionService {
  static async saveSet(
    logId: string,
    setId: string,
    status: WorkoutSetCompletionStatus,
    values?: SessionSetValues
  ): Promise<void> {
    if (
      values &&
      (!Number.isFinite(values.weight) ||
        values.weight < 0 ||
        !Number.isInteger(values.reps) ||
        values.reps < 0 ||
        values.reps > 999)
    ) {
      throw new Error('Invalid set values');
    }

    if (
      values?.partials != null &&
      (!Number.isInteger(values.partials) || values.partials < 0 || values.partials > 999)
    ) {
      throw new Error('Invalid partial reps');
    }

    if (
      values?.repsInReserve != null &&
      (!Number.isFinite(values.repsInReserve) ||
        values.repsInReserve < 0 ||
        values.repsInReserve > 10)
    ) {
      throw new Error('Invalid effort');
    }

    if (values?.difficultyLevel != null) {
      assertValidWorkoutSetDifficultyLevel(values.difficultyLevel);
    }

    const [gym, mode, autonomy, bodyWeightKg] = await Promise.all([
      GymService.getActiveGym().catch(() => null),
      SettingsService.getProgressionMode(),
      SettingsService.get(SETTINGS.workoutAutonomy),
      UserMetricService.getUserBodyWeightKgForVolume(),
    ]);
    const unitsFor = await ExerciseUserSettingsService.getWeightUnitsResolver(gym);
    await database.write(async () => {
      const log = await database.get<WorkoutLog>('workout_logs').find(logId);
      const set = await database.get<WorkoutLogSet>('workout_log_sets').find(setId);
      const block = await database
        .get<WorkoutLogExercise>('workout_log_exercises')
        .find(set.logExerciseId);
      if (log.completedAt || log.deletedAt || set.deletedAt || block.workoutLogId !== logId) {
        throw new Error('Session is no longer editable');
      }

      const siblings = (
        await database
          .get<WorkoutLogSet>('workout_log_sets')
          .query(
            Q.where('log_exercise_id', block.id),
            Q.where('deleted_at', Q.eq(null)),
            Q.sortBy('set_order', Q.asc)
          )
          .fetch()
      ).filter((row) => !isWarmupSet(row));
      const exercise = await database.get<Exercise>('exercises').find(block.exerciseId);
      const rule = parseProgressionRule(block.progressionJson);
      const previousPrescription = parseSetPrescription(set.prescriptionJson);
      const start = parseStartAdjustment(set.adjustmentJson);
      const prescription = previousPrescription ?? {
        established: true,
        plan: start?.plan ?? { weightKg: set.weight, reps: set.reps },
        recommendation: start?.now ?? { weightKg: set.weight, reps: set.reps },
        explanation: start ?? undefined,
      };
      await commitPrepared(database, [log, ...siblings, ...(isWarmupSet(set) ? [set] : [])], () => {
        const operations: Model[] = [
          set.prepareUpdate((record) => {
            if (values) {
              record.weight = values.weight;
              record.reps = values.reps;
              record.partials = values.partials ?? record.partials;
              writeSetEffort(record, values.repsInReserve);
              record.difficultyLevel = values.difficultyLevel;
              if (values.manual) {
                prescription.override = 'manual';
              }
            }

            record.prescriptionJson = serializeSetPrescription(prescription);
            record.completionStatus = status;
            record.updatedAt = Date.now();
          }),
          log.prepareUpdate((record) => {
            record.updatedAt = Date.now();
          }),
        ];
        // The same eligibility as the session start: stretching, mobility and cardio are done as
        // prescribed, so a performed set never moves the next one.
        const retarget = progressesLoad(exercise.mechanicType)
          ? selectRetargets({ set, status, siblings, rule, autonomy })
          : null;
        for (const target of retarget?.targets ?? []) {
          const adjusted = computeIntraSessionAdjustment({
            previousSet: retarget!.previous,
            plannedSet: target,
            rule,
            previousIsTopSet: retarget!.previousIsTopSet,
            progressionMode: mode,
            isBodyweight: exercise.equipmentType === 'bodyweight',
            bodyWeightKg,
            roundLoad: loadStepFor(exercise.equipmentType, gym, unitsFor(exercise.id)).roundLoad,
          });
          const original = parseSetPrescription(target.prescriptionJson) ?? {
            plan: { weightKg: target.weight, reps: target.reps },
            recommendation: { weightKg: target.weight, reps: target.reps },
          };
          operations.push(
            target.prepareUpdate((record) => {
              record.weight = adjusted.weight;
              record.reps = adjusted.reps;
              record.prescriptionJson = serializeSetPrescription({
                ...original,
                established: true,
                intraAdjustment: adjusted.adjustment ?? undefined,
              });
              record.updatedAt = Date.now();
            })
          );
        }

        return operations;
      });
    });
  }
}
