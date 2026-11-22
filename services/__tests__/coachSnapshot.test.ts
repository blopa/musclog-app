import { NutritionGoalService } from '@/database/services/NutritionGoalService';
import { NutritionService } from '@/database/services/NutritionService';
import { NutritionTargetService } from '@/database/services/NutritionTargetService';
import { SettingsService } from '@/database/services/SettingsService';
import { UserMetricService } from '@/database/services/UserMetricService';
import { TrainingWeekRepository } from '@/database/repositories/TrainingWeekRepository';
import { WorkoutTodayRepository } from '@/database/repositories/WorkoutTodayRepository';
import { loadCoachSnapshot } from '@/services/coachSnapshot';

jest.mock('@/database/services/NutritionGoalService', () => ({
  NutritionGoalService: { getCurrent: jest.fn() },
}));

jest.mock('@/database/services/NutritionService', () => ({
  NutritionService: { getDailyNutrients: jest.fn() },
}));

jest.mock('@/database/services/NutritionTargetService', () => ({
  NutritionTargetService: { resolve: jest.fn() },
}));

jest.mock('@/database/services/SettingsService', () => ({
  SettingsService: { getIntuitiveEatingMode: jest.fn(), getUnits: jest.fn() },
}));

jest.mock('@/database/services/UserMetricService', () => ({
  UserMetricService: { getLatest: jest.fn(), getLatestOnOrBefore: jest.fn() },
}));

jest.mock('@/database/repositories/TrainingWeekRepository', () => ({
  TrainingWeekRepository: { activeTrainingWeek: jest.fn() },
}));

jest.mock('@/database/repositories/WorkoutTodayRepository', () => ({
  WorkoutTodayRepository: { upcoming: jest.fn() },
}));

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 22, 12, 0, 0);

const getCurrent = NutritionGoalService.getCurrent as jest.Mock;
const getDailyNutrients = NutritionService.getDailyNutrients as jest.Mock;
const resolve = NutritionTargetService.resolve as jest.Mock;
const getIntuitiveEatingMode = SettingsService.getIntuitiveEatingMode as jest.Mock;
const getUnits = SettingsService.getUnits as jest.Mock;
const getLatest = UserMetricService.getLatest as jest.Mock;
const getLatestOnOrBefore = UserMetricService.getLatestOnOrBefore as jest.Mock;
const activeTrainingWeek = TrainingWeekRepository.activeTrainingWeek as jest.Mock;
const upcoming = WorkoutTodayRepository.upcoming as jest.Mock;

function metric(id: string, date: number, value: number, unit = 'kg') {
  return {
    id,
    date,
    getDecrypted: async () => ({ value, unit }),
  };
}

const TARGETS = {
  totalCalories: 2200,
  protein: 160,
  carbs: 200,
  fats: 70,
  fiber: 30,
};

const DAILY = {
  calories: 1400,
  protein: 90,
  carbs: 150,
  fat: 40,
  fiber: 14,
};

function setFullData() {
  getIntuitiveEatingMode.mockResolvedValue(false);
  getCurrent.mockResolvedValue({ id: 'goal-1' });
  resolve.mockResolvedValue(TARGETS);
  getDailyNutrients.mockResolvedValue(DAILY);
  getUnits.mockResolvedValue('metric');
  getLatest.mockResolvedValue(metric('latest', NOW.getTime(), 82));
  getLatestOnOrBefore.mockResolvedValue(metric('earlier', NOW.getTime() - 28 * DAY_MS, 82.8));
  upcoming.mockResolvedValue([
    {
      template: { name: 'Push Day' },
      completedToday: false,
      scheduled: true,
      lastCompletedAt: null,
    },
  ]);
  activeTrainingWeek.mockResolvedValue({
    decision: 'lighter',
    snapshot: { window: { until: new Date(2026, 10, 25, 12).getTime() } },
  });
}

describe('loadCoachSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    getIntuitiveEatingMode.mockResolvedValue(false);
    getCurrent.mockResolvedValue(null);
    getDailyNutrients.mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
    resolve.mockResolvedValue(null);
    getUnits.mockResolvedValue('metric');
    getLatest.mockResolvedValue(null);
    getLatestOnOrBefore.mockResolvedValue(null);
    upcoming.mockResolvedValue([]);
    activeTrainingWeek.mockResolvedValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('states every line when all sources have data', async () => {
    setFullData();

    const text = await loadCoachSnapshot(NOW);

    expect(text).toContain('Right now, read from the app');
    expect(text).toContain(
      '- Nutrition today (eaten/target): calories 1400/2200 kcal, protein 90/160 g, carbs 136/200 g, fat 40/70 g, fiber 14/30 g.'
    );
    expect(text).toContain('- Weight: down 0.8 kg over the last 28 days.');
    expect(text).toContain('- Workout today: "Push Day" is planned, not done yet.');
    expect(text).toContain(
      '- Training week: they chose a lighter week in their Weekly Review (until 2026-11-25); loads and sets are deliberately reduced.'
    );
  });

  it('digests carbs by subtracting fiber on the eaten side only', async () => {
    setFullData();

    const text = await loadCoachSnapshot(NOW);

    // 150 g logged carbs include 14 g fiber: 136 g digestible.
    expect(text).toContain('carbs 136/200 g');
    expect(text).not.toContain('carbs 150/200 g');
  });

  it('leaves out the nutrition line in intuitive eating mode and never reads goals or logs', async () => {
    setFullData();
    getIntuitiveEatingMode.mockResolvedValue(true);

    const text = await loadCoachSnapshot(NOW);

    expect(text).not.toContain('Nutrition');
    expect(text).toContain('- Weight: down 0.8 kg over the last 28 days.');
    expect(text).toContain('- Workout today: "Push Day" is planned, not done yet.');
    expect(getCurrent).not.toHaveBeenCalled();
    expect(getDailyNutrients).not.toHaveBeenCalled();
  });

  it('says nothing is logged yet, with targets, when the day is empty and a goal exists', async () => {
    getIntuitiveEatingMode.mockResolvedValue(false);
    getCurrent.mockResolvedValue({ id: 'goal-1' });
    resolve.mockResolvedValue(TARGETS);
    getDailyNutrients.mockResolvedValue({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });

    const text = await loadCoachSnapshot(NOW);

    expect(text).toContain(
      '- Nutrition today: nothing logged yet. Targets: 2200 kcal, protein 160 g, carbs 200 g, fat 70 g, fiber 30 g.'
    );
  });

  it('omits the weight line with a single weigh-in, even when both lookups return the same record', async () => {
    const only = metric('only', NOW.getTime(), 82);
    getLatest.mockResolvedValue(only);
    getLatestOnOrBefore.mockResolvedValue(only);

    const text = await loadCoachSnapshot(NOW);

    expect(text).not.toContain('Weight');
  });

  it('omits the weight line when the span is under seven days', async () => {
    getLatest.mockResolvedValue(metric('latest', NOW.getTime(), 82));
    getLatestOnOrBefore.mockResolvedValue(metric('earlier', NOW.getTime() - 3 * DAY_MS, 82.5));

    const text = await loadCoachSnapshot(NOW);

    expect(text).not.toContain('Weight');
  });

  it('states the weight change in pounds in imperial units', async () => {
    setFullData();
    getUnits.mockResolvedValue('imperial');

    const text = await loadCoachSnapshot(NOW);

    // 0.8 kg is 1.76 lb, shown to one decimal.
    expect(text).toContain('- Weight: down 1.8 lbs over the last 28 days.');
  });

  it('ignores a rest-day suggestion that only has lastCompletedAt set', async () => {
    upcoming.mockResolvedValue([
      {
        template: { name: 'Legs' },
        completedToday: false,
        scheduled: false,
        lastCompletedAt: NOW.getTime() - 5 * DAY_MS,
      },
    ]);

    const text = await loadCoachSnapshot(NOW);

    expect(text).not.toContain('Legs');
    expect(text).not.toContain('Workout today');
  });

  it('reads a completed workout as already done', async () => {
    upcoming.mockResolvedValue([
      {
        template: { name: 'Pull Day' },
        completedToday: true,
        scheduled: true,
        lastCompletedAt: null,
      },
    ]);

    const text = await loadCoachSnapshot(NOW);

    expect(text).toContain('- Workout today: "Pull Day", already done.');
  });

  it('keeps the rest of the snapshot when one source rejects', async () => {
    setFullData();
    getDailyNutrients.mockRejectedValue(new Error('db unavailable'));

    const text = await loadCoachSnapshot(NOW);

    expect(text).not.toContain('Nutrition');
    expect(text).toContain('- Weight: down 0.8 kg over the last 28 days.');
    expect(text).toContain('- Workout today: "Push Day" is planned, not done yet.');
    expect(console.warn).toHaveBeenCalledWith(
      '[coachSnapshot] nutrition failed:',
      expect.any(Error)
    );
  });

  it('returns an empty string when every source has nothing to say', async () => {
    getDailyNutrients.mockRejectedValue(new Error('db unavailable'));
    getLatest.mockRejectedValue(new Error('db unavailable'));
    upcoming.mockRejectedValue(new Error('db unavailable'));
    activeTrainingWeek.mockRejectedValue(new Error('db unavailable'));

    await expect(loadCoachSnapshot(NOW)).resolves.toBe('');
  });
});
