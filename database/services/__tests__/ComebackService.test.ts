import { ComebackService } from '@/database/services/ComebackService';
import { ComebackNutritionService } from '@/database/services/ComebackNutritionService';
import { SettingsService } from '@/database/services/SettingsService';
import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { updateComebackState: jest.fn(), getComebackState: jest.fn() },
}));
jest.mock('@/database/services/ComebackNutritionService', () => ({
  ComebackNutritionService: { apply: jest.fn() },
}));
jest.mock('@/database/repositories/WorkoutTemplateRepository', () => ({
  WorkoutTemplateRepository: { getActive: jest.fn() },
}));

let stored: ComebackState;
const day = (n: number) => new Date(2026, 8, 1 + n).getTime();

describe('ComebackService', () => {
  beforeEach(() => {
    stored = {
      ...DEFAULT_COMEBACK_STATE,
      status: 'active',
      startedAt: day(0),
      baseBefore: day(0),
    };
    (SettingsService.getComebackState as jest.Mock).mockImplementation(async () => stored);
    (SettingsService.updateComebackState as jest.Mock).mockImplementation(async (change) => {
      stored = typeof change === 'function' ? change(stored) : { ...stored, ...change };
      return stored;
    });
  });

  it('logs and undoes a minimum day', async () => {
    await ComebackService.logMinimumDay(day(2));
    expect(stored.minimumDays).toEqual(['2026-09-03']);

    await ComebackService.undoMinimumDay(day(2));
    expect(stored.minimumDays).toEqual([]);
  });

  it('remembers a dismissal for the gap it was made for', async () => {
    await ComebackService.dismissOffer(day(-90));

    expect(stored.offerDismissal?.lastActivityAt).toBe(day(-90));
  });

  it('restarts week one without moving the baseline cutoff', async () => {
    stored = { ...stored, startedAt: day(-20), weekShift: 2 };

    await ComebackService.restartWeekOne();

    expect(stored.weekShift).toBe(0);
    expect(stored.baseBefore).toBe(day(0));
    expect(stored.startedAt).toBeGreaterThan(day(-20));
  });

  it('ends a comeback and keeps its history', async () => {
    await ComebackService.logMinimumDay(day(1));
    await ComebackService.end();

    expect(stored.status).toBe('ended');
    expect(stored.endedAt).not.toBeNull();
    expect(stored.minimumDays).toHaveLength(1);
  });

  it('holds the ramp back when a check-in felt too hard', async () => {
    await ComebackService.answerCheckpoint(2, 'hard');

    expect(stored.weekShift).toBe(1);
  });

  it('merges edited answers', async () => {
    stored = { ...stored, answers: { energy: 'low' } };

    await ComebackService.updateAnswers({ answers: { eating: 'out' } });

    expect(stored.answers).toEqual({ energy: 'low', eating: 'out' });
  });

  describe('the week-2 deficit offer', () => {
    it('writes the deficit and remembers the person accepted', async () => {
      stored = { ...stored, answers: { nutritionGoal: 'loseSlowly' } };
      (ComebackNutritionService.apply as jest.Mock).mockResolvedValue({ status: 'applied' });

      const result = await ComebackService.acceptDeficit();

      expect(result.status).toBe('applied');
      expect(ComebackNutritionService.apply).toHaveBeenCalledWith(
        { nutritionGoal: 'loseSlowly' },
        { applyDeficit: true }
      );
      expect(stored.deficitDecision).toBe('accepted');
    });

    it('treats targets changed since setup as a decision not to overwrite them', async () => {
      (ComebackNutritionService.apply as jest.Mock).mockResolvedValue({ status: 'changedSince' });

      await ComebackService.acceptDeficit();

      expect(stored.deficitDecision).toBe('declined');
    });

    it('does not record a decision when the write could not happen', async () => {
      (ComebackNutritionService.apply as jest.Mock).mockResolvedValue({ status: 'noProfile' });

      await ComebackService.acceptDeficit();

      expect(stored.deficitDecision).toBeNull();
    });

    it('declining is remembered', async () => {
      await ComebackService.declineDeficit();

      expect(stored.deficitDecision).toBe('declined');
    });
  });

  it('knows whether the person has workouts of their own', async () => {
    const { WorkoutTemplateRepository } = jest.requireMock(
      '@/database/repositories/WorkoutTemplateRepository'
    );
    WorkoutTemplateRepository.getActive.mockReturnValue({ fetchCount: async () => 3 });
    expect(await ComebackService.hasWorkouts()).toBe(true);

    WorkoutTemplateRepository.getActive.mockReturnValue({ fetchCount: async () => 0 });
    expect(await ComebackService.hasWorkouts()).toBe(false);
  });
});
