import { DEFAULT_COMEBACK_STATE, type ComebackState } from '@/utils/comeback/comebackState';
import {
  breakLengthForDays,
  COMEBACK_OFFER_MIN_GAP_DAYS,
  COMEBACK_OFFER_REMIND_AFTER_DAYS,
  COMEBACK_STALL_DAYS,
  detectLapse,
  isComebackStalled,
  shouldOfferComeback,
  type LapseInput,
} from '@/utils/comeback/lapse';

const NOW = new Date(2026, 9, 27, 10).getTime();
const daysAgo = (days: number) => new Date(2026, 9, 27 - days, 9).getTime();

const input = (patch: Partial<LapseInput> = {}): LapseInput => ({
  lastWorkoutAt: daysAgo(1),
  lastFoodAt: daysAgo(1),
  lastWeighInAt: null,
  everWorkout: true,
  everFood: true,
  now: NOW,
  ...patch,
});

const state = (patch: Partial<ComebackState> = {}): ComebackState => ({
  ...DEFAULT_COMEBACK_STATE,
  ...patch,
});

describe('detectLapse', () => {
  it('is not a lapse for someone active on both halves', () => {
    const lapse = detectLapse(input());

    expect(lapse.eligible).toBe(false);
    expect(lapse.suggestedTrack).toBeNull();
  });

  it('is not a lapse just under the threshold, and is exactly at it', () => {
    expect(
      detectLapse(input({ lastWorkoutAt: daysAgo(COMEBACK_OFFER_MIN_GAP_DAYS - 1) })).eligible
    ).toBe(false);
    expect(
      detectLapse(input({ lastWorkoutAt: daysAgo(COMEBACK_OFFER_MIN_GAP_DAYS) })).suggestedTrack
    ).toBe('workout');
  });

  it('suggests only the half that lapsed', () => {
    expect(detectLapse(input({ lastWorkoutAt: daysAgo(40) })).suggestedTrack).toBe('workout');
    expect(detectLapse(input({ lastFoodAt: daysAgo(40) })).suggestedTrack).toBe('nutrition');
  });

  it('suggests both when both lapsed', () => {
    const lapse = detectLapse(input({ lastWorkoutAt: daysAgo(94), lastFoodAt: daysAgo(160) }));

    expect(lapse.suggestedTrack).toBe('both');
    expect(lapse.workoutGapDays).toBe(94);
    expect(lapse.foodGapDays).toBe(160);
  });

  it('never treats a half the person never used as lapsed', () => {
    const lapse = detectLapse(
      input({ everWorkout: false, lastWorkoutAt: null, lastFoodAt: daysAgo(60) })
    );

    expect(lapse.workoutGapDays).toBeNull();
    expect(lapse.suggestedTrack).toBe('nutrition');
  });

  it('takes the break length from the longest lapsed gap, not from a recent half', () => {
    const lapse = detectLapse(input({ lastWorkoutAt: daysAgo(200), lastFoodAt: daysAgo(3) }));

    expect(lapse.suggestedTrack).toBe('workout');
    expect(lapse.breakLength).toBe('over6m');
  });

  it('reports the most recent activity of any kind, weigh-ins included', () => {
    const lapse = detectLapse(
      input({ lastWorkoutAt: daysAgo(90), lastFoodAt: daysAgo(90), lastWeighInAt: daysAgo(20) })
    );

    expect(lapse.lastActivityAt).toBe(daysAgo(20));
    expect(lapse.eligible).toBe(true);
  });

  it('counts calendar days, not 24-hour blocks, across a clock change', () => {
    // 2026-10-25 is the end of daylight saving time in much of Europe; the answer must stay whole days.
    const lapse = detectLapse(
      input({
        now: new Date(2026, 10, 8, 0, 30).getTime(),
        lastWorkoutAt: new Date(2026, 9, 25, 23, 30).getTime(),
      })
    );

    expect(lapse.workoutGapDays).toBe(14);
  });
});

describe('breakLengthForDays', () => {
  it('buckets gaps', () => {
    expect(breakLengthForDays(14)).toBe('under1m');
    expect(breakLengthForDays(29)).toBe('under1m');
    expect(breakLengthForDays(30)).toBe('1to3m');
    expect(breakLengthForDays(89)).toBe('1to3m');
    expect(breakLengthForDays(90)).toBe('3to6m');
    expect(breakLengthForDays(180)).toBe('over6m');
  });
});

describe('shouldOfferComeback', () => {
  const lapsed = detectLapse(input({ lastWorkoutAt: daysAgo(94), lastFoodAt: daysAgo(94) }));

  it('offers to an eligible person who has not been asked', () => {
    expect(shouldOfferComeback(state(), lapsed, NOW)).toBe(true);
  });

  it('does not offer when nothing lapsed', () => {
    expect(shouldOfferComeback(state(), detectLapse(input()), NOW)).toBe(false);
  });

  it('does not offer while a comeback is active', () => {
    expect(
      shouldOfferComeback(state({ status: 'active', startedAt: daysAgo(3) }), lapsed, NOW)
    ).toBe(false);
  });

  it('offers again after an ended comeback if they lapse again', () => {
    expect(
      shouldOfferComeback(state({ status: 'ended', endedAt: daysAgo(200) }), lapsed, NOW)
    ).toBe(true);
  });

  it('stays quiet for the same gap after "Not now"', () => {
    const dismissed = state({
      offerDismissal: { at: daysAgo(5), lastActivityAt: lapsed.lastActivityAt ?? 0 },
    });

    expect(shouldOfferComeback(dismissed, lapsed, NOW)).toBe(false);
  });

  it('asks again once the reminder interval has passed', () => {
    const dismissed = state({
      offerDismissal: {
        at: daysAgo(COMEBACK_OFFER_REMIND_AFTER_DAYS),
        lastActivityAt: lapsed.lastActivityAt ?? 0,
      },
    });

    expect(shouldOfferComeback(dismissed, lapsed, NOW)).toBe(true);
  });

  it('re-arms for a new gap after the person was active again', () => {
    const dismissed = state({
      offerDismissal: { at: daysAgo(5), lastActivityAt: daysAgo(200) },
    });

    expect(shouldOfferComeback(dismissed, lapsed, NOW)).toBe(true);
  });
});

describe('isComebackStalled', () => {
  const running = (patch: Partial<ComebackState> = {}) =>
    state({ status: 'active', startedAt: daysAgo(20), ...patch });
  const lapse = (lastActivityAt: number | null) => ({
    ...detectLapse(input({ lastWorkoutAt: lastActivityAt, lastFoodAt: null, everFood: false })),
    lastActivityAt,
  });

  it('is not stalled on the day it begins, even though the break it ends was long', () => {
    expect(isComebackStalled(running({ startedAt: daysAgo(0) }), lapse(daysAgo(94)), NOW)).toBe(
      false
    );
  });

  it('is stalled after ten quiet days since the last activity', () => {
    expect(COMEBACK_STALL_DAYS).toBe(10);
    expect(isComebackStalled(running(), lapse(daysAgo(10)), NOW)).toBe(true);
    expect(isComebackStalled(running(), lapse(daysAgo(9)), NOW)).toBe(false);
  });

  it('counts the start of the comeback when nothing was logged since', () => {
    expect(isComebackStalled(running({ startedAt: daysAgo(12) }), lapse(null), NOW)).toBe(true);
    expect(isComebackStalled(running({ startedAt: daysAgo(6) }), lapse(null), NOW)).toBe(false);
  });

  it('counts a minimum day as showing up', () => {
    const lastMinimum = new Date(2026, 9, 25);
    const key = `${lastMinimum.getFullYear()}-${String(lastMinimum.getMonth() + 1).padStart(2, '0')}-${String(lastMinimum.getDate()).padStart(2, '0')}`;

    expect(isComebackStalled(running({ minimumDays: [key] }), lapse(daysAgo(30)), NOW)).toBe(false);
  });

  it('is never stalled when no comeback is running', () => {
    expect(isComebackStalled(state(), lapse(daysAgo(60)), NOW)).toBe(false);
    expect(
      isComebackStalled(running({ status: 'ended', endedAt: daysAgo(3) }), lapse(daysAgo(60)), NOW)
    ).toBe(false);
  });
});
