import {
  MUSCLE_LOAD_HALF_LIFE_HOURS,
  MUSCLE_SESSION_SET_CAP,
  MUSCLE_LOAD_WINDOW_DAYS,
  computeMuscleLoad,
  muscleLoadSlugIntensity,
  pushPullComparison,
  quadHamstringComparison,
  type MuscleLoadSet,
} from '@/utils/muscleLoad';

const NOW = Date.UTC(2026, 10, 5, 12);
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function strengthSet(
  overrides: Partial<MuscleLoadSet> & Pick<MuscleLoadSet, 'muscles'>
): MuscleLoadSet {
  return {
    performedAt: NOW,
    sessionId: 'session-a',
    isWorkingSet: true,
    mechanicType: 'compound',
    ...overrides,
  };
}

function primary(name: string) {
  return { name, role: 'primary' as const };
}

function secondary(name: string) {
  return { name, role: 'secondary' as const };
}

/** One working set per session, all performed at `performedAt`. */
function sessions(
  count: number,
  muscles: MuscleLoadSet['muscles'],
  performedAt = NOW
): MuscleLoadSet[] {
  return Array.from({ length: count }, (_, index) =>
    strengthSet({ muscles, performedAt, sessionId: `session-${index}` })
  );
}

describe('muscleLoad constants', () => {
  it('keeps the product choices the spec names', () => {
    expect(MUSCLE_SESSION_SET_CAP).toBe(10);
    expect(MUSCLE_LOAD_HALF_LIFE_HOURS).toBe(48);
    expect(MUSCLE_LOAD_WINDOW_DAYS).toBe(7);
  });
});

describe('computeMuscleLoad', () => {
  it('returns an empty map for empty input', () => {
    expect(computeMuscleLoad([], NOW).size).toBe(0);
  });

  it('halves recent load after one half-life', () => {
    const load = computeMuscleLoad(
      [strengthSet({ performedAt: NOW - 48 * HOUR, muscles: [primary('pectoralis_major')] })],
      NOW
    );

    const chest = load.get('chest');
    expect(chest?.recentLoad).toBeCloseTo(0.5, 10);
    expect(chest?.weeklySets).toBe(1);
  });

  it('caps a session at the session cap before decay, not after', () => {
    const load = computeMuscleLoad(
      Array.from({ length: 12 }, () =>
        strengthSet({ performedAt: NOW - 48 * HOUR, muscles: [primary('pectoralis_major')] })
      ),
      NOW
    );

    const chest = load.get('chest');
    expect(chest?.weeklySets).toBe(1 * MUSCLE_SESSION_SET_CAP);
    // Capped total is 10, then halved by one half-life: 5, not 12 * 0.5 = 6.
    expect(chest?.recentLoad).toBeCloseTo(5, 10);
  });

  it('applies the session cap per session, not per week', () => {
    // Two sessions of 12 sets each: each session is capped at 10, so the week
    // holds 20. A weekly cap would have stopped at 10.
    const load = computeMuscleLoad(
      [
        ...Array.from({ length: 12 }, () =>
          strengthSet({ muscles: [primary('pectoralis_major')] })
        ),
        ...Array.from({ length: 12 }, () =>
          strengthSet({ muscles: [primary('pectoralis_major')], sessionId: 'session-b' })
        ),
      ],
      NOW
    );

    expect(load.get('chest')?.weeklySets).toBe(2 * MUSCLE_SESSION_SET_CAP);
    expect(load.get('chest')?.recentLoad).toBeCloseTo(2 * MUSCLE_SESSION_SET_CAP, 10);
  });

  it('counts a secondary mover at half weight', () => {
    const load = computeMuscleLoad(
      [strengthSet({ muscles: [secondary('pectoralis_major')] })],
      NOW
    );

    expect(load.get('chest')?.weeklySets).toBe(0.5);
    expect(load.get('chest')?.recentLoad).toBeCloseTo(0.5, 10);
  });

  it('credits a slug at its primary weight when a primary and secondary muscle both reach it', () => {
    // serratus_anterior and pectoralis_major both fold into chest.
    const primaryFirst = computeMuscleLoad(
      [
        strengthSet({
          muscles: [primary('pectoralis_major'), secondary('serratus_anterior')],
        }),
      ],
      NOW
    );
    const secondaryFirst = computeMuscleLoad(
      [
        strengthSet({
          muscles: [secondary('serratus_anterior'), primary('pectoralis_major')],
        }),
      ],
      NOW
    );

    expect(primaryFirst.get('chest')?.weeklySets).toBe(1);
    expect(secondaryFirst.get('chest')?.weeklySets).toBe(1);
  });

  it('credits the deltoid heads once per set', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({
          muscles: [
            primary('anterior_deltoid'),
            primary('lateral_deltoid'),
            secondary('posterior_deltoid'),
          ],
        }),
      ],
      NOW
    );

    expect(load.get('deltoids')?.weeklySets).toBe(1);
    expect(load.get('deltoids')?.recentLoad).toBeCloseTo(1, 10);
  });

  it('excludes warm-up, planned and skipped sets (anything not a working set)', () => {
    const load = computeMuscleLoad(
      [strengthSet({ isWorkingSet: false, muscles: [primary('pectoralis_major')] })],
      NOW
    );

    expect(load.size).toBe(0);
  });

  it('counts unrated sets the same as any working set', () => {
    // The set carries no effort rating at all; it still counts as one set.
    const load = computeMuscleLoad([strengthSet({ muscles: [primary('lats')] })], NOW);

    expect(load.get('upper-back')?.weeklySets).toBe(1);
  });

  it('excludes cardio and stretching sets', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({ mechanicType: 'cardio', muscles: [primary('quadriceps')] }),
        strengthSet({ mechanicType: 'stretching', muscles: [primary('quadriceps')] }),
      ],
      NOW
    );

    expect(load.size).toBe(0);
  });

  it('counts sets with no mechanic type', () => {
    const load = computeMuscleLoad(
      [strengthSet({ mechanicType: null, muscles: [primary('quadriceps')] })],
      NOW
    );

    expect(load.get('quadriceps')?.weeklySets).toBe(1);
  });

  it('ignores unknown muscle names', () => {
    const load = computeMuscleLoad([strengthSet({ muscles: [primary('not_a_muscle')] })], NOW);

    expect(load.size).toBe(0);
  });

  it('ignores prototype keys instead of resolving inherited properties', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({
          muscles: [primary('__proto__'), primary('constructor'), primary('toString')],
        }),
      ],
      NOW
    );

    expect(load.size).toBe(0);
  });

  it('includes a set exactly at the window edge and excludes one just past it', () => {
    const edge = NOW - MUSCLE_LOAD_WINDOW_DAYS * DAY;
    const included = computeMuscleLoad(
      [strengthSet({ performedAt: edge, muscles: [primary('quadriceps')] })],
      NOW
    );
    const excluded = computeMuscleLoad(
      [strengthSet({ performedAt: edge - 1, muscles: [primary('quadriceps')] })],
      NOW
    );

    expect(included.get('quadriceps')?.weeklySets).toBe(1);
    expect(excluded.size).toBe(0);
  });

  it('ignores sets performed in the future and keeps sets at now', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({ performedAt: NOW + 1, muscles: [primary('quadriceps')] }),
        strengthSet({ performedAt: NOW, muscles: [primary('hamstrings')] }),
      ],
      NOW
    );

    expect(load.has('quadriceps')).toBe(false);
    expect(load.get('hamstring')?.weeklySets).toBe(1);
  });

  it('decays a session by its own latest set, so a fresh set keeps it undecayed', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({ performedAt: NOW - 48 * HOUR, muscles: [primary('pectoralis_major')] }),
        strengthSet({ performedAt: NOW, muscles: [primary('pectoralis_major')] }),
      ],
      NOW
    );

    expect(load.get('chest')?.weeklySets).toBe(2);
    expect(load.get('chest')?.recentLoad).toBeCloseTo(2, 10);
  });

  it('sums each session separately before summing sessions', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({
          performedAt: NOW - 48 * HOUR,
          sessionId: 'old',
          muscles: [primary('pectoralis_major')],
        }),
        strengthSet({ performedAt: NOW, sessionId: 'new', muscles: [primary('pectoralis_major')] }),
      ],
      NOW
    );

    expect(load.get('chest')?.recentLoad).toBeCloseTo(1.5, 10);
    expect(load.get('chest')?.weeklySets).toBe(2);
  });

  describe('levels', () => {
    function levelFor(entries: MuscleLoadSet[]) {
      return computeMuscleLoad(entries, NOW).get('chest')?.level;
    }

    it('sits at level 1 exactly at the first edge (0.5) and level 0 just below it', () => {
      const atEdge = levelFor([
        strengthSet({ performedAt: NOW - 48 * HOUR, muscles: [primary('pectoralis_major')] }),
      ]);
      const belowEdge = levelFor([
        strengthSet({
          performedAt: NOW - 48 * HOUR - HOUR,
          muscles: [primary('pectoralis_major')],
        }),
      ]);

      expect(atEdge).toBe(1);
      expect(belowEdge).toBe(0);
    });

    it('steps to level 1, 2 and 3 at 3 and 6 with inclusive lower edges', () => {
      expect(levelFor(sessions(2, [primary('pectoralis_major')]))).toBe(1);
      expect(levelFor(sessions(3, [primary('pectoralis_major')]))).toBe(2);
      expect(levelFor(sessions(5, [primary('pectoralis_major')]))).toBe(2);
      expect(levelFor(sessions(6, [primary('pectoralis_major')]))).toBe(3);
    });
  });

  describe('weekly status', () => {
    function statusFor(count: number) {
      return computeMuscleLoad(sessions(count, [primary('pectoralis_major')]), NOW).get('chest')
        ?.weeklyStatus;
    }

    it('is below under 10 sets, within at 10 and 20, above over 20', () => {
      expect(statusFor(9)).toBe('below');
      expect(statusFor(10)).toBe('within');
      expect(statusFor(20)).toBe('within');
      expect(statusFor(21)).toBe('above');
    });
  });
});

describe('pushPullComparison', () => {
  it('sums push and pull weekly sets from their slugs', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({ sessionId: 'a', muscles: [primary('pectoralis_major')] }),
        strengthSet({ sessionId: 'b', muscles: [primary('triceps')] }),
        strengthSet({ sessionId: 'c', muscles: [primary('anterior_deltoid')] }),
        strengthSet({ sessionId: 'd', muscles: [primary('lats')] }),
        strengthSet({ sessionId: 'e', muscles: [primary('traps')] }),
        strengthSet({ sessionId: 'f', muscles: [primary('biceps')] }),
        strengthSet({ sessionId: 'g', muscles: [primary('biceps')] }),
      ],
      NOW
    );

    expect(pushPullComparison(load)).toEqual({ first: 3, second: 4 });
  });

  it('returns zeros for empty load', () => {
    expect(pushPullComparison(new Map())).toEqual({ first: 0, second: 0 });
  });
});

describe('quadHamstringComparison', () => {
  it('sums quadriceps against hamstring weekly sets', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({ sessionId: 'a', muscles: [primary('quadriceps')] }),
        strengthSet({ sessionId: 'b', muscles: [primary('quads')] }),
        strengthSet({ sessionId: 'c', muscles: [primary('hamstrings')] }),
      ],
      NOW
    );

    expect(quadHamstringComparison(load)).toEqual({ first: 2, second: 1 });
  });

  it('returns zeros for empty load', () => {
    expect(quadHamstringComparison(new Map())).toEqual({ first: 0, second: 0 });
  });
});

describe('muscleLoadSlugIntensity', () => {
  it('returns only slugs with a level above zero', () => {
    const load = computeMuscleLoad(
      [
        strengthSet({
          performedAt: NOW - 48 * HOUR - HOUR,
          muscles: [primary('pectoralis_major')],
        }),
        strengthSet({ sessionId: 'b', muscles: [primary('quadriceps')] }),
      ],
      NOW
    );

    const intensity = muscleLoadSlugIntensity(load);
    expect(intensity.has('chest')).toBe(false);
    expect(intensity.get('quadriceps')).toBe(1);
  });

  it('returns an empty map for empty load', () => {
    expect(muscleLoadSlugIntensity(new Map()).size).toBe(0);
  });
});
