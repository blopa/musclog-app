import './weeklyProgressionMocks';

import { database } from '@/database/database-instance';
import NutritionTargetPeriod from '@/database/models/NutritionTargetPeriod';
import WeeklyReview from '@/database/models/WeeklyReview';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { localDayKeyPlusCalendarDays, utcDayKeyFromLocalDate } from '@/utils/calendarDate';
import { FastedDayRepository } from '@/database/repositories/FastedDayRepository';
import { NutritionService } from '@/database/services/NutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { resolveWeeklyRecommendation } from '@/utils/dynamicNutritionTarget';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { weekHadActivity } from '@/hooks/useWeeklyReviewStatus';
import {
  targets,
  accepted,
  recommendation,
  today,
  goal,
  trainingChoice,
  workout,
  useWeeklyProgressionDatabase,
} from './weeklyProgressionHarness';

useWeeklyProgressionDatabase();

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

it('refuses to approve an expired review, but still lets it be acknowledged', async () => {
  const g = await goal();
  const old = weeklyReviewPeriod(new Date(Date.now() - 21 * 24 * 60 * 60 * 1000));
  expect(old.next).toBeLessThan(Date.now());
  await expect(
    WeeklyReviewService.decide({
      period: old,
      goalId: g.id,
      section: 'nutrition',
      decision: 'apply',
      recommendation,
      accepted,
    })
  ).rejects.toThrow('This review has ended');
  expect(
    (await database.get<NutritionTargetPeriod>('nutrition_target_periods').query().fetch()).length
  ).toBe(1);
  await expect(
    WeeklyReviewService.decide({
      period: old,
      goalId: g.id,
      section: 'nutrition',
      decision: 'keep',
      recommendation,
      accepted: targets,
    })
  ).resolves.toEqual(expect.any(String));
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
