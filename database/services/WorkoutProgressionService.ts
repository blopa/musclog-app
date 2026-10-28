import { type Model, Q } from '@nozbe/watermelondb';

import { SETTINGS } from '@/constants/settingDefinitions';
import type { Units } from '@/constants/settings';
import { commitPrepared } from '@/database/commitPrepared';
import { database } from '@/database/database-instance';
import type Exercise from '@/database/models/Exercise';
import type WorkoutLog from '@/database/models/WorkoutLog';
import type WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import type WorkoutLogSet from '@/database/models/WorkoutLogSet';
import type WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import type WorkoutTemplateSet from '@/database/models/WorkoutTemplateSet';
import { prepareSoftDelete } from '@/database/prepareSoftDelete';
import { fetchByIds, fetchMapByIds } from '@/database/queryByIds';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { localDayStartMs } from '@/utils/calendarDate';
import { currentWorkoutRamp, type WorkoutRamp } from '@/utils/comeback/comebackProgram';
import { tracksWorkouts } from '@/utils/comeback/comebackState';
import { type GymSnapshot, isBarLoadedEquipment } from '@/utils/gym';
import { loadStepFor } from '@/utils/loadIncrement';
import { platesPerSide } from '@/utils/plateCalculator';
import {
  type ExerciseRecommendation,
  progressesLoad,
  projectExerciseProgression,
} from '@/utils/progressionProjection';
import {
  carriedSessionState,
  counterpartAt,
  type HistorySession,
  type HistorySet,
} from '@/utils/progressionRules';
import {
  parseProgressionRule,
  parseSessionProgressionState,
  PROGRESSION_HISTORY_SESSIONS,
  type ProgressionRule,
  type ProgressionSessionState,
  serializeSessionProgression,
} from '@/utils/progressionRuleSchema';
import {
  parseStartAdjustment,
  revertTargetFor,
  serializeStartAdjustment,
} from '@/utils/setAdjustment';
import { parseSetPrescription, serializeSetPrescription } from '@/utils/setPrescription';
import {
  applyWeekOverride,
  planComebackOverride,
  planWeekOverride,
  resolveStartOverride,
  type WeekOverrideKind,
  type WeekOverridePlan,
  type WeekOverrideSet,
} from '@/utils/trainingWeekOverride';
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

type ProgressionContext = {
  automatic: boolean;
  mode: Awaited<ReturnType<typeof SettingsService.getProgressionMode>>;
  gym: GymSnapshot | null;
  /** Training done in a lighter week is deliberately below capacity, so it is no baseline. */
  lighterWindows: readonly { from: number; until: number }[];
  unitsFor: (exerciseId: string) => Units;
  repCeilingFor: (exercise: Exercise) => number;
  /** The comeback ramp shaping workouts today (null = none), and the dates its baselines key off. */
  comeback: {
    ramp: WorkoutRamp | null;
    /** Sessions completed before this are the pre-break baseline the ramp scales. */
    baseBefore: number | null;
    /** Sessions completed from this day on are the comeback's own: the load floor. */
    startedAt: number | null;
  };
};

/** What the comeback ramp needs from one exercise's history. */
type ComebackSets = { base: readonly HistorySet[]; earlier: readonly HistorySet[] };

/** What the session start does to one exercise's planned working sets. */
type ExerciseStartPlan = WeekOverridePlan & {
  /** The rule state to write onto the log exercise, or null to leave it as copied. */
  state: ProgressionSessionState | null;
  /** The same decision as a recommendation to show (Add/Swap), sets already applied. */
  recommendation: ExerciseRecommendation;
};

export class WorkoutProgressionService {
  /** Add/Swap use the same completed history and projection as previews and session starts. */
  static async projectAdHocExercise(exercise: Exercise): Promise<ExerciseRecommendation | null> {
    // A repeat or lighter week the user chose in the Weekly Review governs an exercise added or
    // swapped in mid-session exactly as it governs the rest of the workout (`planExercise`), or a
    // replacement during a lighter week would start at a normal (or progressed) load.
    const [context, week] = await Promise.all([
      this.context(),
      progressesLoad(exercise.mechanicType) ? TrainingWeekRepository.activeTrainingWeek() : null,
    ]);
    const history = await this.history(exercise.id, undefined, undefined, context.lighterWindows);
    if (!history[0]?.sets.length) {
      return null;
    }

    const comeback = await this.comebackSets(context, history, (before) =>
      this.history(exercise.id, undefined, undefined, context.lighterWindows, before)
    );

    return this.planExercise({
      exercise,
      planned: history[0].sets.map((set, index) => ({
        id: String(index),
        weight: set.weightKg,
        reps: set.reps,
      })),
      history,
      rule: null,
      context,
      week: week?.decision ?? null,
      comeback,
      plannedFromHistory: true,
    }).recommendation;
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
    // While a comeback ramp runs the session starts from the eased numbers, not from this plain
    // projection, so listing it would promise loads the session never uses (the same reason the
    // Weekly Review hides it once a repeat or lighter week is chosen).
    if (context.comeback.ramp) {
      return [];
    }

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

          const rule = parseProgressionRule(row.progressionJson);
          const history = await this.history(
            row.exerciseId,
            undefined,
            rule ? row.id : undefined,
            context.lighterWindows
          );
          const planned = sets
            .filter((set) => set.templateExerciseId === row.id && !isWarmupSet(set))
            .sort((a, b) => a.setOrder - b.setOrder)
            .map((set) => ({ id: set.id, weight: set.targetWeight, reps: set.targetReps }));
          const step = loadStepFor(
            exercise.equipmentType,
            context.gym,
            context.unitsFor(exercise.id)
          );
          const projection = projectExerciseProgression({
            ...this.projectionInput(exercise, context, step),
            planned,
            history,
            rule,
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

  private static async context(): Promise<ProgressionContext> {
    const [autonomy, mode, gym, lighterWindows, comebackState] = await Promise.all([
      SettingsService.get(SETTINGS.workoutAutonomy),
      SettingsService.getProgressionMode(),
      GymService.getActiveGym().catch(() => null),
      TrainingWeekRepository.lighterWeekWindows(),
      SettingsService.get(SETTINGS.comebackState),
    ]);
    const { unitsFor, repCeilingFor } = await ExerciseUserSettingsService.getResolvers(gym);
    return {
      automatic: autonomy === 'suggest',
      mode,
      gym,
      lighterWindows,
      unitsFor,
      repCeilingFor,
      comeback: {
        // The nutrition-only track never eases workouts.
        ramp: tracksWorkouts(comebackState.track)
          ? currentWorkoutRamp(comebackState, localDayStartMs(new Date()))
          : null,
        baseBefore: comebackState.baseBefore,
        startedAt: comebackState.startedAt,
      },
    };
  }

  /**
   * The comeback ramp's view of one exercise: its pre-break session (history strictly before
   * `baseBefore`, filtered in the query so a few comeback weeks cannot push it out of the candidate
   * window) and the latest session of this comeback, which sets the load floor. `history` is the
   * ordinary, unfiltered one. Null when no ramp is running.
   */
  private static async comebackSets(
    context: ProgressionContext,
    history: readonly HistorySession[],
    read: (before: number) => Promise<HistorySession[]>
  ): Promise<ComebackSets | null> {
    const { ramp, baseBefore, startedAt } = context.comeback;
    if (!ramp) {
      return null;
    }

    const base = baseBefore === null ? [] : ((await read(baseBefore))[0]?.sets ?? []);
    const latest = history[0];
    const earlier =
      latest && startedAt !== null && (latest.completedAt ?? 0) >= startedAt ? latest.sets : [];

    return { base, earlier };
  }

  static async applyStartProgression(workoutLogId: string): Promise<number> {
    const logExercises = await this.liveLogExercises(workoutLogId);
    const rules = logExercises.map((row) => parseProgressionRule(row.progressionJson));
    const [context, week] = await Promise.all([
      this.context(),
      TrainingWeekRepository.activeTrainingWeek(),
    ]);
    const hasRule = rules.some((rule) => rule != null);
    // A repeat or lighter week the user chose in the Weekly Review applies even when autonomy is
    // `manual`: manual means the app does not change numbers on its own, and this is not on its own.
    // The comeback ramp is the same kind of explicit choice, and it applies to exercises with no
    // history too (their sets and effort are still eased).
    const ramp = context.comeback.ramp;
    if (!context.automatic && !hasRule && !week && !ramp) {
      return 0;
    }

    const histories = await Promise.all(
      logExercises.map((row, index) =>
        this.history(
          row.exerciseId,
          workoutLogId,
          rules[index] ? row.templateExerciseId : undefined,
          context.lighterWindows
        )
      )
    );
    if (!hasRule && !week && !ramp && !histories.some((history) => history.length)) {
      return 0;
    }

    const comebackSets = await Promise.all(
      logExercises.map((row, index) =>
        this.comebackSets(context, histories[index], (before) =>
          this.history(
            row.exerciseId,
            workoutLogId,
            rules[index] ? row.templateExerciseId : undefined,
            context.lighterWindows,
            before
          )
        )
      )
    );

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
        const now = Date.now();
        for (const [index, row] of logExercises.entries()) {
          const exercise = exercises.get(row.exerciseId);
          if (!exercise || !progressesLoad(exercise.mechanicType)) {
            continue;
          }

          const planned = sets
            .filter((set) => set.logExerciseId === row.id && !isWarmupSet(set))
            .sort((a, b) => a.setOrder - b.setOrder);
          const rule = rules[index];
          const history = histories[index];
          const plan = this.planExercise({
            exercise,
            planned: planned.map((set) => ({ id: set.id, weight: set.weight, reps: set.reps })),
            history,
            rule,
            context,
            week: week?.decision ?? null,
            comeback: comebackSets[index],
          });
          const changes = new Map(plan.changes.map((change) => [change.setId, change]));
          const dropped = new Set(plan.dropSetIds);
          const lastSets = history[0]?.sets ?? [];
          for (const [setIndex, set] of planned.entries()) {
            if (dropped.has(set.id)) {
              operations.push(prepareSoftDelete(set, now));
              changed += 1;
              continue;
            }

            const change = changes.get(set.id);
            const original = { weightKg: set.weight, reps: set.reps };
            const originalRir = set.repsInReserve;
            operations.push(
              set.prepareUpdate((record) => {
                record.prescriptionJson = serializeSetPrescription({
                  established: true,
                  workingSetCount: plan.workingSetCount,
                  plan: original,
                  // A lighter week overwrites the reps in reserve and drops sets; keep what undo
                  // needs to put the whole plan back.
                  ...(change?.repsInReserve != null ? { planRepsInReserve: originalRir } : {}),
                  ...(plan.dropSetIds.length ? { droppedSetIds: plan.dropSetIds } : {}),
                  recommendation: change?.adjustment?.now ?? original,
                  explanation: change?.adjustment ?? undefined,
                  previous: counterpartAt(lastSets, setIndex),
                });
                if (change) {
                  record.weight = change.weightKg;
                  record.reps = change.reps;
                  if (change.repsInReserve != null) {
                    record.repsInReserve = change.repsInReserve;
                  }

                  record.adjustmentJson = change.adjustment
                    ? serializeStartAdjustment(change.adjustment)
                    : undefined;
                }

                record.updatedAt = now;
              })
            );
            if (change?.adjustment) {
              changed += 1;
            }
          }

          if (rule && plan.state) {
            operations.push(
              row.prepareUpdate((record) => {
                record.progressionJson = serializeSessionProgression(rule, plan.state);
                record.updatedAt = now;
              })
            );
          }
        }

        return operations;
      });
      return changed;
    });
  }

  /**
   * What the session start does to one exercise, in ONE shape whichever decided it: a Weekly
   * Review's repeat or lighter week, or the exercise's rule / the automatic progression. The writer
   * applies the shape and never needs to know which of them produced it, and `recommendation` is the
   * same decision as Add/Swap shows it — so "the week beats the projection" is decided here only.
   */
  private static planExercise({
    exercise,
    planned,
    history,
    rule,
    context,
    week,
    comeback = null,
    plannedFromHistory = false,
  }: {
    exercise: Exercise;
    planned: WeekOverrideSet[];
    history: HistorySession[];
    rule: ProgressionRule | null;
    context: ProgressionContext;
    week: WeekOverrideKind | null;
    /** The comeback ramp's view of this exercise; null when no ramp is running. */
    comeback?: ComebackSets | null;
    /** The "plan" is a copy of last session (Add/Swap), not a template's prescription. */
    plannedFromHistory?: boolean;
  }): ExerciseStartPlan {
    const step = loadStepFor(exercise.equipmentType, context.gym, context.unitsFor(exercise.id));
    const projection = projectExerciseProgression({
      ...this.projectionInput(exercise, context, step),
      planned,
      history,
      rule,
      plannedFromHistory,
    });
    const override = resolveStartOverride({
      comeback: comeback ? context.comeback.ramp : null,
      week,
    });
    if (!override) {
      return {
        changes: projection.changes,
        dropSetIds: [],
        workingSetCount: planned.length,
        state: rule ? projection.state : null,
        recommendation: projection,
      };
    }

    // A week the review overrode is not a session the rule can learn from, so it does not advance
    // the remembered state — but it hands the last session's state on (while it still belongs to
    // this rule), or the next normal session would start the rule over.
    const overridePlan =
      override.kind === 'comeback' && comeback
        ? planComebackOverride({
            ramp: override.ramp,
            planned,
            base: comeback.base,
            earlier: comeback.earlier,
            step,
          })
        : planWeekOverride({
            kind: override.kind === 'comeback' ? 'lighter' : override.kind,
            planned,
            last: history[0]?.sets ?? [],
            step,
          });
    return {
      ...overridePlan,
      state: carriedSessionState(rule, history[0]),
      recommendation: {
        ...projection,
        sets: applyWeekOverride(planned, overridePlan),
        changes: [],
        state: null,
      },
    };
  }

  /** The exercise- and account-dependent half of every projection, built in one place. */
  private static projectionInput(
    exercise: Exercise,
    context: ProgressionContext,
    step: ReturnType<typeof loadStepFor>
  ) {
    const isBodyweight = exercise.equipmentType === 'bodyweight';
    return {
      step,
      automatic: context.automatic,
      progressionMode: context.mode,
      isCompound: exercise.mechanicType === 'compound',
      isBodyweight,
      bodyweightRepCeiling: isBodyweight ? context.repCeilingFor(exercise) : undefined,
      mechanicType: exercise.mechanicType,
    };
  }

  static async revertStartAdjustment(logExerciseId: string): Promise<number> {
    return database.write(async () => {
      // Soft-deleted sets are read too: a lighter week removes trailing sets, and undo brings back
      // exactly the ones it recorded (never a set the user deleted themselves).
      const rows = await database
        .get<WorkoutLogSet>('workout_log_sets')
        .query(Q.where('log_exercise_id', logExerciseId))
        .fetch();
      const sets = rows.filter((set) => !set.deletedAt);
      const droppedIds = new Set(
        sets.flatMap((set) => parseSetPrescription(set.prescriptionJson)?.droppedSetIds ?? [])
      );
      const dropped = rows.filter(
        (set) => !!set.deletedAt && droppedIds.has(set.id) && isPlannedWorkoutSet(set)
      );
      const operations: Model[] = [];
      await commitPrepared(database, [...sets, ...dropped], () => {
        const now = Date.now();
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
          const { planRepsInReserve, droppedSetIds, ...rest } = prescription ?? {
            plan: adjustment!.plan,
            recommendation: adjustment!.now,
            explanation: adjustment!,
          };
          operations.push(
            set.prepareUpdate((record) => {
              record.weight = target.weightKg;
              record.reps = target.reps;
              if (planRepsInReserve != null) {
                record.repsInReserve = planRepsInReserve;
              }

              record.adjustmentJson = undefined;
              record.prescriptionJson = serializeSetPrescription({
                ...rest,
                ...(droppedSetIds?.length && rest.workingSetCount
                  ? { workingSetCount: rest.workingSetCount + droppedSetIds.length }
                  : {}),
                established: true,
                override: 'plan',
              });
              record.updatedAt = now;
            })
          );
        }

        for (const set of dropped) {
          operations.push(
            set.prepareUpdate((record) => {
              record.deletedAt = undefined;
              record.updatedAt = now;
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
    templateExerciseId?: string,
    excludeWindows: readonly { from: number; until: number }[] = [],
    /** Only sessions completed strictly before this (ms): comeback mode's pre-break baseline. */
    before?: number
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
          // In the query, not in memory: the candidate pool is a few dozen rows, and a handful of
          // comeback weeks would push the pre-break sessions out of it.
          ...(before === undefined ? [] : [Q.where('completed_at', Q.lt(before))]),
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
    const inLighterWeek = (row: WorkoutLogExercise) => {
      const at = happenedAt(row);
      return excludeWindows.some((window) => at >= window.from && at < window.until);
    };

    const recent = candidates
      .filter((row) => !inLighterWeek(row))
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
        completedAt: happenedAt(row),
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
