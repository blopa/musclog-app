import {
  calendarComebackWeek,
  checkpointsDue,
  COMEBACK_MAX_LOAD_FACTOR,
  comebackPhase,
  comebackWeek,
  currentWorkoutRamp,
  weekShiftAfterCheckpoint,
  workoutRamp,
} from '@/utils/comeback/comebackProgram';
import {
  DEFAULT_COMEBACK_STATE,
  MAX_WEEK_SHIFT,
  type ComebackState,
} from '@/utils/comeback/comebackState';

const day = (n: number) => new Date(2026, 8, 1 + n).getTime();

const active = (patch: Partial<ComebackState> = {}): ComebackState => ({
  ...DEFAULT_COMEBACK_STATE,
  status: 'active',
  startedAt: day(0),
  ...patch,
});

describe('comebackWeek', () => {
  it('counts day 1 as week 1 and rolls over every seven calendar days', () => {
    expect(calendarComebackWeek(day(0), day(0))).toBe(1);
    expect(calendarComebackWeek(day(0), day(6))).toBe(1);
    expect(calendarComebackWeek(day(0), day(7))).toBe(2);
    expect(calendarComebackWeek(day(0), day(27))).toBe(4);
    expect(calendarComebackWeek(day(0), day(28))).toBe(5);
  });

  it('is null before a comeback has started', () => {
    expect(comebackWeek(DEFAULT_COMEBACK_STATE, day(3))).toBeNull();
  });

  it('holds back by the weeks the person found too hard, never below week 1', () => {
    expect(comebackWeek(active({ weekShift: 1 }), day(14))).toBe(2);
    expect(comebackWeek(active({ weekShift: 3 }), day(7))).toBe(1);
  });

  it('is not thrown off by a clock change inside the window', () => {
    // Late October crosses the end of daylight saving time in much of Europe.
    const start = new Date(2026, 9, 20).getTime();
    const later = new Date(2026, 9, 27).getTime();

    expect(calendarComebackWeek(start, later)).toBe(2);
  });
});

describe('comebackPhase', () => {
  it('is none until a comeback starts', () => {
    expect(comebackPhase(DEFAULT_COMEBACK_STATE, day(3))).toBe('none');
    expect(comebackPhase(active({ startedAt: null }), day(3))).toBe('none');
  });

  it('is ramp through week 4 and graduated after', () => {
    expect(comebackPhase(active(), day(0))).toBe('ramp');
    expect(comebackPhase(active(), day(27))).toBe('ramp');
    expect(comebackPhase(active(), day(28))).toBe('graduated');
  });

  it('never reports "week 14 of 4" for a restored old active state', () => {
    expect(comebackPhase(active({ startedAt: day(-90) }), day(0))).toBe('graduated');
    expect(currentWorkoutRamp(active({ startedAt: day(-90) }), day(0))).toBeNull();
  });

  it('extends the ramp by held weeks', () => {
    expect(comebackPhase(active({ weekShift: 1 }), day(28))).toBe('ramp');
    expect(comebackPhase(active({ weekShift: 1 }), day(35))).toBe('graduated');
  });

  it('is ended once the person ends it, whatever the date', () => {
    expect(comebackPhase(active({ status: 'ended' }), day(3))).toBe('ended');
    expect(comebackPhase(active({ endedAt: day(2) }), day(3))).toBe('ended');
  });
});

describe('workoutRamp', () => {
  it('starts gentler the longer the break was', () => {
    const factor = (breakLength: 'under1m' | '1to3m' | '3to6m' | 'over6m') =>
      workoutRamp({ breakLength }, 1)?.loadFactor;

    expect(factor('under1m')).toBe(0.9);
    expect(factor('1to3m')).toBe(0.8);
    expect(factor('3to6m')).toBe(0.7);
    expect(factor('over6m')).toBe(0.6);
  });

  it('assumes a moderate break when it was not asked', () => {
    expect(workoutRamp({}, 1)?.loadFactor).toBe(0.8);
  });

  it('follows the research shape: 4 → 3 → 3 → 2 reps in reserve, sets 2 → 2 → 3 → plan', () => {
    const weeks = [1, 2, 3, 4].map((week) => workoutRamp({ breakLength: '3to6m' }, week));

    expect(weeks.map((w) => w?.targetRir)).toEqual([4, 3, 3, 2]);
    expect(weeks.map((w) => w?.maxWorkingSets)).toEqual([2, 2, 3, null]);
    expect(weeks.map((w) => w?.loadFactor)).toEqual([0.7, 0.8, 0.9, 0.95]);
  });

  it('never asks for the full pre-break load, even after a short break', () => {
    for (const week of [1, 2, 3, 4]) {
      expect(workoutRamp({ breakLength: 'under1m' }, week)?.loadFactor).toBeLessThanOrEqual(
        COMEBACK_MAX_LOAD_FACTOR
      );
    }
  });

  it('never decreases week over week', () => {
    for (const breakLength of ['under1m', '1to3m', '3to6m', 'over6m'] as const) {
      const factors = [1, 2, 3, 4].map((week) => workoutRamp({ breakLength }, week)!.loadFactor);
      expect(factors).toEqual([...factors].sort((a, b) => a - b));
    }
  });

  it('keeps a single working set in week one when energy is low', () => {
    expect(workoutRamp({ energy: 'low' }, 1)?.maxWorkingSets).toBe(1);
    expect(workoutRamp({ energy: 'low' }, 2)?.maxWorkingSets).toBe(2);
  });

  it('is null outside the ramp', () => {
    expect(workoutRamp({}, 0)).toBeNull();
    expect(workoutRamp({}, 5)).toBeNull();
    expect(workoutRamp({}, 1.5)).toBeNull();
  });
});

describe('currentWorkoutRamp', () => {
  it('uses the held-back week', () => {
    expect(currentWorkoutRamp(active({ weekShift: 1 }), day(14))?.week).toBe(2);
  });

  it('is null when no comeback is running', () => {
    expect(currentWorkoutRamp(DEFAULT_COMEBACK_STATE, day(3))).toBeNull();
    expect(currentWorkoutRamp(active({ status: 'ended' }), day(3))).toBeNull();
  });
});

describe('checkpointsDue', () => {
  it('is empty before the first checkpoint week has fully passed', () => {
    expect(checkpointsDue(active(), day(13))).toEqual([]);
  });

  it('becomes due once two full weeks have passed, and stays until answered', () => {
    expect(checkpointsDue(active(), day(14))).toEqual([2]);
    expect(checkpointsDue(active(), day(30))).toEqual([2, 4]);
  });

  it('drops answered checkpoints', () => {
    const answered = active({ checkpoints: [{ week: 2, at: day(14), feel: 'right' }] });

    expect(checkpointsDue(answered, day(30))).toEqual([4]);
  });

  it('still asks if a checkpoint was opened but not answered', () => {
    expect(checkpointsDue(active({ checkpoints: [{ week: 2, at: day(14) }] }), day(14))).toEqual([
      2,
    ]);
  });

  it('asks nothing when no comeback is active or it ended', () => {
    expect(checkpointsDue(DEFAULT_COMEBACK_STATE, day(100))).toEqual([]);
    expect(checkpointsDue(active({ status: 'ended' }), day(100))).toEqual([]);
    expect(checkpointsDue(active({ endedAt: day(10) }), day(100))).toEqual([]);
  });

  it('keeps asking the later reflections after graduation', () => {
    expect(checkpointsDue(active(), day(60))).toEqual([2, 4, 8]);
  });
});

describe('weekShiftAfterCheckpoint', () => {
  it('holds a week only for "too hard" in the ramp', () => {
    expect(weekShiftAfterCheckpoint(0, 'hard', 2)).toBe(1);
    expect(weekShiftAfterCheckpoint(0, 'right', 2)).toBe(0);
    expect(weekShiftAfterCheckpoint(0, 'easy', 4)).toBe(0);
  });

  it('does not hold after graduation, and is capped', () => {
    expect(weekShiftAfterCheckpoint(0, 'hard', 8)).toBe(0);
    expect(weekShiftAfterCheckpoint(MAX_WEEK_SHIFT, 'hard', 2)).toBe(MAX_WEEK_SHIFT);
  });
});
