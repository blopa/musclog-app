import {
  COACH_SNAPSHOT_HEADING,
  type CoachSnapshotInput,
  formatCoachSnapshot,
  type SnapshotMacros,
} from '../coachSnapshot';

const TARGETS: SnapshotMacros = {
  calories: 2200,
  protein: 160,
  carbs: 200,
  fat: 70,
  fiber: 30,
};

const EMPTY: CoachSnapshotInput = {
  targets: null,
  eatenToday: null,
  loggedFoodToday: false,
  weightChange: null,
  workout: null,
  trainingWeek: null,
};

describe('formatCoachSnapshot', () => {
  it('returns an empty string when every input is empty', () => {
    expect(formatCoachSnapshot(EMPTY)).toBe('');
  });

  describe('nutrition', () => {
    it('formats eaten/target pairs with whole-number rounding', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        targets: TARGETS,
        loggedFoodToday: true,
        eatenToday: { calories: 1400.4, protein: 90.4, carbs: 150.5, fat: 40.2, fiber: 20.6 },
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Nutrition today (eaten/target): calories 1400/2200 kcal, protein 90/160 g, carbs 151/200 g, fat 40/70 g, fiber 21/30 g.`
      );
    });

    it('says nothing is logged yet and states the targets', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        targets: TARGETS,
        eatenToday: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        loggedFoodToday: false,
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Nutrition today: nothing logged yet. Targets: 2200 kcal, protein 160 g, carbs 200 g, fat 70 g, fiber 30 g.`
      );
    });

    it('says nothing is logged yet without targets', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        eatenToday: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
        loggedFoodToday: false,
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Nutrition today: nothing logged yet.`);
    });

    it('states eaten totals without a target when there is no goal (intuitive eating)', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        targets: null,
        loggedFoodToday: true,
        eatenToday: { calories: 900.2, protein: 60, carbs: 80.4, fat: 30, fiber: 12 },
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Nutrition today: 900 kcal eaten so far (protein 60 g, carbs 80 g, fat 30 g, fiber 12 g).`
      );
    });

    it('omits the nutrition line when nutrition could not be read', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        targets: TARGETS,
        loggedFoodToday: true,
        eatenToday: null,
        weightChange: { amount: -1, unit: 'kg', days: 7 },
      });

      expect(text).not.toContain('Nutrition today');
      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Weight: down 1 kg over the last 7 days.`);
    });
  });

  describe('weight', () => {
    it('reports a fall with its absolute size', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        weightChange: { amount: -1.26, unit: 'kg', days: 14 },
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Weight: down 1.3 kg over the last 14 days.`);
    });

    it('reports a rise', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        weightChange: { amount: 0.7, unit: 'lbs', days: 7 },
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Weight: up 0.7 lbs over the last 7 days.`);
    });

    it('rounds to one decimal before deciding the direction', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        weightChange: { amount: -2.34, unit: 'kg', days: 30 },
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Weight: down 2.3 kg over the last 30 days.`);
    });

    it('reports unchanged when the change rounds to zero, in either direction', () => {
      const up = formatCoachSnapshot({
        ...EMPTY,
        weightChange: { amount: 0.04, unit: 'kg', days: 30 },
      });
      const down = formatCoachSnapshot({
        ...EMPTY,
        weightChange: { amount: -0.04, unit: 'kg', days: 30 },
      });

      expect(up).toBe(`${COACH_SNAPSHOT_HEADING}\n- Weight: unchanged over the last 30 days.`);
      expect(down).toBe(up);
    });
  });

  describe('workout', () => {
    it('says a workout scheduled today is already done', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        workout: { name: 'Push A', completedToday: true, scheduled: true },
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Workout today: "Push A", already done.`);
    });

    it('says a scheduled workout is planned and not done yet', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        workout: { name: 'Push A', completedToday: false, scheduled: true },
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Workout today: "Push A" is planned, not done yet.`
      );
    });

    it('names the next workout in the plan when nothing is scheduled today', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        workout: { name: 'Pull B', completedToday: false, scheduled: false },
      });

      expect(text).toBe(`${COACH_SNAPSHOT_HEADING}\n- Next workout in their plan: "Pull B".`);
    });
  });

  describe('training week', () => {
    it('describes a lighter week with its end day', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        trainingWeek: { decision: 'lighter', untilDay: '2026-11-29' },
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Training week: they chose a lighter week in their Weekly Review (until 2026-11-29); loads and sets are deliberately reduced.`
      );
    });

    it('describes a repeated week with its end day', () => {
      const text = formatCoachSnapshot({
        ...EMPTY,
        trainingWeek: { decision: 'repeat', untilDay: '2026-11-29' },
      });

      expect(text).toBe(
        `${COACH_SNAPSHOT_HEADING}\n- Training week: they chose to repeat last week's targets in their Weekly Review (until 2026-11-29).`
      );
    });
  });

  it('starts with the heading and joins lines with newlines', () => {
    const text = formatCoachSnapshot({
      ...EMPTY,
      weightChange: { amount: -1, unit: 'kg', days: 7 },
      workout: { name: 'Legs', completedToday: false, scheduled: true },
    });

    expect(text.startsWith(COACH_SNAPSHOT_HEADING)).toBe(true);
    expect(text.split('\n')).toEqual([
      COACH_SNAPSHOT_HEADING,
      '- Weight: down 1 kg over the last 7 days.',
      '- Workout today: "Legs" is planned, not done yet.',
    ]);
  });

  it('keeps a fully populated snapshot under 900 characters', () => {
    const text = formatCoachSnapshot({
      targets: TARGETS,
      eatenToday: { calories: 1400, protein: 90, carbs: 150, fat: 40, fiber: 20 },
      loggedFoodToday: true,
      weightChange: { amount: -1.4, unit: 'kg', days: 30 },
      workout: { name: 'Upper body strength A', completedToday: false, scheduled: true },
      trainingWeek: { decision: 'lighter', untilDay: '2026-11-29' },
    });

    expect(text.split('\n')).toHaveLength(5);
    expect(text.length).toBeLessThan(900);
  });
});
