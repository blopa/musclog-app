import './weeklyProgressionMocks';

import { database } from '@/database/database-instance';
import WeeklyReview from '@/database/models/WeeklyReview';
import { WeeklyReviewService } from '@/database/services/WeeklyReviewService';
import { weeklyReviewPeriod } from '@/utils/weeklyReviewPeriod';
import { ExerciseGoalService } from '@/database/services/ExerciseGoalService';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import {
  targets,
  goal,
  trainingChoice,
  workout,
  useWeeklyProgressionDatabase,
} from './weeklyProgressionHarness';

useWeeklyProgressionDatabase();

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
