import { MS_PER_SOLAR_DAY } from '@/utils/calendarDate';

import type { CycleConfig, CyclePeriodDto } from '../types';

/**
 * Seeded synthetic cycle histories for the prediction benchmark. These are modelling
 * assumptions, not real data: each profile isolates one behaviour the predictor has to cope
 * with (steady cycles, ordinary variation, drift, a step change, rare outliers), so a change to
 * the model shows up as a measurable difference on the profile it affects.
 */

const BASE = Date.UTC(2023, 0, 1);

/** mulberry32: small, fast and deterministic, so the benchmark gives the same numbers every run. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(random: () => number, mean: number, sd: number): number {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();

  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export interface SyntheticProfile {
  id: string;
  /** Cycle lengths (days) for one synthetic person, oldest first. */
  lengths: (random: () => number, cycles: number) => number[];
}

const clampLength = (days: number) => Math.max(21, Math.round(days));

function steady(sd: number) {
  return (random: () => number, cycles: number) => {
    const mean = normal(random, 29, 2);

    return Array.from({ length: cycles }, () => clampLength(normal(random, mean, sd)));
  };
}

export const SYNTHETIC_PROFILES: SyntheticProfile[] = [
  { id: 'regular', lengths: steady(1.5) },
  { id: 'typical', lengths: steady(3) },
  { id: 'variable', lengths: steady(5) },
  {
    // Cycles shortening by about 5 days over two years, as they can in the late reproductive years.
    id: 'drifting',
    lengths: (random, cycles) => {
      const start = normal(random, 32, 1.5);

      return Array.from({ length: cycles }, (_, i) =>
        clampLength(normal(random, start - (5 * i) / (cycles - 1), 2))
      );
    },
  },
  {
    // A lasting change part-way through, e.g. settling after stopping a hormonal method.
    id: 'step_change',
    lengths: (random, cycles) => {
      const before = normal(random, 35, 1.5);
      const after = normal(random, 28, 1.5);

      return Array.from({ length: cycles }, (_, i) =>
        clampLength(normal(random, i < cycles / 3 ? before : after, 2))
      );
    },
  },
  {
    // Steady cycles with a rare long one (illness, travel, stress) that is not a missed period.
    id: 'rare_outlier',
    lengths: (random, cycles) => {
      const mean = normal(random, 28, 1.5);

      return Array.from({ length: cycles }, () =>
        clampLength(normal(random, mean, 2) + (random() < 0.1 ? 12 : 0))
      );
    },
  },
];

export function periodsFromLengths(lengths: number[]): CyclePeriodDto[] {
  let offset = 0;

  return [0, ...lengths].map((length, index) => {
    offset += length;
    const startDate = BASE + offset * MS_PER_SOLAR_DAY;

    return {
      id: `p${index}`,
      cycleId: 'c',
      startDate,
      endDate: startDate + 4 * MS_PER_SOLAR_DAY,
      endKind: 'logged',
      timezone: 'UTC',
      excludedFromStats: false,
      note: '',
    };
  });
}

export const BENCHMARK_CONFIG: CycleConfig = {
  fallbackCycleLength: 28,
  fallbackPeriodDuration: 5,
};
