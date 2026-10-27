import {
  COMEBACK_TIME_CHOICES,
  DEFAULT_COMEBACK_TIME,
  hasIfThenCue,
  planWeeks,
  showsLongBreakNote,
} from '@/utils/comeback/comebackPlanSummary';

describe('planWeeks', () => {
  it('lays out the four weeks from the ramp', () => {
    const rows = planWeeks({ breakLength: '1to3m', daysPerWeek: 2 });

    expect(rows.map((row) => row.week)).toEqual([1, 2, 3, 4]);
    expect(rows.map((row) => row.rir)).toEqual([4, 3, 3, 2]);
    expect(rows.map((row) => row.sets)).toEqual([2, 2, 3, null]);
    expect(rows.map((row) => row.percent)).toEqual([80, 90, 95, 95]);
    expect(rows.every((row) => row.sessions === 2)).toBe(true);
  });

  it('starts lower after a longer break and in one set for low energy', () => {
    const rows = planWeeks({ breakLength: 'over6m', energy: 'low' });

    expect(rows[0].percent).toBe(60);
    expect(rows[0].sets).toBe(1);
    expect(rows[0].sessions).toBeNull();
  });

  it('never reaches the full pre-break load', () => {
    for (const breakLength of ['under1m', '1to3m', '3to6m', 'over6m'] as const) {
      expect(Math.max(...planWeeks({ breakLength }).map((row) => row.percent))).toBeLessThan(100);
    }
  });
});

describe('showsLongBreakNote', () => {
  it('is for breaks of three months or more', () => {
    expect(showsLongBreakNote({ breakLength: 'under1m' })).toBe(false);
    expect(showsLongBreakNote({ breakLength: '1to3m' })).toBe(false);
    expect(showsLongBreakNote({ breakLength: '3to6m' })).toBe(true);
    expect(showsLongBreakNote({ breakLength: 'over6m' })).toBe(true);
    expect(showsLongBreakNote({})).toBe(false);
  });
});

describe('the cue', () => {
  it('needs a weekday', () => {
    expect(hasIfThenCue({})).toBe(false);
    expect(hasIfThenCue({ weekDays: [] })).toBe(false);
    expect(hasIfThenCue({ weekDays: [0] })).toBe(true);
  });

  it('defaults to a time that is one of the choices', () => {
    expect(COMEBACK_TIME_CHOICES).toContain(DEFAULT_COMEBACK_TIME);
  });
});
