import {
  getEffectiveOrder,
  getRoundIndexWithinGroup,
  getNextSetInEffectiveOrder,
  isNextInSameSupersetRound,
} from '@/utils/workoutSupersetOrder';
import { database } from '@/database/database-instance';
import NutritionGoal from '@/database/models/NutritionGoal';
import NutritionTargetPeriod from '@/database/models/NutritionTargetPeriod';
import WeeklyReview from '@/database/models/WeeklyReview';
import Exercise from '@/database/models/Exercise';
import WorkoutLog from '@/database/models/WorkoutLog';
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import WorkoutLogSet from '@/database/models/WorkoutLogSet';
import WorkoutTemplate from '@/database/models/WorkoutTemplate';
import WorkoutTemplateExercise from '@/database/models/WorkoutTemplateExercise';
import WorkoutTemplateSet from '@/database/models/WorkoutTemplateSet';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { WorkoutSessionService } from '@/database/services/WorkoutSessionService';
import {
  localDayKeyPlusCalendarDays,
  localDayStartMs,
  utcDayKeyFromLocalDate,
} from '@/utils/calendarDate';
import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { resolveWeeklyRecommendation } from '@/utils/dynamicNutritionTarget';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import { serializeProgressionRule, parseSessionProgressionState } from '@/utils/progressionRules';
import { parseSetPrescription } from '@/utils/setPrescription';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { dumpDatabase } from '@/database/exportDb.web';
import { restoreDatabase } from '@/database/importDb';
import { appExerciseId } from '@/utils/exerciseImage';
import { parseProgressionRule } from '@/utils/progressionRules';
import { Q } from '@nozbe/watermelondb';
import Schedule from '@/database/models/Schedule';
import { weekHadActivity } from '@/hooks/useWeeklyReviewStatus';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { indexToDayName, jsDayToWeekdayIndex } from '@/utils/weekdays';

jest.mock('@/database/adapter', () => {
  const Loki = jest.requireActual('@nozbe/watermelondb/adapters/lokijs').default;
  return {
    __esModule: true,
    default: new Loki({
      schema: jest.requireActual('@/database/schema').schema,
      migrations: jest.requireActual('@/database/migrations').migrations,
      useWebWorker: false,
      useIncrementalIndexedDB: false,
      extraLokiOptions: { autosave: false },
      _testLokiAdapter: new (require('lokijs').LokiMemoryAdapter)(),
    }),
  };
});
jest.mock('@/database/services/GymService', () => ({
  GymService: { getActiveGym: async () => null },
}));
jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: {
    getWorkoutAutonomy: async () => 'manual',
    getProgressionMode: async () => 'weight_first',
    getReviewWeekday: async () => 1,
    getThemePreference: async () => 'kinetic-depth',
    getIntuitiveEatingMode: async () => false,
    getEnableFastedDay: jest.fn(async () => false),
  },
}));
jest.mock('@/database/services/ExerciseUserSettingsService', () => ({
  ExerciseUserSettingsService: { getWeightUnitsResolver: async () => () => 'metric' },
}));
jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: {
    getUserBodyWeightKgForVolume: async () => 70,
    getLatest: async () => null,
    getMetricsHistory: async () => [],
  },
}));
jest.mock('@/utils/dynamicNutritionTarget', () => ({
  resolveWeeklyRecommendation: jest.fn(async () => null),
  resolveDailyMacros: jest.fn(async () => ({
    totalCalories: 2400,
    protein: 150,
    carbs: 250,
    fats: 80,
    fiber: 30,
    tdee: 2600,
    usedEmpiricalData: true,
  })),
}));

jest.mock('@/database/preMigrationBackup', () => ({
  createPreRestoreBackup: jest.fn(async () => {}),
}));
jest.mock('@/database/dbReady', () => ({ waitForBootMigrations: jest.fn(async () => {}) }));
jest.mock('@/database/dbDurability', () => ({
  updateNutritionLogCountBaseline: jest.fn(async () => {}),
}));
jest.mock('@/database/services/AppExerciseCatalogueService', () => ({
  AppExerciseCatalogueService: { sync: jest.fn(async () => {}) },
}));
jest.mock('@/database/services/MuscleService', () => ({
  MuscleService: {
    seedMuscles: jest.fn(async () => ({})),
    backfillExerciseMuscles: jest.fn(async () => {}),
  },
}));
jest.mock('@/database/services/UserService', () => ({
  UserService: { getCurrentUser: jest.fn(async () => null) },
}));
jest.mock('@/utils/app', () => ({ reloadApp: jest.fn(async () => {}) }));
jest.mock('@/utils/musclogGatewayAvailability', () => ({ isMusclogGatewayAvailable: () => true }));

const targets = { totalCalories: 2100, protein: 140, carbs: 220, fats: 70, fiber: 30 };
const accepted = { ...targets, totalCalories: 2200, carbs: 245 };
const recommendation = {
  targets: accepted,
  canApply: true,
  usedEmpiricalData: true,
  foodDays: 7,
  weightDays: 4,
};
const today = () => localDayStartMs(new Date());

afterAll(() => {
  const adapter = database.adapter.underlyingAdapter as unknown as {
    _dispatcher: { _worker: { _bridge: { driver: { loki: { close: () => void } } } } };
  };
  adapter._dispatcher._worker._bridge.driver.loki.close();
});

beforeEach(async () => {
  await database.write(() => database.unsafeResetDatabase());
});

async function goal(mode: 'weekly' | 'daily' | 'manual' = 'weekly') {
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

const trainingChoice = (decision: 'progress' | 'repeat' | 'lighter' = 'progress') => ({
  decision,
  recommended: 'progress' as const,
  reasons: [{ code: 'onTrack' as const }],
  goals: [],
});

it('applies tomorrow in one batch, stays stable, resolves history, and deduplicates repeated submits', async () => {
  const g = await goal();
  const period = weeklyReviewPeriod();
  const input = {
    period,
    goalId: g.id,
    section: 'nutrition' as const,
    decision: 'apply' as const,
    recommendation,
    accepted,
  };
  const [a, b] = await Promise.all([
    WeeklyReviewService.decide(input),
    WeeklyReviewService.decide(input),
  ]);
  expect(a).toBe(b);
  expect((await database.get<WeeklyReview>('weekly_reviews').query().fetch()).length).toBe(1);
  expect(
    (await database.get<NutritionTargetPeriod>('nutrition_target_periods').query().fetch()).length
  ).toBe(2);
  expect((await NutritionTargetService.resolve(g, new Date(today()))).totalCalories).toBe(2100);
  expect(
    (await NutritionTargetService.resolve(g, new Date(localDayKeyPlusCalendarDays(today(), 1))))
      .totalCalories
  ).toBe(2200);
  expect(
    (await NutritionTargetService.resolve(g, new Date(localDayKeyPlusCalendarDays(today(), 5))))
      .totalCalories
  ).toBe(2200);
  const review = await database.get<WeeklyReview>('weekly_reviews').find(a);
  expect(JSON.parse(review.acceptedJson!)).toEqual(accepted);
  expect(review.trainingReviewedAt).toBeNull();
});
it('keeps targets without changing their schedule and acknowledges training independently', async () => {
  const g = await goal();
  const period = weeklyReviewPeriod();
  const id = await WeeklyReviewService.decide({
    period,
    goalId: g.id,
    section: 'training',
    training: trainingChoice(),
  });
  const review = await database.get<WeeklyReview>('weekly_reviews').find(id);
  expect(review.nutritionReviewedAt).toBeNull();
  expect(
    await WeeklyReviewService.decide({
      period,
      goalId: g.id,
      section: 'nutrition',
      decision: 'keep',
      recommendation,
      accepted: targets,
    })
  ).toBe(id);
  expect(
    (await database.get<NutritionTargetPeriod>('nutrition_target_periods').query().fetch()).length
  ).toBe(1);
  expect(review.nutritionDecision).toBe('keep');
});
it('a failed approval leaves the existing review and periods retryable', async () => {
  const g = await goal();
  const period = weeklyReviewPeriod();
  const id = await WeeklyReviewService.decide({
    period,
    goalId: g.id,
    section: 'training',
    training: trainingChoice(),
  });
  const adapter = database.adapter;
  const failure = jest.spyOn(adapter, 'batch').mockRejectedValueOnce(new Error('disk full'));
  await expect(
    WeeklyReviewService.decide({
      period,
      goalId: g.id,
      section: 'nutrition',
      decision: 'apply',
      recommendation,
      accepted,
    })
  ).rejects.toThrow('disk full');
  failure.mockRestore();
  const review = await database.get<WeeklyReview>('weekly_reviews').find(id);
  expect(review.nutritionReviewedAt).toBeNull();
  expect((await NutritionTargetService.resolve(g)).totalCalories).toBe(2100);
  await WeeklyReviewService.decide({
    period,
    goalId: g.id,
    section: 'nutrition',
    decision: 'apply',
    recommendation,
    accepted,
  });
  expect(review.nutritionDecision).toBe('apply');
});
it('rejects missing evidence and invalid edits without completing a review', async () => {
  const g = await goal();
  const period = weeklyReviewPeriod();
  await expect(
    WeeklyReviewService.decide({
      period,
      goalId: g.id,
      section: 'nutrition',
      decision: 'apply',
      recommendation: { ...recommendation, canApply: false },
      accepted,
    })
  ).rejects.toThrow();
  await expect(
    WeeklyReviewService.decide({
      period,
      goalId: g.id,
      section: 'nutrition',
      decision: 'apply',
      recommendation,
      accepted: { ...accepted, totalCalories: NaN },
    })
  ).rejects.toThrow();
  expect(await database.get<WeeklyReview>('weekly_reviews').query().fetch()).toHaveLength(0);
});
it('preserves daily behavior and captures its current resolved targets on mode switch', async () => {
  const g = await goal('daily');
  expect((await NutritionTargetService.resolve(g)).totalCalories).toBe(2400);
  await NutritionGoalService.updateGoal(g.id, { targetMode: 'weekly' });
  expect(g.isDynamic).toBe(false);
  expect((await NutritionTargetService.resolve(g)).totalCalories).toBe(2400);
  await NutritionGoalService.updateGoal(g.id, { targetMode: 'manual' });
  expect((await NutritionTargetService.resolve(g)).totalCalories).toBe(2400);
});
it('retains older approvals after leaving weekly mode and after goal changes', async () => {
  const g = await goal();
  await WeeklyReviewService.decide({
    period: weeklyReviewPeriod(),
    goalId: g.id,
    section: 'nutrition',
    decision: 'keep',
    accepted: targets,
  });
  await NutritionGoalService.updateGoal(g.id, { targetMode: 'daily' });
  expect(
    (await NutritionTargetService.resolve(g, new Date(localDayKeyPlusCalendarDays(today(), -1))))
      .totalCalories
  ).toBe(2100);
  await database.write(() =>
    g.update((r) => {
      r.effectiveUntil = Date.now();
    })
  );
  await expect(
    WeeklyReviewService.decide({
      period: weeklyReviewPeriod(new Date(localDayKeyPlusCalendarDays(today(), 7))),
      goalId: g.id,
      section: 'nutrition',
      decision: 'keep',
      accepted: targets,
    })
  ).rejects.toThrow('Goal has changed');
  expect(await WeeklyReviewService.history()).toHaveLength(1);
});
it('training is available without a nutrition goal', async () => {
  await WeeklyReviewService.decide({
    period: weeklyReviewPeriod(),
    section: 'training',
    training: trainingChoice(),
  });
  expect(await WeeklyReviewService.history()).toHaveLength(1);
});

async function workout(
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
it('preview matches start with automatic suggestions off; undo survives recalculation and performed sets stay untouched', async () => {
  const w = await workout();
  const preview = await WorkoutProgressionService.projectTemplate(w.template.id);
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  expect(w.sets.map((s) => [s.weight, s.reps])).toEqual(
    preview[0].sets.map((s) => [s.weight, s.reps])
  );
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 65,
    reps: 9,
    manual: true,
  });
  expect(w.sets[1].weight).toBe(65);
  await WorkoutProgressionService.revertStartAdjustment(w.block.id);
  expect(w.sets[0].weight).toBe(65);
  expect(w.sets[1].weight).toBe(60);
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  expect(w.sets[1].weight).toBe(60);
  expect(parseSetPrescription(w.sets[1].prescriptionJson)?.override).toBe('plan');
  expect(w.sets[0].rirRecorded).toBe(false);
});
it('updates back-offs from the actual top set and respects a manually overridden unfinished set', async () => {
  const w = await workout(
    serializeProgressionRule({
      type: 'top_set_backoff',
      repMin: 4,
      repMax: 6,
      backoffPercent: 80,
      backoffReps: 8,
    })!
  );
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 100,
    reps: 5,
    manual: true,
  });
  expect(w.sets[1].weight).toBe(80);
  expect(w.sets[2].weight).toBe(80);
  expect(w.sets[1].reps).toBe(8);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[1].id, 'performed', {
    weight: 75,
    reps: 8,
    manual: true,
    repsInReserve: 0,
  });
  await WorkoutSessionService.saveSet(w.log.id, w.sets[1].id, 'planned');
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'planned');
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 110,
    reps: 5,
  });
  expect(w.sets[1].weight).toBe(75);
  expect(w.sets[1].rirRecorded).toBe(true);
  expect(w.sets[2].weight).toBe(87.5);
});
it('persists an entered training max in the session independently from template edits', async () => {
  const w = await workout(
    serializeProgressionRule({
      type: 'percentage',
      reps: 5,
      percentOfTrainingMax: 80,
      trainingMaxPercent: 90,
      trainingMaxKg: 100,
    })!
  );
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  expect(parseSessionProgressionState(w.block.progressionJson)?.trainingMaxKg).toBe(100);
  await database.write(() =>
    w.te.update((r) => {
      r.progressionJson = serializeProgressionRule({
        type: 'linear',
        reps: 5,
        failuresBeforeDeload: 3,
        deloadPercent: 10,
      });
    })
  );
  expect(w.sets[0].weight).toBe(80);
  expect(parseSessionProgressionState(w.block.progressionJson)?.trainingMaxKg).toBe(100);
});

it('scopes explicit evidence to the stable exercise row in its own template', async () => {
  const own = await workout();
  const other = await workout();
  await database.write(() =>
    database.batch(
      own.log.prepareUpdate((r) => {
        r.completedAt = Date.now();
      }),
      ...own.sets.map((s) =>
        s.prepareUpdate((r) => {
          r.reps = 12;
          r.completionStatus = 'performed';
        })
      ),
      other.te.prepareUpdate((r) => {
        r.exerciseId = own.ex.id;
      }),
      other.block.prepareUpdate((r) => {
        r.exerciseId = own.ex.id;
      }),
      other.log.prepareUpdate((r) => {
        r.completedAt = Date.now();
      }),
      ...other.sets.map((s) =>
        s.prepareUpdate((r) => {
          r.weight = 150;
          r.reps = 12;
          r.completionStatus = 'performed';
        })
      )
    )
  );
  const preview = await WorkoutProgressionService.projectTemplate(own.template.id);
  expect(preview[0].sets[0].weight).toBe(62.5);
});
it('skipped sets prevent full-success progression and preserve corresponding set evidence', async () => {
  const w = await workout();
  await database.write(() =>
    database.batch(
      w.log.prepareUpdate((r) => {
        r.completedAt = Date.now();
      }),
      ...w.sets.map((s, index) =>
        s.prepareUpdate((r) => {
          r.completionStatus = index === 0 ? 'skipped' : 'performed';
          r.reps = index === 1 ? 10 : 12;
        })
      )
    )
  );
  const preview = await WorkoutProgressionService.projectTemplate(w.template.id);
  expect(preview[0].sets.map((s) => s.reps)).toEqual([8, 11, 12]);
  expect(preview[0].sets.map((s) => s.weight)).toEqual([60, 60, 60]);
});
it('ignores warm-ups and keeps intra-session carryover inside its exercise even in a superset', async () => {
  const a = await workout();
  const b = await workout();
  await database.write(() =>
    database.batch(
      b.block.prepareUpdate((r) => {
        r.workoutLogId = a.log.id;
        r.groupId = 'superset';
      }),
      a.block.prepareUpdate((r) => {
        r.groupId = 'superset';
      }),
      a.sets[0].prepareUpdate((r) => {
        r.setType = 'warmup';
        r.weight = 20;
      })
    )
  );
  await WorkoutSessionService.saveSet(a.log.id, a.sets[0].id, 'performed', {
    weight: 25,
    reps: 5,
    repsInReserve: 0,
  });
  expect(a.sets[1].weight).toBe(60);
  await WorkoutSessionService.saveSet(a.log.id, a.sets[1].id, 'performed', {
    weight: 70,
    reps: 10,
  });
  expect(a.sets[2].weight).toBe(70);
  expect(b.sets[0].weight).toBe(60);
});
it('failed set writes preserve the performed status and prescribed values for retry', async () => {
  const w = await workout();
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  const failure = jest
    .spyOn(database.adapter, 'batch')
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(
    WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', { weight: 75, reps: 10 })
  ).rejects.toThrow();
  failure.mockRestore();
  expect(w.sets[0].completionStatus).toBe('planned');
  expect(w.sets[0].weight).toBe(60);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 75,
    reps: 10,
  });
  expect(w.sets[0].completionStatus).toBe('performed');
});

it('preserves exercise and set identity when editing a template, and starts fresh state only for a new method', async () => {
  const w = await workout();
  const originalSets = await w.te.sets.fetch();
  const originalRule = parseProgressionRule(w.te.progressionJson)!;
  const exercises = await WorkoutTemplateService.convertTemplateExercisesToUI([w.te], originalSets);
  await WorkoutTemplateService.saveTemplate({
    templateId: w.template.id,
    name: 'Edited upper',
    selectedDays: [],
    exercises,
  });
  const edited = await w.template.templateExercises.fetch();
  expect(edited.map((e) => e.id)).toEqual([w.te.id]);
  expect((await edited[0].sets.fetch()).map((s) => s.id)).toEqual(originalSets.map((s) => s.id));
  expect(parseProgressionRule(edited[0].progressionJson)).toEqual(originalRule);
  exercises[0].progression = {
    type: 'linear',
    reps: 5,
    failuresBeforeDeload: 3,
    deloadPercent: 10,
  };
  await WorkoutTemplateService.saveTemplate({
    templateId: w.template.id,
    name: 'Edited upper',
    selectedDays: [],
    exercises,
  });
  expect(parseProgressionRule(w.te.progressionJson)?.resetAt).toBeGreaterThan(0);
  expect(parseProgressionRule(w.block.progressionJson)?.type).toBe('double_progression');
});
it('copies rules through template and session duplication while resetting performed effort', async () => {
  const w = await workout();
  const copy = await WorkoutTemplateService.duplicateTemplate(w.template.id);
  const copiedExercises = await copy.templateExercises.fetch();
  expect(copiedExercises[0].progressionJson).toBe(w.te.progressionJson);
  expect(copiedExercises[0].id).not.toBe(w.te.id);
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 65,
    reps: 8,
    repsInReserve: 0,
  });
  const session = await WorkoutService.duplicateWorkoutLog(w.log.id);
  const blocks = await session.logExercises.fetch();
  expect(blocks[0].progressionJson).toBe(w.block.progressionJson);
  expect(blocks[0].templateExerciseId).toBe(w.te.id);
  const sets = await blocks[0].sets.fetch();
  expect(sets.every((s) => s.completionStatus === 'planned' && s.rirRecorded === false)).toBe(true);
});
it('splits a swap after logging, preserving performed movement identity and its rule', async () => {
  const w = await workout();
  const replacement = await workout();
  await database.write(() =>
    database.batch(
      w.block.prepareUpdate((r) => {
        r.groupId = 'superset';
      }),
      replacement.block.prepareUpdate((r) => {
        r.workoutLogId = w.log.id;
        r.groupId = 'superset';
        r.exerciseOrder = 2;
      }),
      ...replacement.sets.map((row) =>
        row.prepareUpdate((r) => {
          r.setOrder += 3;
        })
      )
    )
  );
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', { weight: 65, reps: 8 });
  const replacementId = await WorkoutLogExerciseService.replaceLogExercise(
    w.block.id,
    replacement.ex.id,
    {
      reason: 'equipment_unavailable',
      plannedWeightKg: 20,
    }
  );
  expect(w.te.exerciseId).toBe(w.ex.id);
  expect(w.te.progressionJson).toBeTruthy();
  expect(w.block.exerciseId).toBe(w.ex.id);
  expect(w.block.progressionJson).toBeTruthy();
  expect(w.sets[0].logExerciseId).toBe(w.block.id);
  expect(w.sets[1].logExerciseId).toBe(replacementId);
  const replacementBlock = await database
    .get<WorkoutLogExercise>('workout_log_exercises')
    .find(replacementId);
  expect(replacementBlock.exerciseId).toBe(replacement.ex.id);
  expect(replacementBlock.replacedExerciseId).toBe(w.ex.id);
  expect(replacementBlock.progressionJson).toBeNull();
  expect(replacementBlock.supersetSlotId).toBe(w.block.id);
  const details = await WorkoutService.getWorkoutWithDetails(w.log.id);
  const ordered = getEffectiveOrder(details.sets);
  expect(ordered.map((row) => row.id)).toEqual(
    w.sets.flatMap((row, index) => [row.id, replacement.sets[index].id])
  );
  expect(getRoundIndexWithinGroup(ordered[2], details.sets)).toBe(1);
  expect(getNextSetInEffectiveOrder(details.sets, w.sets[0].setOrder)?.id).toBe(
    replacement.sets[0].id
  );
  expect(isNextInSameSupersetRound(ordered[0], ordered[1], details.sets)).toBe(true);
  expect(isNextInSameSupersetRound(ordered[1], ordered[2], details.sets)).toBe(false);
  expect(details.sets.find((set) => set.id === w.sets[0].id)?.exerciseId).toBe(w.ex.id);
  expect(details.sets.find((set) => set.id === w.sets[1].id)?.exerciseId).toBe(replacement.ex.id);
  expect(w.sets[0].weight).toBe(65);
  expect(w.sets[1].weight).toBe(20);
  expect(w.sets[1].prescriptionJson).toBeNull();
});
it('imports an explicit progression rule through the supported structured template format', async () => {
  const w = await workout();
  await database.write(async () => {
    const imported = database.get<Exercise>('exercises').prepareCreate((r) => {
      r._raw.id = appExerciseId('Bench_Test');
      r.name = 'Imported bench';
      r.equipmentType = 'barbell';
      r.mechanicType = 'compound';
    });
    await database.batch(imported);
  });
  const result = await WorkoutTemplateService.createWorkoutsFromJsonTemplate({
    title: 'Imported plan',
    exercises: [
      {
        exerciseSlug: 'Bench_Test',
        day: 1,
        sets: 3,
        reps: 10,
        progression: parseProgressionRule(w.te.progressionJson),
      },
    ],
  });
  expect(result.templates).toHaveLength(1);
  expect(
    parseProgressionRule((await result.templates[0].templateExercises.fetch())[0].progressionJson)
      ?.type
  ).toBe('double_progression');
});
it('preview, next-time projection, and weekly review share current inputs without rewriting an active session', async () => {
  const w = await workout();
  const upcoming = jest
    .spyOn(WorkoutTodayRepository, 'upcoming')
    .mockResolvedValue([{ template: w.template, scheduled: true }]);
  const preview = await WorkoutProgressionService.projectTemplate(w.template.id);
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  const review = await WeeklyReviewService.overview();
  expect(review.training.targets).toEqual(preview);
  await database.write(() =>
    w.te.update((r) => {
      r.progressionJson = serializeProgressionRule({
        type: 'linear',
        reps: 5,
        failuresBeforeDeload: 3,
        deloadPercent: 10,
      });
    })
  );
  expect((await WorkoutProgressionService.projectTemplate(w.template.id))[0].sets[0].reps).toBe(5);
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  expect(w.sets[0].reps).toBe(8);
  upcoming.mockRestore();
});
it('retains training acknowledgement across goal changes and shows edited accepted targets in history', async () => {
  const g = await goal();
  const period = weeklyReviewPeriod();
  const reviewId = await WeeklyReviewService.decide({
    period,
    goalId: g.id,
    section: 'training',
    training: trainingChoice(),
  });
  await WeeklyReviewService.decide({
    period,
    goalId: g.id,
    section: 'nutrition',
    decision: 'apply',
    recommendation,
    accepted: { ...accepted, totalCalories: 2300 },
  });
  await NutritionGoalService.saveGoals({
    ...targets,
    eatingPhase: 'maintain',
    targetMode: 'weekly',
  });
  const current = await WeeklyReviewService.overview();
  expect(current.training.reviewedAt).toBeTruthy();
  expect(current.review?.nutritionReviewedAt).toBeFalsy();
  const history = await WeeklyReviewService.overview(reviewId);
  expect(history.accepted?.totalCalories).toBe(2300);
});
it('a failed goal change leaves its current goal and weekly baseline intact for retry', async () => {
  const g = await goal();
  const failure = jest
    .spyOn(database.adapter, 'batch')
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(
    NutritionGoalService.saveGoals({ ...targets, eatingPhase: 'maintain', targetMode: 'weekly' })
  ).rejects.toThrow('disk full');
  failure.mockRestore();
  expect(g.effectiveUntil).toBeNull();
  expect((await NutritionGoalService.getCurrent())?.id).toBe(g.id);
  await NutritionGoalService.saveGoals({
    ...targets,
    eatingPhase: 'maintain',
    targetMode: 'weekly',
  });
  expect(g.effectiveUntil).not.toBeNull();
});
it('round-trips progression, overrides, explicit zero effort, review decisions and dated targets through portable backup', async () => {
  const w = await workout();
  const g = await goal();
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 65,
    reps: 8,
    repsInReserve: 0,
  });
  await WorkoutProgressionService.revertStartAdjustment(w.block.id);
  const reviewId = await WeeklyReviewService.decide({
    period: weeklyReviewPeriod(),
    goalId: g.id,
    section: 'nutrition',
    decision: 'apply',
    recommendation,
    accepted,
  });
  const dump = await dumpDatabase();
  await restoreDatabase(dump);
  const block = await database.get<WorkoutLogExercise>('workout_log_exercises').find(w.block.id);
  expect(block.progressionJson).toBe(w.block.progressionJson);
  const sets = await block.sets.fetch();
  expect(sets.find((s) => s.id === w.sets[0].id)?.rirRecorded).toBe(true);
  expect(
    parseSetPrescription(sets.find((s) => s.id === w.sets[1].id)?.prescriptionJson)?.override
  ).toBe('plan');
  const restoredGoal = await database.get<NutritionGoal>('nutrition_goals').find(g.id);
  expect(
    (
      await NutritionTargetService.resolve(
        restoredGoal,
        new Date(localDayKeyPlusCalendarDays(today(), 1))
      )
    ).totalCalories
  ).toBe(2200);
  expect(
    (await database.get<WeeklyReview>('weekly_reviews').find(reviewId)).nutritionDecision
  ).toBe('apply');
  expect(
    await database
      .get<NutritionTargetPeriod>('nutrition_target_periods')
      .query(Q.where('nutrition_goal_id', g.id))
      .fetch()
  ).toHaveLength(2);
});

it('a failed starting projection or undo can be retried without cached prescriptions blocking it', async () => {
  const w = await workout();
  const startFailure = jest
    .spyOn(database.adapter, 'batch')
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(WorkoutProgressionService.applyStartProgression(w.log.id)).rejects.toThrow(
    'disk full'
  );
  startFailure.mockRestore();
  expect(w.sets[0].reps).toBe(10);
  expect(w.sets[0].prescriptionJson).toBeNull();
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  expect(w.sets[0].reps).toBe(8);
  const undoFailure = jest
    .spyOn(database.adapter, 'batch')
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(WorkoutProgressionService.revertStartAdjustment(w.block.id)).rejects.toThrow(
    'disk full'
  );
  undoFailure.mockRestore();
  expect(w.sets[0].reps).toBe(8);
  expect(parseSetPrescription(w.sets[0].prescriptionJson)?.override).toBeUndefined();
  await WorkoutProgressionService.revertStartAdjustment(w.block.id);
  expect(w.sets[0].reps).toBe(10);
});

it('keeps the exercise rule on sets reloaded after a save, so the session does not fall back to automatic', async () => {
  const rule = serializeProgressionRule({ type: 'double_progression', repMin: 8, repMax: 12 })!;
  const w = await workout(rule);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', {
    weight: 60,
    reps: 10,
  });
  // `refresh` reloads through this path; it used to drop `progressionJson`, so every set after the
  // first completion read as rule-free and lost its badge and between-sets behaviour.
  const { sets } = await WorkoutService.getWorkoutWithDetails(w.log.id);
  expect(sets).toHaveLength(3);
  expect(sets.every((set) => set.progressionJson === rule)).toBe(true);
});

it('shows a scheduled workout already trained today as done, and offers the next one instead', async () => {
  const w = await workout();
  const jsToday = new Date().getDay();
  await database.write(async () => {
    await database.batch(
      database.get<Schedule>('schedules').prepareCreate((r) => {
        r.templateId = w.template.id;
        r.dayOfWeek = indexToDayName(jsDayToWeekdayIndex(jsToday));
        r.createdAt = Date.now();
        r.updatedAt = Date.now();
      })
    );
  });
  let [row] = await WorkoutTodayRepository.upcoming();
  expect(row.template.id).toBe(w.template.id);
  expect(row.completedToday).toBe(false);

  await database.write(() =>
    w.log.update((r) => {
      r.completedAt = Date.now();
    })
  );
  [row] = await WorkoutTodayRepository.upcoming();
  expect(row.completedToday).toBe(true);
});

it('counts a week as reviewable only when it holds activity', async () => {
  const period = weeklyReviewPeriod();
  expect(await weekHadActivity(period.start, period.end)).toBe(false);

  const w = await workout();
  await database.write(() =>
    w.log.update((r) => {
      r.completedAt = period.start + 60 * 60 * 1000;
    })
  );
  expect(await weekHadActivity(period.start, period.end)).toBe(true);
  // A workout finished after the week ended belongs to the next review, not this one.
  expect(await weekHadActivity(period.end, period.end + 1)).toBe(false);
});

it('reports what the week holds and whether the user has ever logged', async () => {
  const period = weeklyReviewPeriod();
  expect(await WeeklyReviewService.weekActivity(period.start, period.end)).toEqual({
    workouts: 0,
    foodLogs: 0,
    weighIns: 0,
    everWorkout: false,
    everFood: false,
  });

  // A workout finished after the reviewed week: not this week's, but the user is no first-timer.
  const w = await workout();
  await database.write(() =>
    w.log.update((r) => {
      r.completedAt = period.end + 60 * 60 * 1000;
    })
  );
  const after = await WeeklyReviewService.weekActivity(period.start, period.end);
  expect(after.workouts).toBe(0);
  expect(after.everWorkout).toBe(true);
  expect(after.everFood).toBe(false);

  const overview = await WeeklyReviewService.overview();
  expect(overview.activity).toEqual(after);
});

it.each(['manual', 'daily'] as const)(
  'goal editors leave weekly periods when switching to %s',
  async (mode) => {
    const g = await goal();
    await NutritionGoalService.updateGoal(g.id, { targetMode: mode });
    expect((await NutritionTargetService.resolve(g)).mode).toBe(mode);
    expect(
      (await NutritionTargetService.resolve(g, new Date(localDayKeyPlusCalendarDays(today(), -1))))
        .mode
    ).toBe('weekly');
    expect(g.isDynamic).toBe(mode === 'daily');
  }
);
it('weekly macro edits replace current periods without rewriting earlier days', async () => {
  const g = await goal();
  await NutritionGoalService.updateGoal(g.id, { totalCalories: 2300, protein: 160 });
  expect(await NutritionTargetService.resolve(g)).toMatchObject({
    mode: 'weekly',
    totalCalories: 2300,
    protein: 160,
  });
  expect(
    await NutritionTargetService.resolve(g, new Date(localDayKeyPlusCalendarDays(today(), -1)))
  ).toMatchObject({ mode: 'weekly', totalCalories: 2100, protein: 140 });
});
it('legacy isDynamic edits use the same period transition as explicit mode edits', async () => {
  const g = await goal();
  await NutritionGoalService.updateGoal(g.id, { isDynamic: false });
  expect((await NutritionTargetService.resolve(g)).mode).toBe('manual');
});
it('a failed goal edit keeps cached goal and periods intact and can be retried', async () => {
  const g = await goal();
  const failure = jest
    .spyOn(database.adapter, 'batch')
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(NutritionGoalService.updateGoal(g.id, { targetMode: 'manual' })).rejects.toThrow(
    'disk full'
  );
  failure.mockRestore();
  expect((await NutritionTargetService.resolve(g)).mode).toBe('weekly');
  await NutritionGoalService.updateGoal(g.id, { targetMode: 'manual' });
  expect((await NutritionTargetService.resolve(g)).mode).toBe('manual');
});
it('does not offer a completed-only candidate as Next up', async () => {
  const w = await workout();
  const candidates = jest
    .spyOn(WorkoutTodayRepository, 'upcoming')
    .mockResolvedValue([
      { template: w.template, completedToday: true } as Awaited<
        ReturnType<typeof WorkoutTodayRepository.upcoming>
      >[number],
    ]);
  try {
    expect((await WeeklyReviewService.overview()).training.next).toBeUndefined();
  } finally {
    candidates.mockRestore();
  }
});

it('a split partial block cannot trigger a full-success linear load increase', async () => {
  const w = await workout(
    serializeProgressionRule({
      type: 'linear',
      reps: 5,
      failuresBeforeDeload: 3,
      deloadPercent: 10,
    })!
  );
  const replacement = await workout();
  await WorkoutProgressionService.applyStartProgression(w.log.id);
  await WorkoutSessionService.saveSet(w.log.id, w.sets[0].id, 'performed', { weight: 60, reps: 5 });
  await WorkoutLogExerciseService.replaceLogExercise(w.block.id, replacement.ex.id, {
    reason: 'pain',
    plannedWeightKg: 20,
  });
  await database.write(() =>
    w.log.update((record) => {
      record.completedAt = Date.now();
    })
  );
  const projection = await WorkoutProgressionService.projectTemplate(w.template.id);
  expect(projection[0].previous?.allPrescribedSetsPerformed).toBe(false);
  expect(projection[0].sets[0].weight).toBe(60);
});

it('counts flagged fasts as food days and points the review at the days it is missing', async () => {
  await goal();
  const period = weeklyReviewPeriod();
  const day = (offset: number) => localDayKeyPlusCalendarDays(period.start, offset);
  // Food on the first four days of the week; nothing on days 4–6, and no weigh-ins at all.
  jest
    .spyOn(NutritionService, 'getNutritionLogsForDateRange')
    .mockResolvedValue(
      [0, 1, 2, 3].map((offset) => ({ date: day(offset) + 12 * 3600_000 })) as any
    );
  const proposed = { ...accepted, usedEmpiricalData: true, tdee: 2500, isDynamic: true as const };
  (resolveWeeklyRecommendation as jest.Mock).mockResolvedValue(proposed);
  try {
    const short = await WeeklyReviewService.overview();
    expect(short.nutrition).toMatchObject({ foodDays: 4, weightDays: 0, canApply: false });
    // The earliest day still missing food, and the latest still missing a weigh-in — both inside
    // the reviewed week, never today.
    expect(short.gaps).toEqual({ foodDay: day(4), weightDay: day(6) });

    // Day 4 flagged as a fast gives five food days, but two weigh-ins are still not enough: two
    // noisy readings can fake a trend, so the review asks for another weigh-in on the latest day
    // that has none.
    (SettingsService.getEnableFastedDay as jest.Mock).mockResolvedValue(true);
    jest
      .spyOn(FastedDayRepository, 'getFastedDayKeysForRange')
      .mockResolvedValue(new Set([utcDayKeyFromLocalDate(new Date(day(4)))]));
    const weighIns = (offsets: number[]) =>
      jest.spyOn(UserMetricService, 'getMetricsHistory').mockResolvedValue(
        offsets.map((offset) => ({
          date: day(offset) + 8 * 3600_000,
          timezone: null,
          getDecrypted: async () => ({ value: 80, unit: 'kg' }),
        })) as any
      );
    weighIns([1, 5]);
    const twoWeighIns = await WeeklyReviewService.overview();
    expect(twoWeighIns.nutrition).toMatchObject({ foodDays: 5, weightDays: 2, canApply: false });
    expect(twoWeighIns.gaps).toEqual({ foodDay: null, weightDay: day(6) });

    // The third weigh-in makes the week usable.
    weighIns([1, 3, 5]);
    const enough = await WeeklyReviewService.overview();
    expect(enough.nutrition).toMatchObject({ foodDays: 5, weightDays: 3, canApply: true });
    expect(enough.gaps).toEqual({ foodDay: null, weightDay: null });
  } finally {
    (resolveWeeklyRecommendation as jest.Mock).mockResolvedValue(null);
    (SettingsService.getEnableFastedDay as jest.Mock).mockResolvedValue(false);
    jest.restoreAllMocks();
  }
});

describe('the training half of a review is a decision', () => {
  /** Finishes a workout inside the reviewed week, so the user has trained and the week has data. */
  async function finishedWorkout(at: number) {
    const w = await workout();
    await database.write(() =>
      w.log.update((r) => {
        r.completedAt = at;
      })
    );
    return w;
  }

  it('stores the choice, its evidence and the window it shapes, and reads them back', async () => {
    const period = weeklyReviewPeriod();
    const id = await WeeklyReviewService.decide({
      period,
      section: 'training',
      training: trainingChoice('lighter'),
    });
    const row = await database.get<WeeklyReview>('weekly_reviews').find(id);
    expect(row.trainingDecision).toBe('lighter');
    expect(row.trainingReviewedAt).toEqual(expect.any(Number));
    const snapshot = JSON.parse(row.trainingJson!);
    expect(snapshot).toMatchObject({ decision: 'lighter', recommended: 'progress' });
    expect(snapshot.window.until).toBe(period.next);
    expect(snapshot.window.from).toBeLessThanOrEqual(Date.now());

    expect((await WeeklyReviewService.overview()).training.decision?.decision).toBe('lighter');
    expect((await TrainingWeekRepository.activeTrainingWeek())?.decision).toBe('lighter');
    expect(await TrainingWeekRepository.lighterWeekWindows()).toEqual([snapshot.window]);
  });

  it('does not treat a plain progress decision as an override', async () => {
    await WeeklyReviewService.decide({
      period: weeklyReviewPeriod(),
      section: 'training',
      training: trainingChoice('progress'),
    });
    expect(await TrainingWeekRepository.activeTrainingWeek()).toBeNull();
    expect(await TrainingWeekRepository.lighterWeekWindows()).toEqual([]);
  });

  it('refuses a training review with no decision, or one that is not a decision', async () => {
    const period = weeklyReviewPeriod();
    await expect(WeeklyReviewService.decide({ period, section: 'training' })).rejects.toThrow();
    await expect(
      WeeklyReviewService.decide({
        period,
        section: 'training',
        training: { ...trainingChoice(), decision: 'skip' as never },
      })
    ).rejects.toThrow();
    expect(await WeeklyReviewService.history()).toHaveLength(0);
  });

  it('refuses a review whose week has already ended', async () => {
    const old = weeklyReviewPeriod(new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
    await expect(
      WeeklyReviewService.decide({ period: old, section: 'training', training: trainingChoice() })
    ).rejects.toThrow('ended');
  });

  it('decides once: a second submission returns the first and keeps its choice', async () => {
    const period = weeklyReviewPeriod();
    const first = await WeeklyReviewService.decide({
      period,
      section: 'training',
      training: trainingChoice('repeat'),
    });
    const second = await WeeklyReviewService.decide({
      period,
      section: 'training',
      training: trainingChoice('lighter'),
    });
    expect(second).toBe(first);
    expect((await database.get<WeeklyReview>('weekly_reviews').find(first)).trainingDecision).toBe(
      'repeat'
    );
  });

  it('does not ask a user who has never trained', async () => {
    const overview = await WeeklyReviewService.overview();
    expect(overview.training.canDecide).toBe(false);
    expect(overview.ready).toBe(false);
  });

  it('asks a user who has trained, and stops once they decide', async () => {
    const period = weeklyReviewPeriod();
    await finishedWorkout(period.start + 60 * 60 * 1000);
    const before = await WeeklyReviewService.overview();
    expect(before.training.canDecide).toBe(true);
    expect(before.ready).toBe(true);
    expect(before.training.proposal.recommended).toBe('progress');

    await WeeklyReviewService.decide({
      period,
      section: 'training',
      training: before.training.proposal.recommended
        ? { decision: before.training.proposal.recommended, ...before.training.proposal }
        : trainingChoice(),
    });
    const after = await WeeklyReviewService.overview();
    expect(after.training.canDecide).toBe(false);
    expect(after.ready).toBe(false);
  });

  it('proposes a repeat after a week with no workouts for someone who has trained before', async () => {
    const period = weeklyReviewPeriod();
    await finishedWorkout(period.start - 2 * 24 * 60 * 60 * 1000);
    const overview = await WeeklyReviewService.overview();
    expect(overview.training.proposal.recommended).toBe('repeat');
    expect(overview.training.proposal.reasons).toEqual([{ code: 'noWorkouts' }]);
  });

  it('judges the week against the consistency goal and offers to lower it after two misses', async () => {
    const period = weeklyReviewPeriod();
    await finishedWorkout(period.start + 60 * 60 * 1000);
    await ExerciseGoalService.saveGoal({ goalType: 'consistency', targetSessionsPerWeek: 3 });
    const overview = await WeeklyReviewService.overview();
    expect(overview.training.proposal.goals).toEqual([
      expect.objectContaining({ kind: 'consistency', target: 3, done: 1, status: 'missed' }),
    ]);
    // One workout this week and none the week before: two misses in a row.
    expect(overview.training.consistencySuggestion).toEqual({ kind: 'lower', to: 1 });
  });

  it('shows the decision it froze rather than recomputing it, and hides targets it would not use', async () => {
    const period = weeklyReviewPeriod();
    await finishedWorkout(period.start + 60 * 60 * 1000);
    await WeeklyReviewService.decide({
      period,
      section: 'training',
      training: trainingChoice('lighter'),
    });
    const overview = await WeeklyReviewService.overview();
    expect(overview.training.decision?.decision).toBe('lighter');
    expect(overview.training.targets).toEqual([]);
  });
});
