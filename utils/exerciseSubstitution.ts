import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';
import { muscleGroupFamily } from '@/database/models/muscleGroupFamily';

import { type GymSnapshot, isEquipmentAvailable } from './gym';

/**
 * Why an exercise should not be suggested. In strictness order:
 *  - `never`    — the user said so, with no condition;
 *  - `injury`   — it hurts; may expire when the injury heals;
 *  - `dislike`  — they just don't like it. The only soft one: it is demoted, not removed.
 */
export type RestrictionKind = 'dislike' | 'injury' | 'never';

export interface ActiveRestriction {
  exerciseId: string;
  kind: RestrictionKind;
  /** When an injury is expected to have healed. Absent or null means it does not expire. */
  expiresAt?: number | null;
}

export interface SubstitutionExercise {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
}

export interface SubstitutionContext {
  restrictions: readonly ActiveRestriction[];
  /** The gym being trained in; `null` restricts nothing. */
  gym?: Pick<GymSnapshot, 'equipment'> | null;
  /** Exercises the user has done recently: a mild tie-breaker towards familiar movements. */
  recentExerciseIds?: ReadonlySet<string>;
  now?: number;
}

export interface RankedSubstitute<T extends SubstitutionExercise> {
  exercise: T;
  score: number;
  /** In the same body region as the exercise being replaced. */
  sameFamily: boolean;
  disliked: boolean;
}

export type ExclusionReason = 'equipment' | 'injury' | 'never';

const SAME_FAMILY = 100;
const SAME_MUSCLE_GROUP = 20;
const SAME_MECHANIC = 15;
const SAME_EQUIPMENT = 10;
const RECENTLY_USED = 5;
const DISLIKED = -60;

export const isRestrictionActive = (restriction: ActiveRestriction, now: number): boolean =>
  restriction.expiresAt == null || restriction.expiresAt > now;

/** The restriction in force for an exercise. When several exist the strictest wins. */
export function activeRestrictionFor(
  exerciseId: string,
  restrictions: readonly ActiveRestriction[],
  now: number = Date.now()
): ActiveRestriction | undefined {
  const strictness: Record<RestrictionKind, number> = { never: 3, injury: 2, dislike: 1 };
  return restrictions
    .filter(
      (restriction) =>
        restriction.exerciseId === exerciseId && isRestrictionActive(restriction, now)
    )
    .sort((a, b) => strictness[b.kind] - strictness[a.kind])[0];
}

/**
 * Whether an exercise must be left out entirely, and why. The precedence is deliberate: a pain
 * report or a "never" outranks anything an algorithm might score, and a missing machine outranks a
 * preference. A dislike is NOT an exclusion — see `rankSubstitutes`.
 */
export function exerciseExclusionReason(
  exercise: Pick<SubstitutionExercise, 'id' | 'equipmentType'>,
  ctx: SubstitutionContext
): ExclusionReason | null {
  const restriction = activeRestrictionFor(exercise.id, ctx.restrictions, ctx.now);
  if (restriction?.kind === 'never') {
    return 'never';
  }
  if (restriction?.kind === 'injury') {
    return 'injury';
  }
  if (!isEquipmentAvailable(exercise.equipmentType, ctx.gym)) {
    return 'equipment';
  }
  return null;
}

/** False for anything a suggestion, a generated plan or a swap list must never contain. */
export function isExerciseSuggestible(
  exercise: Pick<SubstitutionExercise, 'id' | 'equipmentType'>,
  ctx: SubstitutionContext
): boolean {
  return exerciseExclusionReason(exercise, ctx) === null;
}

/**
 * Orders the exercises that could stand in for `current`, best first.
 *
 * Excluded exercises (never, injury, equipment the gym lacks) are dropped. A disliked exercise
 * stays but is flagged and pushed down, so it remains reachable without being recommended.
 * `current` itself is never offered. Ties break alphabetically so the order is stable.
 */
export function rankSubstitutes<T extends SubstitutionExercise>(
  current: SubstitutionExercise,
  candidates: readonly T[],
  ctx: SubstitutionContext
): RankedSubstitute<T>[] {
  const currentFamily = muscleGroupFamily(current.muscleGroup);

  return candidates
    .filter((candidate) => candidate.id !== current.id && isExerciseSuggestible(candidate, ctx))
    .map((candidate) => {
      const sameFamily = muscleGroupFamily(candidate.muscleGroup) === currentFamily;
      const disliked =
        activeRestrictionFor(candidate.id, ctx.restrictions, ctx.now)?.kind === 'dislike';

      let score = 0;
      if (sameFamily) {
        score += SAME_FAMILY;
      }
      if (candidate.muscleGroup === current.muscleGroup) {
        score += SAME_MUSCLE_GROUP;
      }
      if (candidate.mechanicType === current.mechanicType) {
        score += SAME_MECHANIC;
      }
      if (candidate.equipmentType === current.equipmentType) {
        score += SAME_EQUIPMENT;
      }
      if (ctx.recentExerciseIds?.has(candidate.id)) {
        score += RECENTLY_USED;
      }
      if (disliked) {
        score += DISLIKED;
      }

      return { exercise: candidate, score, sameFamily, disliked };
    })
    .sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name));
}

/** Why the user swapped an exercise mid-session. Recorded on the log exercise. */
export const SUBSTITUTION_REASONS = [
  'equipment_unavailable',
  'pain',
  'too_hard',
  'too_easy',
  'dislike',
  'machine_occupied',
  'just_today',
] as const;

export type SubstitutionReason = (typeof SUBSTITUTION_REASONS)[number];

export const isSubstitutionReason = (value: unknown): value is SubstitutionReason =>
  typeof value === 'string' && (SUBSTITUTION_REASONS as readonly string[]).includes(value);

/**
 * Reasons that describe THIS session only. Swapping because the cable station was occupied must
 * never quietly rewrite what the user prefers or what their gym has — which is the whole point of
 * "just today" — so nothing is offered for these beyond the swap itself.
 */
export const SESSION_ONLY_REASONS: readonly SubstitutionReason[] = [
  'just_today',
  'machine_occupied',
];

/** What the user chose to remember alongside a swap. Everything here is opt-in. */
export interface SubstitutionOutcome {
  reason: SubstitutionReason;
  /** Stop suggesting the exercise that was swapped out. */
  restriction?: { kind: RestrictionKind; expiresAt?: number | null };
  /** The swapped-out exercise's equipment is missing from the active gym: remove it there. */
  removeEquipmentFromGym?: boolean;
}

/** The restriction a reason most plausibly implies, offered as the default choice (never applied silently). */
export function restrictionKindForReason(
  reason: SubstitutionReason
): Exclude<RestrictionKind, 'never'> | null {
  if (reason === 'pain') {
    return 'injury';
  }
  if (reason === 'dislike') {
    return 'dislike';
  }
  return null;
}

/** How long an injury should keep an exercise out of suggestions. `open` never expires by itself. */
export const INJURY_EXPIRY_OPTIONS = ['2w', '4w', '12w', 'open'] as const;

export type InjuryExpiryOption = (typeof INJURY_EXPIRY_OPTIONS)[number];

const MS_PER_DAY = 86_400_000;
const INJURY_EXPIRY_DAYS: Record<Exclude<InjuryExpiryOption, 'open'>, number> = {
  '2w': 14,
  '4w': 28,
  '12w': 84,
};

/** When an injury should have healed, or `null` for "until I say otherwise". */
export function injuryExpiryTimestamp(
  option: InjuryExpiryOption,
  now: number = Date.now()
): number | null {
  return option === 'open' ? null : now + INJURY_EXPIRY_DAYS[option] * MS_PER_DAY;
}

/** The option a stored expiry was most likely created from, so a form can show it selected. */
export function injuryExpiryOptionFor(
  expiresAt: number | null | undefined,
  now: number = Date.now()
): InjuryExpiryOption {
  if (expiresAt == null) {
    return 'open';
  }
  const days = (expiresAt - now) / MS_PER_DAY;
  if (days <= 21) {
    return '2w';
  }
  return days <= 56 ? '4w' : '12w';
}
