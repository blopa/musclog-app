/**
 * What a workout import will write, decided without touching the database: how a session's date
 * becomes a timestamp, which blocks survive the person's exercise choices, and what each file
 * exercise name resolves to. Pure, so `WorkoutImportService` is left with queries and batches.
 */
import type { EquipmentType, MechanicType, MuscleGroup } from '@/database/models/Exercise';
import { normalizeNote } from '@/utils/noteText';

import type { ImportedExerciseBlock, ImportedSession, ImportedSet } from './types';

/** The fields of an exercise the person asked the import to create. */
export interface CustomExerciseSpec {
  name: string;
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  mechanicType: MechanicType;
}

/** What to do with one exercise name from the file. Keyed by the file's exact name. */
export type ExerciseResolution =
  | { kind: 'existing'; exerciseId: string; rememberAlias: boolean }
  | ({ kind: 'create' } & CustomExerciseSpec)
  | { kind: 'skip' };

export interface ResolvedExerciseNames {
  /** File name -> the live exercise to use, and whether to remember the name as an alias. */
  existing: Map<string, { exerciseId: string; rememberAlias: boolean }>;
  /** File name -> the exercise to create for it. */
  custom: Map<string, CustomExerciseSpec>;
  /** File names that write nothing: skipped, unresolved, or naming a since-deleted exercise. */
  skipped: Set<string>;
}

/**
 * Sorts every exercise name in the file by what the person chose. A name with no choice, or whose
 * chosen exercise has been deleted since, is skipped rather than guessed.
 */
export function partitionResolutions(
  names: readonly string[],
  resolutions: ReadonlyMap<string, ExerciseResolution>,
  liveExerciseIds: { has(id: string): boolean }
): ResolvedExerciseNames {
  const resolved: ResolvedExerciseNames = {
    existing: new Map(),
    custom: new Map(),
    skipped: new Set(),
  };

  for (const name of names) {
    const resolution = resolutions.get(name);
    if (resolution?.kind === 'existing' && liveExerciseIds.has(resolution.exerciseId)) {
      resolved.existing.set(name, {
        exerciseId: resolution.exerciseId,
        rememberAlias: resolution.rememberAlias,
      });
    } else if (resolution?.kind === 'create') {
      const { name: customName, muscleGroup, equipmentType, mechanicType } = resolution;
      resolved.custom.set(name, { name: customName, muscleGroup, equipmentType, mechanicType });
    } else {
      resolved.skipped.add(name);
    }
  }

  return resolved;
}

export function distinctBlockNames(sessions: readonly ImportedSession[]): string[] {
  return [...new Set(sessions.flatMap((session) => session.exercises.map((block) => block.name)))];
}

/**
 * The session's start in local time. A day-only file gets local noon, so the workout stays on its
 * day in every timezone.
 */
export function sessionStartedAt(day: string, startMinutes: number | null): number {
  const [year, month, dayOfMonth] = day.split('-').map(Number);
  if (startMinutes === null) {
    return new Date(year, month - 1, dayOfMonth, 12, 0).getTime();
  }

  return new Date(year, month - 1, dayOfMonth, 0, startMinutes).getTime();
}

/** A timed set has no reps; its time and distance travel in the exercise note instead. */
export function isTimedSet(set: ImportedSet): boolean {
  return set.reps === 0 && (set.durationSeconds ?? set.distanceM ?? 0) > 0;
}

function timedNoteLines(set: ImportedSet): string[] {
  if (set.reps > 0) {
    return [];
  }

  // Language-neutral on purpose: a note written in the file's own units, not translated copy.
  const lines: string[] = [];
  if (set.durationSeconds !== null && set.durationSeconds > 0) {
    lines.push(`${Math.round(set.durationSeconds)} s`);
  }

  if (set.distanceM !== null && set.distanceM > 0) {
    lines.push(`${Math.round(set.distanceM / 10) / 100} km`);
  }

  return lines;
}

/** The exercise note: the file's own lines, then each timed set's time, without repeats. */
export function blockNotes(block: ImportedExerciseBlock): string | undefined {
  const lines = new Set<string>();
  for (const line of (block.notes ?? '').split('\n')) {
    if (line.trim()) {
      lines.add(line.trim());
    }
  }

  for (const set of block.sets) {
    for (const line of timedNoteLines(set)) {
      lines.add(line);
    }
  }

  return normalizeNote([...lines].join('\n'));
}

export interface PlannedBlock {
  block: ImportedExerciseBlock;
  exerciseId: string;
  sets: ImportedSet[];
}

/** Blocks that will be written: resolved to a live exercise and with at least one set. */
export function plannedBlocks(
  session: ImportedSession,
  exerciseIdByName: ReadonlyMap<string, string>
): PlannedBlock[] {
  return session.exercises.flatMap((block) => {
    const exerciseId = exerciseIdByName.get(block.name);
    if (!exerciseId || block.sets.length === 0) {
      return [];
    }

    return [{ block, exerciseId, sets: block.sets }];
  });
}
