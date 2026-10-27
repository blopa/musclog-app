import {
  DEFAULT_COMEBACK_STATE,
  MAX_WEEK_SHIFT,
  parseComebackState,
  serializeComebackState,
  tracksNutrition,
  tracksWorkouts,
  type ComebackState,
} from '@/utils/comeback/comebackState';

describe('appliedTargets', () => {
  it('drops a malformed record instead of throwing', () => {
    expect(
      parseComebackState(JSON.stringify({ appliedTargets: { totalCalories: 'lots' } }))
        .appliedTargets
    ).toBeNull();
    expect(parseComebackState(JSON.stringify({ appliedTargets: 5 })).appliedTargets).toBeNull();
  });
});

describe('parseComebackState', () => {
  it('returns the defaults for empty, malformed and non-object input', () => {
    for (const raw of [null, undefined, '', 'not json', '[]', '"text"', '12']) {
      expect(parseComebackState(raw)).toEqual(DEFAULT_COMEBACK_STATE);
    }
  });

  it('does not share mutable defaults between calls', () => {
    const first = parseComebackState(null);
    first.minimumDays.push('2026-10-01');
    first.answers.energy = 'low';

    expect(parseComebackState(null).minimumDays).toEqual([]);
    expect(parseComebackState(null).answers).toEqual({});
  });

  it('round-trips a full state', () => {
    const state: ComebackState = {
      status: 'active',
      track: 'workout',
      startedAt: 1_700_000_000_000,
      baseBefore: 1_690_000_000_000,
      endedAt: null,
      weekShift: 1,
      answers: {
        breakLength: '3to6m',
        location: 'home',
        daysPerWeek: 2,
        weekDays: [1, 4],
        time: '18:00',
        start: 'shortPlan',
        eating: 'out',
        tracking: 'caloriesProtein',
        nutritionGoal: 'loseSlowly',
        energy: 'some',
      },
      checkpoints: [{ week: 2, at: 1_700_500_000_000, feel: 'right' }],
      minimumDays: ['2026-10-01', '2026-10-03'],
      offerDismissal: { at: 1_690_000_000_000, lastActivityAt: 1_680_000_000_000 },
      appliedTargets: { totalCalories: 2400, at: 1_700_000_000_000 },
      shortPlanId: 'plan-1',
      deficitDecision: 'accepted',
    };

    expect(parseComebackState(serializeComebackState(state))).toEqual(state);
  });

  it('drops unknown or out-of-range answers instead of throwing', () => {
    const parsed = parseComebackState(
      JSON.stringify({
        status: 'weird',
        track: 'nope',
        weekShift: 99,
        answers: {
          breakLength: 'forever',
          location: 'moon',
          daysPerWeek: 99,
          weekDays: [4, 1, 1, 9, -1, 'x'],
          time: '25:99',
          energy: 'low',
        },
      })
    );

    expect(parsed.status).toBe('none');
    expect(parsed.track).toBe('both');
    expect(parsed.weekShift).toBe(MAX_WEEK_SHIFT);
    expect(parsed.answers).toEqual({ daysPerWeek: 4, weekDays: [1, 4], energy: 'low' });
  });

  it('keeps one check-in per week, sorted, and ignores invalid entries', () => {
    const parsed = parseComebackState(
      JSON.stringify({
        checkpoints: [
          { week: 4, at: 2, feel: 'hard' },
          { week: 2, at: 1 },
          { week: 2, at: 3, feel: 'easy' },
          { week: 5, at: 1 },
          { week: 8 },
          'junk',
        ],
      })
    );

    expect(parsed.checkpoints).toEqual([
      { week: 2, at: 3, feel: 'easy' },
      { week: 4, at: 2, feel: 'hard' },
    ]);
  });

  it('dedupes, sorts and caps minimum days and ignores malformed ones', () => {
    const days = Array.from({ length: 150 }, (_, i) => {
      const date = new Date(2026, 0, 1 + i);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
        date.getDate()
      ).padStart(2, '0')}`;
    });
    const parsed = parseComebackState(
      JSON.stringify({ minimumDays: [...days, days[0], '2026-1-1', 5] })
    );

    expect(parsed.minimumDays).toHaveLength(120);
    expect(parsed.minimumDays[parsed.minimumDays.length - 1]).toBe(days[days.length - 1]);
    expect(parsed.minimumDays).toEqual([...parsed.minimumDays].sort());
  });

  it('requires both fields of an offer dismissal', () => {
    expect(
      parseComebackState(JSON.stringify({ offerDismissal: { at: 1 } })).offerDismissal
    ).toBeNull();
    expect(
      parseComebackState(JSON.stringify({ offerDismissal: { at: 1, lastActivityAt: 2 } }))
        .offerDismissal
    ).toEqual({ at: 1, lastActivityAt: 2 });
  });
});

describe('track helpers', () => {
  it('maps tracks to the halves they cover', () => {
    expect(tracksWorkouts('workout')).toBe(true);
    expect(tracksWorkouts('both')).toBe(true);
    expect(tracksWorkouts('nutrition')).toBe(false);
    expect(tracksNutrition('nutrition')).toBe(true);
    expect(tracksNutrition('both')).toBe(true);
    expect(tracksNutrition('workout')).toBe(false);
  });
});
