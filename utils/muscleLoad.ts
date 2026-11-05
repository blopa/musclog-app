import { MUSCLE_TO_SLUGS, type MuscleSlug } from '@/utils/muscleGroupMapping';

// Recent training load per body-map muscle. This describes how much the user
// has trained a muscle lately. It is not readiness, fatigue or medical advice.

/** A secondary mover gets half credit for a set; a primary mover gets full credit. */
export const SECONDARY_SET_WEIGHT = 0.5;

/**
 * Effective sets per slug per session beyond this add nothing. Product choice
 * based on the diminishing returns past roughly 10 hard sets per session
 * (Schoenfeld, Science and Development of Muscle Hypertrophy, 2nd ed.).
 */
export const MUSCLE_SESSION_SET_CAP = 10;

/**
 * One half-life for every muscle. Product choice: the simplest rule our data
 * supports, since we have no per-muscle recovery evidence to tune against.
 */
export const MUSCLE_LOAD_HALF_LIFE_HOURS = 48;

/** The window that `weeklySets` and the 7-day comparisons use. */
export const MUSCLE_LOAD_WINDOW_DAYS = 7;

/** Schoenfeld's 10 to 20 weekly sets per muscle. Shown as context, not a target. */
export const WEEKLY_SETS_RANGE = { min: 10, max: 20 } as const;

/**
 * Upper edges for levels 1, 2 and 3 on `recentLoad`. Below the first edge is
 * level 0. Product choice for the body map shading.
 */
export const MUSCLE_LOAD_LEVEL_EDGES = [0.5, 3, 6] as const;

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;
const WINDOW_MS = MUSCLE_LOAD_WINDOW_DAYS * MS_PER_DAY;

/** Cardio and stretching don't load muscles in the way strength sets do. */
const EXCLUDED_MECHANIC_TYPES: ReadonlySet<string> = new Set(['cardio', 'stretching']);

export interface MuscleLoadSet {
  performedAt: number;
  sessionId: string;
  muscles: readonly { name: string; role: 'primary' | 'secondary' }[];
  isWorkingSet: boolean;
  mechanicType?: string | null;
}

export interface MuscleLoadEntry {
  slug: MuscleSlug;
  recentLoad: number;
  weeklySets: number;
  level: 0 | 1 | 2 | 3;
  weeklyStatus: 'below' | 'within' | 'above';
}

export interface VolumeComparison {
  first: number;
  second: number;
}

const PUSH_SLUGS: readonly MuscleSlug[] = ['chest', 'deltoids', 'triceps'];
const PULL_SLUGS: readonly MuscleSlug[] = ['upper-back', 'trapezius', 'biceps'];

interface SessionSlugAccumulator {
  weight: number;
  latestAt: number;
}

/** Only own keys count, so names like `__proto__` or `constructor` resolve to nothing. */
function slugsForMuscleName(name: string): MuscleSlug[] {
  if (!Object.prototype.hasOwnProperty.call(MUSCLE_TO_SLUGS, name)) {
    return [];
  }

  return MUSCLE_TO_SLUGS[name];
}

/**
 * The strongest role each slug gets from one set. A slug reached by both a
 * primary and a secondary muscle is primary, and each slug is credited once.
 */
function roleBySlugForSet(set: MuscleLoadSet): Map<MuscleSlug, 'primary' | 'secondary'> {
  const roles = new Map<MuscleSlug, 'primary' | 'secondary'>();

  for (const muscle of set.muscles) {
    for (const slug of slugsForMuscleName(muscle.name)) {
      if (roles.get(slug) !== 'primary') {
        roles.set(slug, muscle.role);
      }
    }
  }

  return roles;
}

function isCountedSet(set: MuscleLoadSet, now: number): boolean {
  if (!set.isWorkingSet) {
    return false;
  }

  if (set.mechanicType && EXCLUDED_MECHANIC_TYPES.has(set.mechanicType)) {
    return false;
  }

  if (set.performedAt > now) {
    return false;
  }

  return now - set.performedAt <= WINDOW_MS;
}

function levelFor(recentLoad: number): MuscleLoadEntry['level'] {
  const [edge1, edge2, edge3] = MUSCLE_LOAD_LEVEL_EDGES;

  if (recentLoad < edge1) {
    return 0;
  }

  if (recentLoad < edge2) {
    return 1;
  }

  if (recentLoad < edge3) {
    return 2;
  }

  return 3;
}

function weeklyStatusFor(weeklySets: number): MuscleLoadEntry['weeklyStatus'] {
  if (weeklySets < WEEKLY_SETS_RANGE.min) {
    return 'below';
  }

  if (weeklySets > WEEKLY_SETS_RANGE.max) {
    return 'above';
  }

  return 'within';
}

/**
 * Computes recent load per muscle slug.
 *
 * Each set counts once per slug it hits, weighted by role. Sets are unrated or
 * rated alike: effort ratings are too sparse to weight by, and an unrated set
 * is not a zero. Per session and slug, weights are summed and capped, then the
 * capped total decays by that session's latest set age.
 */
export function computeMuscleLoad(
  sets: readonly MuscleLoadSet[],
  now: number
): Map<MuscleSlug, MuscleLoadEntry> {
  const bySessionSlug = new Map<string, Map<MuscleSlug, SessionSlugAccumulator>>();

  for (const set of sets) {
    if (!isCountedSet(set, now)) {
      continue;
    }

    let slugs = bySessionSlug.get(set.sessionId);
    if (!slugs) {
      slugs = new Map();
      bySessionSlug.set(set.sessionId, slugs);
    }

    for (const [slug, role] of roleBySlugForSet(set)) {
      const weight = role === 'primary' ? 1 : SECONDARY_SET_WEIGHT;
      const acc = slugs.get(slug) ?? { weight: 0, latestAt: set.performedAt };
      acc.weight += weight;
      acc.latestAt = Math.max(acc.latestAt, set.performedAt);
      slugs.set(slug, acc);
    }
  }

  const totals = new Map<MuscleSlug, { recentLoad: number; weeklySets: number }>();

  for (const slugs of bySessionSlug.values()) {
    for (const [slug, acc] of slugs) {
      const capped = Math.min(acc.weight, MUSCLE_SESSION_SET_CAP);
      const ageHours = (now - acc.latestAt) / MS_PER_HOUR;
      const decayed = capped * 0.5 ** (ageHours / MUSCLE_LOAD_HALF_LIFE_HOURS);

      const total = totals.get(slug) ?? { recentLoad: 0, weeklySets: 0 };
      total.recentLoad += decayed;
      total.weeklySets += capped;
      totals.set(slug, total);
    }
  }

  const result = new Map<MuscleSlug, MuscleLoadEntry>();
  for (const [slug, total] of totals) {
    result.set(slug, {
      slug,
      recentLoad: total.recentLoad,
      weeklySets: total.weeklySets,
      level: levelFor(total.recentLoad),
      weeklyStatus: weeklyStatusFor(total.weeklySets),
    });
  }

  return result;
}

function sumWeeklySets(
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>,
  slugs: readonly MuscleSlug[]
): number {
  let total = 0;
  for (const slug of slugs) {
    total += load.get(slug)?.weeklySets ?? 0;
  }

  return total;
}

/** The user's own push and pull weekly sets. States volume only, asserts no ideal ratio. */
export function pushPullComparison(
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>
): VolumeComparison {
  return {
    first: sumWeeklySets(load, PUSH_SLUGS),
    second: sumWeeklySets(load, PULL_SLUGS),
  };
}

/** The user's own quadriceps and hamstring weekly sets. No ideal ratio is asserted. */
export function quadHamstringComparison(
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>
): VolumeComparison {
  return {
    first: sumWeeklySets(load, ['quadriceps']),
    second: sumWeeklySets(load, ['hamstring']),
  };
}

/** Body-map shading: the load level of every muscle that has any recent load. */
export function muscleLoadSlugIntensity(
  load: ReadonlyMap<MuscleSlug, MuscleLoadEntry>
): Map<MuscleSlug, number> {
  const intensity = new Map<MuscleSlug, number>();

  for (const entry of load.values()) {
    if (entry.level > 0) {
      intensity.set(entry.slug, entry.level);
    }
  }

  return intensity;
}

/**
 * The sets that `computeMuscleLoad` counts toward one slug at `now`, newest first. The muscle
 * detail list reads this so it can never show a set the body map doesn't count.
 */
export function countedSetsForSlug<T extends MuscleLoadSet>(
  sets: readonly T[],
  slug: MuscleSlug,
  now: number
): T[] {
  return sets
    .filter((set) => isCountedSet(set, now) && roleBySlugForSet(set).has(slug))
    .sort((a, b) => b.performedAt - a.performedAt);
}
