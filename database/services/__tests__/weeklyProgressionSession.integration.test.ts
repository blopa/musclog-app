import './weeklyProgressionMocks';

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
import WorkoutLogExercise from '@/database/models/WorkoutLogExercise';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { WorkoutProgressionService } from '@/database/services/WorkoutProgressionService';
import { WorkoutSessionService } from '@/database/services/WorkoutSessionService';
import { localDayKeyPlusCalendarDays } from '@/utils/calendarDate';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import {
  serializeProgressionRule,
  parseSessionProgressionState,
} from '@/utils/progressionRuleSchema';
import { parseSetPrescription } from '@/utils/setPrescription';
import { WorkoutTemplateService } from '@/database/services/WorkoutTemplateService';
import { WorkoutService } from '@/database/services/WorkoutService';
import { WorkoutLogExerciseService } from '@/database/services/WorkoutLogExerciseService';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { dumpDatabase } from '@/database/exportDb.web';
import { restoreDatabase } from '@/database/importDb';
import { appExerciseId } from '@/utils/exerciseImage';
import { parseProgressionRule } from '@/utils/progressionRuleSchema';
import { Q } from '@nozbe/watermelondb';
import Schedule from '@/database/models/Schedule';
import { indexToDayName, jsDayToWeekdayIndex } from '@/utils/weekdays';
import {
  targets,
  accepted,
  recommendation,
  today,
  goal,
  workout,
  repeatWeekState,
  useWeeklyProgressionDatabase,
} from './weeklyProgressionHarness';

useWeeklyProgressionDatabase();

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

it('a repeat week hands the accumulated training max on instead of resetting the rule', async () => {
  expect(await repeatWeekState()).toBe(120);
});

it('a repeat week does not pair a changed starting max or a reset with the old training max', async () => {
  // Carrying 120 kg next to the new rule would make the next session see an unchanged rule and
  // keep loading from 120 kg, silently ignoring what the user just set.
  expect(await repeatWeekState((rule) => ({ ...rule, trainingMaxKg: 90 }))).toBeUndefined();
  expect(await repeatWeekState((rule) => ({ ...rule, resetAt: Date.now() }))).toBeUndefined();
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
