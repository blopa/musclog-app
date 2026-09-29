import { BLOCK_FRACTIONS } from '@/constants/circadian';

import {
  CIRCADIAN_SEGMENTS,
  circadianBurnedKcal,
  circadianInstantRate,
  circadianRatePerMinute,
  currentCircadianBlockKey,
  MINUTES_PER_DAY,
  minutesSinceLocalMidnight,
} from '../circadianBurn';

const TDEE = 2400;

describe('CIRCADIAN_SEGMENTS', () => {
  it('tiles the whole day with no gap or overlap', () => {
    expect(CIRCADIAN_SEGMENTS[0].start).toBe(0);
    expect(CIRCADIAN_SEGMENTS[CIRCADIAN_SEGMENTS.length - 1].end).toBe(MINUTES_PER_DAY);

    CIRCADIAN_SEGMENTS.forEach((segment, index) => {
      if (index > 0) {
        expect(segment.start).toBe(CIRCADIAN_SEGMENTS[index - 1].end);
      }
    });
  });

  // Each phase owns exactly one 240-minute block of the day; the early-sleep block is the
  // one split across midnight, so its two segments have to add back up to a whole block.
  it('gives every phase exactly its block worth of minutes', () => {
    const minutesByBlock = new Map<string, number>();

    for (const segment of CIRCADIAN_SEGMENTS) {
      const soFar = minutesByBlock.get(segment.blockKey) ?? 0;
      minutesByBlock.set(segment.blockKey, soFar + (segment.end - segment.start));
    }

    expect([...minutesByBlock.values()]).toEqual([240, 240, 240, 240, 240, 240]);
    expect(minutesByBlock.get('earlySlеep')).toBe(240);
    expect([...minutesByBlock.keys()].sort()).toEqual(Object.keys(BLOCK_FRACTIONS).sort());
  });
});

describe('circadianBurnedKcal', () => {
  it('credits nothing at midnight', () => {
    expect(circadianBurnedKcal(TDEE, 0)).toBe(0);
  });

  // The model redistributes TDEE across the day, so a full day must come back out whole —
  // otherwise the strip would understate or overstate the day it is summarising.
  it('credits exactly the whole TDEE by the end of the day', () => {
    expect(circadianBurnedKcal(TDEE, MINUTES_PER_DAY)).toBeCloseTo(TDEE, 6);
  });

  it('never runs backwards as the day goes on', () => {
    let previous = -1;

    for (let minute = 0; minute <= MINUTES_PER_DAY; minute += 15) {
      const burned = circadianBurnedKcal(TDEE, minute);
      expect(burned).toBeGreaterThanOrEqual(previous);
      previous = burned;
    }
  });

  // This is the whole point of the change: at 8am the user has not spent a day's energy.
  it('credits only a fraction of the day by mid-morning', () => {
    const atEightAm = circadianBurnedKcal(TDEE, 8 * 60);

    expect(atEightAm).toBeLessThan(TDEE / 2);
    expect(atEightAm).toBeGreaterThan(0);
  });

  it('credits a completed block its full fraction', () => {
    // 3am ends the first early-sleep segment: 180 of that block's 240 minutes.
    expect(circadianBurnedKcal(TDEE, 180)).toBeCloseTo(
      BLOCK_FRACTIONS['earlySlеep'] * (180 / 240) * TDEE,
      6
    );

    // 7am additionally completes the nadir block.
    expect(circadianBurnedKcal(TDEE, 420)).toBeCloseTo(
      (BLOCK_FRACTIONS['earlySlеep'] * (180 / 240) + BLOCK_FRACTIONS.nadir) * TDEE,
      6
    );
  });

  it('credits a partial block pro rata within it', () => {
    const halfwayThroughPeak = circadianBurnedKcal(TDEE, 900 + 120);

    expect(halfwayThroughPeak - circadianBurnedKcal(TDEE, 900)).toBeCloseTo(
      (BLOCK_FRACTIONS.peak / 2) * TDEE,
      6
    );
  });

  // A clock read before local midnight (or a nonsense negative) must not owe the user energy.
  it('credits nothing for a negative clock reading', () => {
    expect(circadianBurnedKcal(TDEE, -30)).toBe(0);
  });

  // A DST day can run to 25 hours, which would otherwise credit more than a whole TDEE.
  it('never credits more than the whole TDEE on an over-long day', () => {
    expect(circadianBurnedKcal(TDEE, MINUTES_PER_DAY + 60)).toBeCloseTo(TDEE, 6);
  });
});

describe('currentCircadianBlockKey', () => {
  it.each([
    [0, 'earlySlеep'],
    [179, 'earlySlеep'],
    [180, 'nadir'],
    [419, 'nadir'],
    [420, 'morning'],
    [660, 'midday'],
    [900, 'peak'],
    [1140, 'evening'],
    [1380, 'earlySlеep'],
    [1439, 'earlySlеep'],
  ])('reads minute %i as the %s phase', (minute, blockKey) => {
    expect(currentCircadianBlockKey(minute)).toBe(blockKey);
  });

  it('falls back to the last phase past the end of the day', () => {
    expect(currentCircadianBlockKey(MINUTES_PER_DAY)).toBe('earlySlеep');
  });
});

describe('circadianRatePerMinute', () => {
  it('spreads a block fraction evenly across its 240 minutes', () => {
    expect(circadianRatePerMinute('peak') * 240).toBeCloseTo(BLOCK_FRACTIONS.peak, 10);
  });
});

describe('circadianInstantRate', () => {
  it('reports the same rate in three units', () => {
    const { perHour, perMinute, perSecond } = circadianInstantRate(TDEE, 'peak');

    expect(perMinute).toBeCloseTo(circadianRatePerMinute('peak') * TDEE, 10);
    expect(perHour).toBeCloseTo(perMinute * 60, 10);
    expect(perSecond).toBeCloseTo(perMinute / 60, 10);
  });
});

describe('minutesSinceLocalMidnight', () => {
  it('measures from local midnight, not UTC midnight', () => {
    const now = new Date();
    now.setHours(9, 30, 0, 0);

    expect(minutesSinceLocalMidnight(now)).toBeCloseTo(9 * 60 + 30, 6);
  });

  it('is zero at local midnight', () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    expect(minutesSinceLocalMidnight(now)).toBe(0);
  });

  it('defaults to the current clock', () => {
    const value = minutesSinceLocalMidnight();

    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(MINUTES_PER_DAY + 60);
  });
});
