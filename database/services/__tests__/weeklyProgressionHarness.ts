import './weeklyProgressionMocks';

import { database } from '@/database/database-instance';
import NutritionGoal from '@/database/models/NutritionGoal';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '@/database/models/WorkoutTemplateSet';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { localDayKeyPlusCalendarDays, localDayStartMs } from '@/utils/calendarDate';
import {
  serializeProgressionRule,
  serializeSessionProgression,
  parseSessionProgressionState,
} from '@/utils/progressionRuleSchema';
import { type ProgressionRule } from '@/utils/progressionRuleSchema';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';

export const targets = { totalCalories: 2100, protein: 140, carbs: 220, fats: 70, fiber: 30 };
export const accepted = { ...targets, totalCalories: 2200, carbs: 245 };
export const recommendation = {
  targets: accepted,
  canApply: true,
  usedEmpiricalData: true,
  foodDays: 7,
  weightDays: 4,
};
export const today = () => localDayStartMs(new Date());

export async function goal(mode: 'weekly' | 'daily' | 'manual' = 'weekly') {
  return database.write(async () => {
    const row = database.get<NutritionGoal>('nutrition_goals').prepareCreate((r) => {
      Object.assign(r, targets);
      r.targetMode = mode;
      r.isDynamic = mode === 'daily';
      r.eatingPhase = 'maintain';
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    });
    await database.batch(
      row,
      ...(mode === 'weekly'
        ? [
            NutritionTargetService.preparePeriod(
              row.id,
              targets,
              localDayKeyPlusCalendarDays(today(), -14),
              Date.now()
            ),
          ]
        : [])
    );
    return row;
  });
}

export const trainingChoice = (decision: 'progress' | 'repeat' | 'lighter' = 'progress') => ({
  decision,
  recommended: 'progress' as const,
  reasons: [{ code: 'onTrack' as const }],
  goals: [],
});

export async function workout(
  rule = serializeProgressionRule({ type: 'double_progression', repMin: 8, repMax: 12 })!
) {
  return database.write(async () => {
    const ex = database.get<Exercise>('exercises').prepareCreate((r) => {
      r.name = 'Bench press';
      r.equipmentType = 'barbell';
      r.mechanicType = 'compound';
    });
    const template = database.get<WorkoutTemplate>('workout_templates').prepareCreate((r) => {
      r.name = 'Upper';
      r.createdAt = 1;
      r.updatedAt = 1;
    });
    const te = database
      .get<WorkoutTemplateExercise>('workout_template_exercises')
      .prepareCreate((r) => {
        r.templateId = template.id;
        r.exerciseId = ex.id;
        r.exerciseOrder = 1;
        r.progressionJson = rule;
        r.createdAt = 1;
        r.updatedAt = 1;
      });
    const log = database.get<WorkoutLog>('workout_logs').prepareCreate((r) => {
      r.templateId = template.id;
      r.workoutName = 'Upper';
      r.startedAt = Date.now();
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    });
    const block = database.get<WorkoutLogExercise>('workout_log_exercises').prepareCreate((r) => {
      r.workoutLogId = log.id;
      r.exerciseId = ex.id;
      r.templateExerciseId = te.id;
      r.exerciseOrder = 1;
      r.progressionJson = rule;
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    });
    const sets = [1, 2, 3].map((n) =>
      database.get<WorkoutLogSet>('workout_log_sets').prepareCreate((r) => {
        r.logExerciseId = block.id;
        r.setOrder = n;
        r.weight = 60;
        r.reps = 10;
        r.restTimeAfter = 90;
        r.completionStatus = 'planned';
        r.setType = 'normal';
        r.rirRecorded = false;
      })
    );
    const ts = sets.map((_, index) =>
      database.get<WorkoutTemplateSet>('workout_template_sets').prepareCreate((r) => {
        r.templateExerciseId = te.id;
        r.setOrder = index + 1;
        r.targetWeight = 60;
        r.targetReps = 10;
        r.setType = 'normal';
      })
    );
    await database.batch(ex, template, te, log, block, ...sets, ...ts);
    return { ex, template, te, log, block, sets };
  });
}

/**
 * A percentage-rule session at a carried 120 kg training max, then a Weekly Review repeat week whose
 * log exercise runs `nextRule`. Returns the state the repeat week's session ends up carrying.
 */
export async function repeatWeekState(
  nextRule?: (rule: ProgressionRule) => ProgressionRule
): Promise<number | undefined> {
  const rule: ProgressionRule = {
    type: 'percentage' as const,
    reps: 5,
    percentOfTrainingMax: 80,
    trainingMaxPercent: 90,
    trainingMaxKg: 100,
    failuresBeforeReset: 2,
    resetPercent: 10,
  };
  const current = nextRule ? nextRule(rule) : rule;
  const first = await workout(serializeProgressionRule(rule)!);
  await database.write(async () => {
    await first.block.update((r) => {
      r.progressionJson = serializeSessionProgression(rule, { trainingMaxKg: 120 });
    });
    await first.log.update((r) => {
      r.completedAt = Date.now() - 1000;
    });
    await database.batch(
      ...first.sets.map((set) =>
        set.prepareUpdate((r) => {
          r.completionStatus = 'performed';
          r.weight = 96;
          r.reps = 5;
          r.repsInReserve = 2;
          r.rirRecorded = true;
        })
      )
    );
  });
  const next = await database.write(async () => {
    const log = database.get<WorkoutLog>('workout_logs').prepareCreate((r) => {
      r.templateId = first.template.id;
      r.workoutName = 'Upper';
      r.startedAt = Date.now();
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    });
    const block = database.get<WorkoutLogExercise>('workout_log_exercises').prepareCreate((r) => {
      r.workoutLogId = log.id;
      r.exerciseId = first.ex.id;
      r.templateExerciseId = first.te.id;
      r.exerciseOrder = 1;
      r.progressionJson = serializeProgressionRule(current);
      r.createdAt = Date.now();
      r.updatedAt = Date.now();
    });
    const sets = [1, 2].map((n) =>
      database.get<WorkoutLogSet>('workout_log_sets').prepareCreate((r) => {
        r.logExerciseId = block.id;
        r.setOrder = n;
        r.weight = 60;
        r.reps = 5;
        r.restTimeAfter = 90;
        r.completionStatus = 'planned';
        r.setType = 'normal';
        r.rirRecorded = false;
      })
    );
    await database.batch(log, block, ...sets);
    return { log, block };
  });
  jest.spyOn(TrainingWeekRepository, 'activeTrainingWeek').mockResolvedValue({
    decision: 'repeat',
    reviewId: 'review',
    snapshot: {
      decision: 'repeat',
      recommended: 'progress',
      reasons: [],
      goals: [],
      window: { from: Date.now() - 1000, until: Date.now() + 1_000_000 },
    },
  });
  await WorkoutProgressionService.applyStartProgression(next.log.id);
  jest.restoreAllMocks();
  return parseSessionProgressionState(next.block.progressionJson)?.trainingMaxKg;
}

/** Registers the per-test database reset and the teardown every weekly-progression suite shares. */
export function useWeeklyProgressionDatabase(): void {
  afterAll(() => {
    const adapter = database.adapter.underlyingAdapter as unknown as {
      _dispatcher: { _worker: { _bridge: { driver: { loki: { close: () => void } } } } };
    };
    adapter._dispatcher._worker._bridge.driver.loki.close();
  });

  beforeEach(async () => {
    await database.write(() => database.unsafeResetDatabase());
  });
}
