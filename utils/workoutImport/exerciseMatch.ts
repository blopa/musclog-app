/**
 * Proposes, for each exercise name in an import file, the catalogue exercise it means. Pure: the
 * caller supplies the candidates and the saved aliases, and decides what to do with the answer.
 *
 * Order of trust: a saved alias, then an exact normalised name, then the curated table, then the
 * unambiguous fuzzy search. A name that none of them settles is `unmatched`. Guessing between
 * plausible exercises would log sets against the wrong movement, so it never happens.
 */
import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';
import { appExerciseId } from '@/utils/exerciseImage';
import { findExerciseByName, tokenizeExerciseText } from '@/utils/exerciseSearch';

import { curatedExerciseSlug } from './foreignExerciseNames';
import type { ImportedSession } from './types';

export type ExerciseMatchKind = 'alias' | 'exact' | 'known' | 'unambiguous' | 'unmatched';

export interface ExerciseMatchCandidate {
  id: string;
  name: string;
  searchText?: string | null;
}

export interface ExerciseMatch {
  name: string;
  kind: ExerciseMatchKind;
  exerciseId: string | null;
  /** The matched exercise's own name, so the person can check the match. */
  exerciseName: string | null;
  setCount: number;
  category: string | null;
}

export interface SavedExerciseAlias {
  alias: string;
  exerciseId: string;
}

/** The normalised form every name is compared by. */
export function exerciseNameKey(name: string): string {
  return tokenizeExerciseText(name).join(' ');
}

interface NameGroup {
  name: string;
  setCount: number;
  category: string | null;
}

/** Strength blocks only: cardio is logged separately and never needs a catalogue exercise. */
function groupByName(sessions: readonly ImportedSession[]): NameGroup[] {
  const groups = new Map<string, NameGroup>();
  for (const session of sessions) {
    for (const block of session.exercises) {
      const group = groups.get(block.name) ?? { name: block.name, setCount: 0, category: null };
      group.setCount += block.sets.length;
      if (group.category === null && block.category) {
        group.category = block.category;
      }

      groups.set(block.name, group);
    }
  }

  return [...groups.values()];
}

function indexById(candidates: readonly ExerciseMatchCandidate[]): Set<string> {
  return new Set(candidates.map((candidate) => candidate.id));
}

function exactMatchesByKey(
  candidates: readonly ExerciseMatchCandidate[]
): Map<string, ExerciseMatchCandidate[]> {
  const byKey = new Map<string, ExerciseMatchCandidate[]>();
  for (const candidate of candidates) {
    const key = exerciseNameKey(candidate.name);
    const list = byKey.get(key) ?? [];
    list.push(candidate);
    byKey.set(key, list);
  }

  return byKey;
}

function aliasTargetsByKey(
  aliases: readonly SavedExerciseAlias[],
  live: Set<string>
): Map<string, string> {
  const targets = new Map<string, string>();
  for (const { alias, exerciseId } of aliases) {
    const key = exerciseNameKey(alias);
    if (key && live.has(exerciseId) && !targets.has(key)) {
      targets.set(key, exerciseId);
    }
  }

  return targets;
}

function resolveName(
  group: NameGroup,
  context: {
    candidates: readonly ExerciseMatchCandidate[];
    live: Set<string>;
    exactByKey: Map<string, ExerciseMatchCandidate[]>;
    aliasByKey: Map<string, string>;
  }
): Pick<ExerciseMatch, 'kind' | 'exerciseId'> {
  const key = exerciseNameKey(group.name);
  if (!key) {
    return { kind: 'unmatched', exerciseId: null };
  }

  const aliased = context.aliasByKey.get(key);
  if (aliased) {
    return { kind: 'alias', exerciseId: aliased };
  }

  const exact = context.exactByKey.get(key) ?? [];
  if (exact.length === 1) {
    return { kind: 'exact', exerciseId: exact[0].id };
  }

  if (exact.length > 1) {
    // Two identical catalogue names: which one is meant is not something to guess.
    return { kind: 'unmatched', exerciseId: null };
  }

  const slug = curatedExerciseSlug(key);
  if (slug) {
    const id = appExerciseId(slug);
    if (context.live.has(id)) {
      return { kind: 'known', exerciseId: id };
    }
  }

  const fuzzy = findExerciseByName(context.candidates, group.name);
  if (fuzzy) {
    return { kind: 'unambiguous', exerciseId: fuzzy.id };
  }

  return { kind: 'unmatched', exerciseId: null };
}

/** One entry per distinct strength-exercise name in the sessions, most-used first. */
export function proposeExerciseMatches(
  sessions: readonly ImportedSession[],
  candidates: readonly ExerciseMatchCandidate[],
  aliases: readonly SavedExerciseAlias[]
): ExerciseMatch[] {
  const live = indexById(candidates);
  const context = {
    candidates,
    live,
    exactByKey: exactMatchesByKey(candidates),
    aliasByKey: aliasTargetsByKey(aliases, live),
  };

  const nameById = new Map(candidates.map((candidate) => [candidate.id, candidate.name]));

  return groupByName(sessions)
    .map((group) => {
      const resolved = resolveName(group, context);
      const exerciseName = resolved.exerciseId ? (nameById.get(resolved.exerciseId) ?? null) : null;
      return { ...group, ...resolved, exerciseName };
    })
    .sort((a, b) => b.setCount - a.setCount || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------------------------
// Custom exercises: a best guess at the coarse fields, used only when the user accepts a new row.
// ---------------------------------------------------------------------------------------------

type CoarseMuscleGroup = Extract<
  MuscleGroup,
  'abdomen' | 'arms' | 'back' | 'chest' | 'full_body' | 'glutes' | 'legs' | 'shoulders'
>;

/** FitNotes' Category column. A Map, so a category such as `__proto__` cannot reach the prototype. */
const CATEGORY_MUSCLE = new Map<string, MuscleGroup>([
  ['chest', 'chest'],
  ['back', 'back'],
  ['shoulders', 'shoulders'],
  ['biceps', 'arms'],
  ['triceps', 'arms'],
  ['forearms', 'arms'],
  ['legs', 'legs'],
  ['abs', 'abdomen'],
  ['glutes', 'glutes'],
  ['cardio', 'full_body'],
]);

/** Ordered: the first group with a matching phrase wins, so leg extensions are legs, not arms. */
const MUSCLE_PHRASES: readonly (readonly [CoarseMuscleGroup, readonly string[]])[] = [
  [
    'legs',
    [
      'leg press',
      'leg extension',
      'leg curl',
      'squat',
      'lunge',
      'calf',
      'hamstring',
      'quad',
      'step up',
      'romanian',
      'stiff leg',
      'good morning',
    ],
  ],
  ['glutes', ['hip thrust', 'glute', 'kickback', 'hip']],
  [
    'abdomen',
    [
      'crunch',
      'sit up',
      'plank',
      'ab wheel',
      'ab roller',
      'rollout',
      'russian twist',
      'leg raise',
      'core',
      'ab',
    ],
  ],
  ['arms', ['curl', 'bicep', 'tricep', 'skull', 'pushdown', 'extension', 'wrist']],
  [
    'shoulders',
    [
      'shoulder',
      'overhead',
      'military',
      'lateral',
      'raise',
      'delt',
      'shrug',
      'upright',
      'face pull',
      'arnold',
    ],
  ],
  ['chest', ['bench', 'chest', 'fly', 'flye', 'pec', 'push up', 'pushup', 'dip']],
  [
    'back',
    [
      'row',
      'pulldown',
      'pull up',
      'pullup',
      'chin up',
      'chinup',
      'deadlift',
      'lat',
      'pullover',
      'back extension',
      'hyperextension',
    ],
  ],
];

const EQUIPMENT_PHRASES: readonly (readonly [EquipmentType, readonly string[]])[] = [
  ['smith_machine', ['smith']],
  ['dumbbell', ['dumbbell', 'dumbell', 'db']],
  ['barbell', ['barbell', 'ez bar', 'ez']],
  ['kettlebell', ['kettlebell', 'kb']],
  ['cable', ['cable']],
  ['medicine_ball', ['medicine ball']],
  ['resistance_band', ['band']],
  ['plate_machine', ['machine']],
  ['bodyweight', ['bodyweight', 'body weight']],
];

const BODYWEIGHT_NAMES = [
  'push up',
  'pushup',
  'pull up',
  'pullup',
  'chin up',
  'chinup',
  'dip',
  'plank',
  'crunch',
  'sit up',
];
const COMPOUND_PHRASES = [
  'press',
  'squat',
  'deadlift',
  'row',
  'pulldown',
  'pull up',
  'chin up',
  'dip',
  'lunge',
  'clean',
  'snatch',
  'thrust',
  'push up',
  'pushup',
  'bench',
  'swing',
];
const ISOLATION_PHRASES = [
  'curl',
  'raise',
  'fly',
  'flye',
  'extension',
  'pushdown',
  'crunch',
  'kickback',
  'shrug',
  'pullover',
  'skull',
  'calf',
  'lateral',
  'plank',
  'sit up',
  'twist',
];

/** Phrase match on whole words: `lat` matches "Lat Pulldown" but not "Plate". */
function mentions(key: string, phrases: readonly string[]): boolean {
  const padded = ` ${key} `;
  return phrases.some((phrase) => padded.includes(` ${phrase} `));
}

function inferMuscle(key: string, category: string | null): MuscleGroup {
  const fromCategory = category ? CATEGORY_MUSCLE.get(category.trim().toLowerCase()) : undefined;
  if (fromCategory) {
    return fromCategory;
  }

  const found = MUSCLE_PHRASES.find(([, phrases]) => mentions(key, phrases));
  return found ? found[0] : 'other';
}

function inferEquipment(key: string): EquipmentType {
  const found = EQUIPMENT_PHRASES.find(([, phrases]) => mentions(key, phrases));
  if (found) {
    return found[0];
  }

  return mentions(key, BODYWEIGHT_NAMES) ? 'bodyweight' : 'other';
}

function inferMechanic(key: string, category: string | null): MechanicType {
  if (category?.trim().toLowerCase() === 'cardio') {
    return 'cardio';
  }

  if (mentions(key, COMPOUND_PHRASES)) {
    return 'compound';
  }

  return mentions(key, ISOLATION_PHRASES) ? 'isolation' : 'other';
}

export function inferCustomExercise(
  name: string,
  category: string | null
): { muscleGroup: MuscleGroup; equipmentType: EquipmentType; mechanicType: MechanicType } {
  const key = exerciseNameKey(name);
  return {
    muscleGroup: inferMuscle(key, category),
    equipmentType: inferEquipment(key),
    mechanicType: inferMechanic(key, category),
  };
}
