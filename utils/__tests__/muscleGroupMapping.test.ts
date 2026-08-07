import type { MuscleSlug } from '@/utils/muscleGroupMapping';
import {
  BACK_SLUGS,
  buildSlugIntensityMap,
  FRONT_SLUGS,
  MUSCLE_TO_SLUGS,
  SLUG_TO_LABEL,
} from '@/utils/muscleGroupMapping';

/** Sorted entries, so assertions don't depend on Map insertion order. */
function entries(map: Map<MuscleSlug, number>): [MuscleSlug, number][] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
}

describe('buildSlugIntensityMap', () => {
  it('returns an empty map for no muscle groups', () => {
    // `BodyHighlighter` keys its "no muscle data" empty state off `size === 0`.
    expect(buildSlugIntensityMap([]).size).toBe(0);
  });

  it('expands one primary group into every slug it covers, each counted once', () => {
    expect(entries(buildSlugIntensityMap(['legs']))).toEqual([
      ['calves', 1],
      ['gluteal', 1],
      ['hamstring', 1],
      ['quadriceps', 1],
    ]);
  });

  it('accumulates intensity when several exercises hit the same slug', () => {
    // Intensity is a per-slug hit count: two chest exercises shade the chest twice as hard.
    expect(buildSlugIntensityMap(['chest', 'chest', 'chest']).get('chest')).toBe(3);
  });

  it('sums overlapping groups slug by slug rather than replacing them', () => {
    // `legs` and `glutes` both contain `gluteal`; only that slug should stack.
    const map = buildSlugIntensityMap(['legs', 'glutes']);
    expect(map.get('gluteal')).toBe(2);
    expect(map.get('quadriceps')).toBe(1);
    expect(map.get('calves')).toBe(1);
  });

  it('treats a legacy alias and its primary group as the same slugs', () => {
    // `abs` is the legacy spelling of `abdomen`; both must shade the same muscles.
    expect(entries(buildSlugIntensityMap(['abs']))).toEqual(
      entries(buildSlugIntensityMap(['abdomen']))
    );
  });

  it('lowercases the incoming group before lookup', () => {
    // Exercise rows are not case-normalised on write, so 'Chest' must still resolve.
    expect(buildSlugIntensityMap(['Chest']).get('chest')).toBe(1);
    expect(buildSlugIntensityMap(['FULL_BODY']).size).toBe(MUSCLE_TO_SLUGS.full_body.length);
  });

  it('skips null/undefined/empty entries instead of throwing', () => {
    // The caller signature is `(string | null | undefined)[]` — a workout can contain
    // exercises whose muscle_group column was never filled in.
    const map = buildSlugIntensityMap([null, undefined, '', 'chest']);
    expect(entries(map)).toEqual([['chest', 1]]);
  });

  it('drops unknown muscle groups silently rather than crashing the body map', () => {
    const map = buildSlugIntensityMap(['not-a-muscle', 'chest']);
    expect(entries(map)).toEqual([['chest', 1]]);
  });

  it('maps cardio and other to no slugs at all, so a cardio-only workout has no body map', () => {
    // Deliberate empty entries in the table: nothing to highlight, not "unknown".
    expect(buildSlugIntensityMap(['cardio', 'other']).size).toBe(0);
  });

  it('covers the whole body for full_body without double-counting any slug', () => {
    const map = buildSlugIntensityMap(['full_body']);
    expect(map.size).toBe(14);
    expect([...map.values()].every((count) => count === 1)).toBe(true);
  });
});

describe('muscle group registries', () => {
  it('keys MUSCLE_TO_SLUGS in lowercase, since lookups are always lowercased', () => {
    // An upper-case key would be permanently unreachable through buildSlugIntensityMap.
    const nonLowercase = Object.keys(MUSCLE_TO_SLUGS).filter((key) => key !== key.toLowerCase());
    expect(nonLowercase).toEqual([]);
  });

  it('labels every slug any muscle group can produce', () => {
    const produced = new Set(Object.values(MUSCLE_TO_SLUGS).flat());
    const unlabelled = [...produced].filter((slug) => !(slug in SLUG_TO_LABEL));
    expect(unlabelled).toEqual([]);
  });

  it('only lists labelled slugs on the front and back body silhouettes', () => {
    const sided = [...FRONT_SLUGS, ...BACK_SLUGS];
    expect(sided.filter((slug) => !(slug in SLUG_TO_LABEL))).toEqual([]);
  });

  it('places every slug reachable from a primary muscle group on at least one silhouette', () => {
    // Primary groups are what the workout UI actually passes in; a slug reachable from one
    // of them but missing from both silhouettes would be counted yet never drawn.
    const primaryGroups = [
      'abdomen',
      'arms',
      'back',
      'chest',
      'core',
      'glutes',
      'legs',
      'shoulders',
    ];
    const reachable = new Set(primaryGroups.flatMap((group) => MUSCLE_TO_SLUGS[group]));
    const undrawable = [...reachable].filter(
      (slug) => !FRONT_SLUGS.has(slug) && !BACK_SLUGS.has(slug)
    );
    expect(undrawable).toEqual([]);
  });
});
