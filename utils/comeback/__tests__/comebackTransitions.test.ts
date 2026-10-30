import {
  answersUpdatedState,
  checkpointAnsweredState,
  clearedState,
  deficitDecidedState,
  dismissedState,
  endedState,
  minimumDayKey,
  minimumDayLoggedState,
  minimumDayUndoneState,
  rampEndsAt,
  restartedState,
  startedState,
} from '@/utils/comeback/comebackTransitions';
import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';

const day = (n: number) => new Date(2026, 8, 1 + n).getTime();
const active = (patch: Partial<ComebackState> = {}): ComebackState => ({
  ...DEFAULT_COMEBACK_STATE,
  status: 'active',
  startedAt: day(0),
  baseBefore: day(0),
  ...patch,
});

describe('startedState', () => {
  it('starts on today, with the baseline cutoff at the same moment', () => {
    const next = startedState(DEFAULT_COMEBACK_STATE, {
      track: 'both',
      answers: { energy: 'low' },
      today: day(10),
    });

    expect(next).toMatchObject({
      status: 'active',
      track: 'both',
      startedAt: day(10),
      baseBefore: day(10),
      endedAt: null,
      weekShift: 0,
      answers: { energy: 'low' },
    });
  });

  it('keeps the baseline cutoff when a running comeback is started again', () => {
    const next = startedState(active({ baseBefore: day(0), startedAt: day(14) }), {
      track: 'workout',
      answers: {},
      today: day(20),
    });

    expect(next.baseBefore).toBe(day(0));
    expect(next.startedAt).toBe(day(20));
  });

  it('takes a fresh cutoff for a new comeback after an ended one', () => {
    const ended = endedState(active({ baseBefore: day(0) }), day(40));
    const next = startedState(ended, { track: 'both', answers: {}, today: day(300) });

    expect(next.baseBefore).toBe(day(300));
    expect(next.endedAt).toBeNull();
  });

  it('clears the old check-ins, weeks held back and offer dismissal', () => {
    const next = startedState(
      active({
        weekShift: 2,
        checkpoints: [{ week: 2, at: day(8), feel: 'hard' }],
        offerDismissal: { at: 1, lastActivityAt: 1 },
      }),
      { track: 'both', answers: {}, today: day(20) }
    );

    expect(next.weekShift).toBe(0);
    expect(next.checkpoints).toEqual([]);
    expect(next.offerDismissal).toBeNull();
  });
});

describe('restartedState', () => {
  it('makes today day 1 again without moving the baseline cutoff', () => {
    const next = restartedState(
      active({
        baseBefore: day(0),
        startedAt: day(14),
        weekShift: 1,
        checkpoints: [{ week: 2, at: 1 }],
      }),
      day(30)
    );

    expect(next).toMatchObject({
      startedAt: day(30),
      baseBefore: day(0),
      weekShift: 0,
      checkpoints: [],
    });
  });

  it('keeps the minimum days and the answers', () => {
    const next = restartedState(
      active({ minimumDays: ['2026-09-02'], answers: { location: 'home' } }),
      day(30)
    );

    expect(next.minimumDays).toEqual(['2026-09-02']);
    expect(next.answers).toEqual({ location: 'home' });
  });
});

describe('endedState', () => {
  it('records when it ended and keeps the history', () => {
    const next = endedState(active({ minimumDays: ['2026-09-02'] }), day(40));

    expect(next).toMatchObject({ status: 'ended', endedAt: day(40), startedAt: day(0) });
    expect(next.minimumDays).toEqual(['2026-09-02']);
  });
});

describe('answersUpdatedState', () => {
  it('merges answers and changes nothing about the dates', () => {
    const next = answersUpdatedState(active({ answers: { energy: 'low', eating: 'out' } }), {
      answers: { energy: 'plenty' },
      track: 'nutrition',
    });

    expect(next.answers).toEqual({ energy: 'plenty', eating: 'out' });
    expect(next.track).toBe('nutrition');
    expect(next.startedAt).toBe(day(0));
  });
});

describe('dismissedState', () => {
  it('remembers which gap the offer was declined for', () => {
    expect(dismissedState(DEFAULT_COMEBACK_STATE, day(5), day(-90)).offerDismissal).toEqual({
      at: day(5),
      lastActivityAt: day(-90),
    });
  });
});

describe('minimum days', () => {
  it('logs a day once, in order', () => {
    let state = active();
    state = minimumDayLoggedState(state, day(3));
    state = minimumDayLoggedState(state, day(1));
    state = minimumDayLoggedState(state, day(3));

    expect(state.minimumDays).toEqual([minimumDayKey(day(1)), minimumDayKey(day(3))]);
  });

  it('returns the same state for a day already logged', () => {
    const state = minimumDayLoggedState(active(), day(1));

    expect(minimumDayLoggedState(state, day(1))).toBe(state);
  });

  it('caps the list at the newest days', () => {
    let state = active();
    for (let i = 0; i < 130; i++) {
      state = minimumDayLoggedState(state, day(i));
    }

    expect(state.minimumDays).toHaveLength(120);
    expect(state.minimumDays[119]).toBe(minimumDayKey(day(129)));
  });

  it('can be undone', () => {
    const state = minimumDayLoggedState(active(), day(1));

    expect(minimumDayUndoneState(state, day(1)).minimumDays).toEqual([]);
    expect(minimumDayUndoneState(active(), day(1)).minimumDays).toEqual([]);
  });
});

describe('checkpointAnsweredState', () => {
  it('holds the ramp back a week when week 2 or 4 felt too hard', () => {
    const next = checkpointAnsweredState(active(), 2, 'hard', day(8));

    expect(next.weekShift).toBe(1);
    expect(next.checkpoints).toEqual([{ week: 2, at: day(8), feel: 'hard' }]);
  });

  it('only records how a week-8 or week-12 reflection felt', () => {
    expect(checkpointAnsweredState(active(), 8, 'hard', day(60)).weekShift).toBe(0);
  });

  it('replaces an earlier answer for the same week instead of stacking it', () => {
    let state = checkpointAnsweredState(active(), 2, 'easy', day(8));
    state = checkpointAnsweredState(state, 2, 'right', day(9));

    expect(state.checkpoints).toEqual([{ week: 2, at: day(9), feel: 'right' }]);
  });
});

describe('clearedState / rampEndsAt', () => {
  it('clears to an empty state that shares nothing', () => {
    const cleared = clearedState();
    cleared.minimumDays.push('x');

    expect(clearedState().minimumDays).toEqual([]);
  });

  it('puts the end of the ramp four weeks plus the held weeks after day 1', () => {
    expect(rampEndsAt(active({ weekShift: 1 }), 4)).toBe(new Date(2026, 8, 1 + 35).getTime());
    expect(rampEndsAt(DEFAULT_COMEBACK_STATE, 4)).toBeNull();
  });
});

describe('deficitDecidedState', () => {
  it('records the answer to the week-2 offer', () => {
    expect(deficitDecidedState(active(), 'accepted').deficitDecision).toBe('accepted');
    expect(deficitDecidedState(active(), 'declined').deficitDecision).toBe('declined');
  });

  it('is asked again by a fresh start', () => {
    const decided = deficitDecidedState(active(), 'declined');
    const next = startedState(decided, { track: 'both', answers: {}, today: day(30) });

    expect(next.deficitDecision).toBeNull();
  });
});
