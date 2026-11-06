/**
 * The import screen's state machine. Pure: the hook performs the file, database and parse work and
 * reports each result as an action, so every transition here is testable in the node project.
 */
import type { ExerciseResolution } from '@/database/services/WorkoutImportService';

import type { ExerciseMatch } from './exerciseMatch';
import { inferCustomExercise } from './exerciseMatch';
import { sessionImportKeys } from './importKey';
import type {
  ImportedSession,
  ImportWeightUnit,
  SkippedRow,
  WorkoutImportResult,
  WorkoutImportSource,
} from './types';

export type ImportFailureKind =
  'empty' | 'unknownFormat' | 'noRows' | 'tooLarge' | 'nothingNew' | 'readFailed';

export type ImportStep = 'pick' | 'unit' | 'review' | 'saving' | 'summary' | 'failed';

/** What the person chose for one exercise name in the file. */
export type ExerciseChoice =
  | { kind: 'pick'; exerciseId: string; exerciseName: string; rememberAlias: boolean }
  | { kind: 'create' }
  | { kind: 'skip' };

export interface ImportProgress {
  done: number;
  total: number;
}

export interface ImportSummaryLike {
  batchId: string;
  sessionsImported: number;
  sessionsAlreadyHere: number;
  setsImported: number;
  exercisesCreated: number;
  timedSets: number;
  cardioImported: number;
  exercisesSkipped: number;
}

export interface ImportFlowState {
  step: ImportStep;
  failure: ImportFailureKind | null;
  fileName: string;
  text: string;
  source: WorkoutImportSource | null;
  weightUnitStated: boolean;
  assumedWeightUnit: ImportWeightUnit;
  /** The person has answered the unit question for this file. */
  unitConfirmed: boolean;
  /** Sessions in the file that are not yet in the database. */
  newSessions: ImportedSession[];
  alreadyHereCount: number;
  skipped: SkippedRow[];
  matches: ExerciseMatch[];
  matchesLoading: boolean;
  choices: Record<string, ExerciseChoice>;
  progress: ImportProgress | null;
  saveFailed: boolean;
  summary: ImportSummaryLike | null;
}

export const INITIAL_IMPORT_FLOW: ImportFlowState = {
  step: 'pick',
  failure: null,
  fileName: '',
  text: '',
  source: null,
  weightUnitStated: true,
  assumedWeightUnit: 'kg',
  unitConfirmed: false,
  newSessions: [],
  alreadyHereCount: 0,
  skipped: [],
  matches: [],
  matchesLoading: false,
  choices: {},
  progress: null,
  saveFailed: false,
  summary: null,
};

export type ImportFlowAction =
  | { type: 'fileChosen'; fileName: string; text: string; assumedWeightUnit: ImportWeightUnit }
  | { type: 'failed'; failure: ImportFailureKind }
  | {
      type: 'parsed';
      result: Extract<WorkoutImportResult, { ok: true }>;
      existingKeys: ReadonlySet<string>;
    }
  | { type: 'assumedUnitChanged'; unit: ImportWeightUnit }
  | { type: 'unitConfirmed' }
  | { type: 'matchesLoaded'; matches: ExerciseMatch[] }
  | { type: 'choose'; name: string; choice: ExerciseChoice }
  | { type: 'clearChoice'; name: string }
  | { type: 'setRememberAlias'; name: string; value: boolean }
  | { type: 'saveStarted' }
  | { type: 'saveProgress'; progress: ImportProgress }
  | { type: 'saveSucceeded'; summary: ImportSummaryLike }
  | { type: 'saveFailed' }
  | { type: 'cancel' };

/** Splits the file's sessions into the ones to import and the ones already here. */
export function partitionSessions(
  sessions: readonly ImportedSession[],
  existingKeys: ReadonlySet<string>
): { fresh: ImportedSession[]; alreadyHere: number } {
  const fresh: ImportedSession[] = [];
  let alreadyHere = 0;
  for (const session of sessions) {
    if (sessionImportKeys(session).some((key) => existingKeys.has(key))) {
      alreadyHere += 1;
    } else {
      fresh.push(session);
    }
  }

  return { fresh, alreadyHere };
}

/** The default choice for a name the proposer settled: the matched exercise, no alias saved. */
export function defaultChoicesFor(
  matches: readonly ExerciseMatch[]
): Record<string, ExerciseChoice> {
  const choices: Record<string, ExerciseChoice> = {};
  for (const match of matches) {
    if (match.kind !== 'unmatched' && match.exerciseId) {
      choices[match.name] = {
        kind: 'pick',
        exerciseId: match.exerciseId,
        exerciseName: match.exerciseName ?? match.name,
        rememberAlias: false,
      };
    }
  }

  return choices;
}

/** A name needs the person's decision when no default covers it. */
export function unresolvedNames(state: ImportFlowState): string[] {
  return state.matches
    .filter((match) => match.kind === 'unmatched' && !state.choices[match.name])
    .map((match) => match.name);
}

export function canSaveImport(state: ImportFlowState): boolean {
  return (
    state.step === 'review' &&
    !state.matchesLoading &&
    state.newSessions.length > 0 &&
    unresolvedNames(state).length === 0
  );
}

/** Turns the person's choices into the resolution map the commit takes. Pure. */
export function resolutionsFor(state: ImportFlowState): Map<string, ExerciseResolution> {
  const out = new Map<string, ExerciseResolution>();
  for (const match of state.matches) {
    const choice = state.choices[match.name];
    if (!choice) {
      continue;
    }

    if (choice.kind === 'pick') {
      out.set(match.name, {
        kind: 'existing',
        exerciseId: choice.exerciseId,
        rememberAlias: choice.rememberAlias,
      });
    } else if (choice.kind === 'skip') {
      out.set(match.name, { kind: 'skip' });
    } else {
      out.set(match.name, {
        kind: 'create',
        name: match.name,
        ...inferCustomExercise(match.name, match.category),
      });
    }
  }

  return out;
}

function parsedState(
  state: ImportFlowState,
  result: Extract<WorkoutImportResult, { ok: true }>,
  existingKeys: ReadonlySet<string>
): ImportFlowState {
  const { fresh, alreadyHere } = partitionSessions(result.sessions, existingKeys);
  const base = {
    ...state,
    source: result.source,
    weightUnitStated: result.weightUnitStated,
    skipped: result.skipped,
    newSessions: fresh,
    alreadyHereCount: alreadyHere,
  };
  if (fresh.length === 0) {
    return { ...base, step: 'failed', failure: 'nothingNew' };
  }

  if (!result.weightUnitStated && !state.unitConfirmed) {
    return { ...base, step: 'unit', failure: null };
  }

  return { ...base, step: 'review', failure: null, matches: [], matchesLoading: true, choices: {} };
}

export function importFlowReducer(
  state: ImportFlowState,
  action: ImportFlowAction
): ImportFlowState {
  switch (action.type) {
    case 'fileChosen':
      return {
        ...INITIAL_IMPORT_FLOW,
        fileName: action.fileName,
        text: action.text,
        assumedWeightUnit: action.assumedWeightUnit,
      };
    case 'failed':
      return { ...state, step: 'failed', failure: action.failure };
    case 'parsed':
      return parsedState(state, action.result, action.existingKeys);
    case 'assumedUnitChanged':
      // Keeps the text: the hook re-parses it and reports back with `parsed`.
      return { ...state, assumedWeightUnit: action.unit };
    case 'unitConfirmed':
      return state.step === 'unit'
        ? { ...state, unitConfirmed: true, step: 'review', matches: [], matchesLoading: true }
        : state;
    case 'matchesLoaded':
      return {
        ...state,
        matches: action.matches,
        matchesLoading: false,
        choices: defaultChoicesFor(action.matches),
      };
    case 'choose':
      return { ...state, choices: { ...state.choices, [action.name]: action.choice } };
    case 'clearChoice': {
      // Back to what the matcher proposed. A name left with no choice is skipped at commit, so a
      // matched name must never end up without one or its sets would silently vanish.
      const choices = { ...state.choices };
      const proposed = defaultChoicesFor(state.matches)[action.name];
      if (proposed) {
        choices[action.name] = proposed;
      } else {
        delete choices[action.name];
      }

      return { ...state, choices };
    }

    case 'setRememberAlias': {
      const choice = state.choices[action.name];
      if (choice?.kind !== 'pick') {
        return state;
      }

      return {
        ...state,
        choices: { ...state.choices, [action.name]: { ...choice, rememberAlias: action.value } },
      };
    }

    case 'saveStarted':
      if (!canSaveImport(state)) {
        return state;
      }

      return {
        ...state,
        step: 'saving',
        saveFailed: false,
        progress: { done: 0, total: state.newSessions.length },
      };
    case 'saveProgress':
      return state.step === 'saving' ? { ...state, progress: action.progress } : state;
    case 'saveSucceeded':
      return { ...state, step: 'summary', summary: action.summary, progress: null };
    case 'saveFailed':
      // Stays on review so the choices survive a failed save.
      return { ...state, step: 'review', saveFailed: true, progress: null };
    case 'cancel':
      // A save runs to completion; the modal cannot close over it.
      return state.step === 'saving' ? state : INITIAL_IMPORT_FLOW;
    default:
      return state;
  }
}

/** Proper nouns, so they live in a constant table rather than the translations. */
export const IMPORT_SOURCE_NAMES: Record<WorkoutImportSource, string> = {
  strong: 'Strong',
  hevy: 'Hevy',
  fitnotes: 'FitNotes',
  fitnotes2: 'FitNotes',
};

export interface ReviewSections {
  /** Names the matcher could not settle. Stable: a resolved row stays here until the screen closes. */
  needsChoice: ExerciseMatch[];
  matched: ExerciseMatch[];
}

/** Splits by the matcher's verdict rather than the person's choices, so rows never jump while tapped. */
export function reviewSections(matches: readonly ExerciseMatch[]): ReviewSections {
  return {
    needsChoice: matches.filter((match) => match.kind === 'unmatched'),
    matched: matches.filter((match) => match.kind !== 'unmatched'),
  };
}

export interface FirstWeightedSet {
  exerciseName: string;
  weightKg: number;
  reps: number;
}

/** The first weighted set in the file: the figure the unit question is answered against. */
export function firstWeightedSet(sessions: readonly ImportedSession[]): FirstWeightedSet | null {
  for (const session of sessions) {
    for (const block of session.exercises) {
      const set = block.sets.find((candidate) => candidate.weightKg > 0);
      if (set) {
        return { exerciseName: block.name, weightKg: set.weightKg, reps: set.reps };
      }
    }
  }

  return null;
}
