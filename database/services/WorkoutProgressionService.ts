import { type Model, Q } from '@nozbe/watermelondb';

import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import type WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import type WorkoutTemplateSet from '@/database/models/WorkoutTemplateSet';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';
import { isBarLoadedEquipment } from '@/utils/gym';
import { loadStepFor } from '@/utils/loadIncrement';
import { platesPerSide } from '@/utils/plateCalculator';
import {
  type ExerciseRecommendation,
  progressesLoad,
  projectExerciseProgression,
} from '@/utils/progressionProjection';
import {
  type HistorySession,
  parseProgressionRule,
  parseSessionProgressionState,
  PROGRESSION_HISTORY_SESSIONS,
  serializeSessionProgression,
} from '@/utils/progressionRules';
import {
  parseStartAdjustment,
  revertTargetFor,
  serializeStartAdjustment,
} from '@/utils/setAdjustment';
import { parseSetPrescription, serializeSetPrescription } from '@/utils/setPrescription';
import {
  isPerformedWorkoutSet,
  isPlannedWorkoutSet,
  isWarmupSet,
} from '@/utils/workoutSetCompletion';

import { ExerciseUserSettingsService } from './ExerciseUserSettingsService';
import { GymService } from './GymService';
import { SettingsService } from './SettingsService';

/**
 * How many past log exercises are read before ordering by when their workout happened. Wider than
 * the sessions a rule looks back over, so a few late-written rows cannot push the real latest
 * sessions out of the window.
 */
const HISTORY_CANDIDATE_WINDOW = PROGRESSION_HISTORY_SESSIONS * 4;

export type TemplateRecommendation = ExerciseRecommendation & {
  templateExerciseId: string;
  exercise: Exercise;
};

export class WorkoutProgressionService {
  /** Add/Swap use the same completed history and projection as previews and session starts. */
  static async projectAdHocExercise(exercise: Exercise): Promise<ExerciseRecommendation | null> {
    const [history, context] = await Promise.all([this.history(exercise.id), this.context()]);
    if (!history[0]?.sets.length) {
      return null;
    }
    return projectExerciseProgression({
      planned: history[0].sets.map((set, index) => ({
        id: String(index),
        weight: set.weightKg,
        reps: set.reps,
      })),
      history,
      rule: null,
      step: loadStepFor(exercise.equipmentType, context.gym, context.unitsFor(exercise.id)),
      automatic: context.automatic,
      progressionMode: context.mode,
      isCompound: exercise.mechanicType === 'compound',
      isBodyweight: exercise.equipmentType === 'bodyweight',
      mechanicType: exercise.mechanicType,
      plannedFromHistory: true,
    });
  }

  static async projectTemplate(templateId: string): Promise<TemplateRecommendation[]> {
    const rows = await database
      .get<WorkoutTemplateExercise>('workout_template_exercises')
      .query(
        Q.where('template_id', templateId),
        Q.where('deleted_at', Q.eq(null)),
        Q.sortBy('exercise_order', Q.asc)
      )
      .fetch();
    const sets = await fetchByIds<WorkoutTemplateSet>(
      'workout_template_sets',
      'template_exercise_id',
      rows.map((row) => row.id),
      Q.where('deleted_at', Q.eq(null))
    );
    const context = await this.context();
    const exercises = await fetchMapByIds<Exercise>(
      'exercises',
      'id',
      rows.map((row) => row.exerciseId)
    );
    return (
      await Promise.all(
        rows.map(async (row) => {
          const exercise = exercises.get(row.exerciseId);
          if (!exercise) {
            return null;
          }
          const history = await this.history(
            row.exerciseId,
            undefined,
            parseProgressionRule(row.progressionJson) ? row.id : undefined
          );
          const planned = sets
            .filter((set) => set.templateExerciseId === row.id && !isWarmupSet(set))
            .sort((a, b) => a.setOrder - b.setOrder)
            .map((set) => ({ id: set.id, weight: set.targetWeight, reps: set.targetReps }));
          const projection = projectExerciseProgression({
            planned,
            history,
            rule: parseProgressionRule(row.progressionJson),
            step: loadStepFor(exercise.equipmentType, context.gym, context.unitsFor(exercise.id)),
            automatic: context.automatic,
            progressionMode: context.mode,
            isCompound: exercise.mechanicType === 'compound',
            isBodyweight: exercise.equipmentType === 'bodyweight',
            mechanicType: exercise.mechanicType,
          });
          if (
            context.gym &&
            isBarLoadedEquipment(exercise.equipmentType) &&
            projection.sets.some((set) => {
              const load = platesPerSide(set.weight, context.gym!);
              return load.belowBar || load.remainderKg > 0.05;
            })
          ) {
            projection.status = 'attention';
          }
          return { ...projection, templateExerciseId: row.id, exercise };
        })
      )
    ).filter((row): row is TemplateRecommendation => row !== null);
  }

  private static async context() {
    const [autonomy, mode, gym] = await Promise.all([
      SettingsService.getWorkoutAutonomy(),
      SettingsService.getProgressionMode(),
      GymService.getActiveGym().catch(() => null),
    ]);
    return {
      automatic: autonomy === 'suggest',
      mode,
      gym,
      unitsFor: await ExerciseUserSettingsService.getWeightUnitsResolver(gym),
    };
  }

  static async applyStartProgression(workoutLogId: string): Promise<number> {
    const logExercises = await this.liveLogExercises(workoutLogId);
    const context = await this.context();
    if (
      !context.automatic &&
      !logExercises.some((row) => parseProgressionRule(row.progressionJson))
    ) {
      return 0;
    }
    const histories = await Promise.all(
      logExercises.map((row) =>
        this.history(
          row.exerciseId,
          workoutLogId,
          parseProgressionRule(row.progressionJson) ? row.templateExerciseId : undefined
        )
      )
    );
    if (
      !histories.some((history) => history.length) &&
      !logExercises.some((row) => parseProgressionRule(row.progressionJson))
    ) {
      return 0;
    }
    const exercises = await fetchMapByIds<Exercise>(
      'exercises',
      'id',
      logExercises.map((row) => row.exerciseId)
    );
    return database.write(async () => {
      const sets = await fetchByIds<WorkoutLogSet>(
        'workout_log_sets',
        'log_exercise_id',
        logExercises.map((row) => row.id),
        Q.where('deleted_at', Q.eq(null))
      );
      if (
        sets.some(
          (set) =>
            !isPlannedWorkoutSet(set) ||
            set.adjustmentJson ||
            parseSetPrescription(set.prescriptionJson)?.established
        )
      ) {
        return 0;
      }
      const operations: Model[] = [];
      let changed = 0;
      await commitPrepared(database, [...sets, ...logExercises], () => {
        for (const [index, row] of logExercises.entries()) {
          const exercise = exercises.get(row.exerciseId);
          if (!exercise || !progressesLoad(exercise.mechanicType)) {
            continue;
          }
          const planned = sets
            .filter((set) => set.logExerciseId === row.id && !isWarmupSet(set))
            .sort((a, b) => a.setOrder - b.setOrder);
          const rule = parseProgressionRule(row.progressionJson);
          const projection = projectExerciseProgression({
            planned: planned.map((set) => ({ id: set.id, weight: set.weight, reps: set.reps })),
            history: histories[index],
            rule,
            step: loadStepFor(exercise.equipmentType, context.gym, context.unitsFor(exercise.id)),
            automatic: context.automatic,
            progressionMode: context.mode,
            isCompound: exercise.mechanicType === 'compound',
            isBodyweight: exercise.equipmentType === 'bodyweight',
            mechanicType: exercise.mechanicType,
          });
          const changes = new Map(projection.changes.map((change) => [change.setId, change]));
          changed += changes.size;
          for (const [setIndex, set] of planned.entries()) {
            const change = changes.get(set.id);
            const plan = { weightKg: set.weight, reps: set.reps };
            operations.push(
              set.prepareUpdate((record) => {
                record.prescriptionJson = serializeSetPrescription({
                  established: true,
                  workingSetCount: planned.length,
                  plan,
                  recommendation: change?.adjustment.now ?? plan,
                  explanation: change?.adjustment,
                  previous: histories[index][0]?.sets.find(
                    (entry, i) => (entry.prescribedIndex ?? i) === setIndex
                  ),
                });
                if (change) {
                  record.weight = change.weightKg;
                  record.reps = change.reps;
                  record.adjustmentJson = serializeStartAdjustment(change.adjustment);
                }
                record.updatedAt = Date.now();
              })
            );
          }
          if (rule && projection.state) {
            operations.push(
              row.prepareUpdate((record) => {
                record.progressionJson = serializeSessionProgression(rule, projection.state);
                record.updatedAt = Date.now();
              })
            );
          }
        }
        return operations;
      });
      return changed;
    });
  }

  static async revertStartAdjustment(logExerciseId: string): Promise<number> {
    return database.write(async () => {
      const sets = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('log_exercise_id', logExerciseId), Q.where('deleted_at', Q.eq(null)))
        .fetch();
      const operations: Model[] = [];
      await commitPrepared(database, sets, () => {
        for (const set of sets) {
          if (!isPlannedWorkoutSet(set)) {
            continue;
          }
          const prescription = parseSetPrescription(set.prescriptionJson);
          const adjustment = parseStartAdjustment(set.adjustmentJson);
          if (!prescription && !adjustment) {
            continue;
          }
          const target = prescription?.plan ?? revertTargetFor(adjustment!);
          operations.push(
            set.prepareUpdate((record) => {
              record.weight = target.weightKg;
              record.reps = target.reps;
              record.adjustmentJson = undefined;
              record.prescriptionJson = serializeSetPrescription({
                ...(prescription ?? {
                  plan: adjustment!.plan,
                  recommendation: adjustment!.now,
                  explanation: adjustment!,
                }),
                established: true,
                override: 'plan',
              });
              record.updatedAt = Date.now();
            })
          );
        }
        return operations;
      });
      return operations.length;
    });
  }

  private static liveLogExercises(id: string): Promise<WorkoutLogExercise[]> {
    return database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(Q.where('workout_log_id', id), Q.where('deleted_at', Q.eq(null)))
      .fetch();
  }

  private static async history(
    exerciseId: string,
    excludeId?: string,
    templateExerciseId?: string
  ): Promise<HistorySession[]> {
    const candidates = await database
      .get<WorkoutLogExercise>('workout_log_exercises')
      .query(
        Q.where('exercise_id', exerciseId),
        Q.where('deleted_at', Q.eq(null)),
        ...(excludeId ? [Q.where('workout_log_id', Q.notEq(excludeId))] : []),
        ...(templateExerciseId ? [Q.where('template_exercise_id', templateExerciseId)] : []),
        Q.on('workout_logs', [
          Q.where('completed_at', Q.notEq(null)),
          Q.where('deleted_at', Q.eq(null)),
        ]),
        Q.sortBy('created_at', Q.desc),
        Q.take(HISTORY_CANDIDATE_WINDOW)
      )
      .fetch();
    // "Last session" means the last workout, not the last row written: an exercise added to an old
    // workout afterwards (the past-workout editor) has a fresh `created_at`, and a join cannot be
    // sorted on in SQL, so the window is read wider and ordered by the parent's completion time.
    const logs = await fetchMapByIds<WorkoutLog>(
      'workout_logs',
      'id',
      candidates.map((row) => row.workoutLogId)
    );
    const happenedAt = (row: WorkoutLogExercise) =>
      logs.get(row.workoutLogId)?.completedAt ?? row.createdAt ?? 0;
    const recent = [...candidates]
      .sort((a, b) => happenedAt(b) - happenedAt(a))
      .slice(0, PROGRESSION_HISTORY_SESSIONS);
    // One query for every session's sets, not one per session.
    const allSets = await fetchByIds<WorkoutLogSet>(
      'workout_log_sets',
      'log_exercise_id',
      recent.map((row) => row.id),
      Q.where('deleted_at', Q.eq(null))
    );
    const sessions = recent.map((row) => {
      const working = allSets
        .filter((set) => set.logExerciseId === row.id && !isWarmupSet(set))
        .sort((a, b) => a.setOrder - b.setOrder);
      return {
        sets: working.filter(isPerformedWorkoutSet).map((set) => ({
          weightKg: set.weight,
          reps: set.reps,
          repsInReserve: set.repsInReserve,
          rirRecorded: set.rirRecorded,
          prescribedIndex: working.indexOf(set),
        })),
        allPrescribedSetsPerformed:
          working.length > 0 &&
          working.every(isPerformedWorkoutSet) &&
          working.length >=
            Math.max(
              ...working.map(
                (set) =>
                  parseSetPrescription(set.prescriptionJson)?.workingSetCount ?? working.length
              )
            ),
        rule: parseProgressionRule(row.progressionJson),
        state: parseSessionProgressionState(row.progressionJson),
      };
    });
    return sessions.filter((session) => session.sets.length > 0);
  }
}
