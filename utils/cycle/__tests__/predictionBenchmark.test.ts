import { buildCycleHistory } from '../cycleHistory';
import { evaluatePredictions } from '../historyAnalysis';
import {
  BENCHMARK_CONFIG,
  periodsFromLengths,
  seededRandom,
  SYNTHETIC_PROFILES,
} from './syntheticCycles';

/**
 * Accuracy benchmark for next-period prediction over seeded synthetic histories (see
 * `syntheticCycles.ts`). Every check is one step ahead, from earlier starts only, exactly what
 * the prediction details sheet reports to a user. Run with CYCLE_BENCHMARK_REPORT=1 to print the
 * table when tuning the model.
 */

const PEOPLE_PER_PROFILE = 40;
const CYCLES_PER_PERSON = 24;

interface ProfileResult {
  profile: string;
  checked: number;
  hitRate: number;
  meanErrorDays: number;
  meanWindowDays: number;
}

function runProfile(profileIndex: number): ProfileResult {
  const profile = SYNTHETIC_PROFILES[profileIndex];
  const random = seededRandom(1000 + profileIndex);
  let checked = 0;
  let hits = 0;
  let errorSum = 0;
  let windowSum = 0;

  for (let person = 0; person < PEOPLE_PER_PROFILE; person++) {
    const periods = periodsFromLengths(profile.lengths(random, CYCLES_PER_PERSON));
    const result = evaluatePredictions(periods, buildCycleHistory(periods), BENCHMARK_CONFIG);
    checked += result.checked;
    hits += result.hits;
    errorSum += (result.meanErrorDays ?? 0) * result.checked;
    windowSum += (result.meanWindowDays ?? 0) * result.checked;
  }

  return {
    profile: profile.id,
    checked,
    hitRate: hits / checked,
    meanErrorDays: errorSum / checked,
    meanWindowDays: windowSum / checked,
  };
}

const results = SYNTHETIC_PROFILES.map((_, index) => runProfile(index));
const byProfile = (id: string) => results.find((r) => r.profile === id)!;

if (process.env.CYCLE_BENCHMARK_REPORT) {
  // eslint-disable-next-line no-console
  console.table(
    results.map((r) => ({
      ...r,
      hitRate: r.hitRate.toFixed(3),
      meanErrorDays: r.meanErrorDays.toFixed(2),
      meanWindowDays: r.meanWindowDays.toFixed(2),
    }))
  );
}

/**
 * Ceilings just above the current results. The model before recency weighting scored, as
 * hit rate / mean error / mean window days: regular 0.824/1.32/6.16, typical 0.820/2.48/10.10,
 * variable 0.816/3.98/13.96, drifting 0.817/2.09/7.92, step_change 0.803/3.20/9.96,
 * rare_outlier 0.814/2.87/12.67. A change that fails here should be justified by better numbers
 * elsewhere, and these limits moved deliberately, not loosened to pass.
 */
const LIMITS: Record<string, { maxErrorDays: number; maxWindowDays: number }> = {
  regular: { maxErrorDays: 1.4, maxWindowDays: 6.2 },
  typical: { maxErrorDays: 2.6, maxWindowDays: 10.2 },
  variable: { maxErrorDays: 4.1, maxWindowDays: 14.1 },
  drifting: { maxErrorDays: 2.0, maxWindowDays: 8.0 },
  step_change: { maxErrorDays: 2.85, maxWindowDays: 10.0 },
  rare_outlier: { maxErrorDays: 3.0, maxWindowDays: 12.8 },
};

describe('next-period prediction benchmark', () => {
  it('checks every profile on enough predictions to mean something', () => {
    for (const result of results) {
      expect(result.checked).toBeGreaterThan(500);
    }
  });

  it.each(SYNTHETIC_PROFILES.map((p) => p.id))(
    'keeps %s accurate without widening the window',
    (id) => {
      const result = byProfile(id);
      expect(result.hitRate).toBeGreaterThanOrEqual(0.8);
      expect(result.meanErrorDays).toBeLessThanOrEqual(LIMITS[id].maxErrorDays);
      expect(result.meanWindowDays).toBeLessThanOrEqual(LIMITS[id].maxWindowDays);
    }
  );

  it('follows a lasting change faster than an unweighted median would', () => {
    // 3.20 days before recency weighting.
    expect(byProfile('step_change').meanErrorDays).toBeLessThan(2.9);
  });
});
