import type { ExerciseMatch } from '../exerciseMatch';
import {
  canSaveImport,
  defaultChoicesFor,
  firstWeightedSet,
  importFlowReducer,
  INITIAL_IMPORT_FLOW,
  partitionSessions,
  resolutionsFor,
  type ImportFlowState,
} from '../importFlow';
import type { ImportedSession, WorkoutImportResult } from '../types';

type OkResult = Extract<WorkoutImportResult, { ok: true }>;

function session(key: string, names: string[] = ['Bench Press'], cardio = 0): ImportedSession {
  return {
    importKey: key,
    source: 'strong',
    name: 'Push',
    day: '2026-03-01',
    startMinutes: 600,
    durationSeconds: null,
    notes: null,
    exercises: names.map((name) => ({
      name,
      category: null,
      notes: null,
      supersetKey: null,
      sets: [
        {
          setType: 'normal',
          reps: 5,
          weightKg: 60,
          rpe: null,
          durationSeconds: null,
          distanceM: null,
        },
      ],
    })),
    cardio: Array.from({ length: cardio }, (_, index) => ({
      name: `Walk ${index}`,
      activity: 'walk' as const,
      distanceM: 1000,
      durationSeconds: null,
      notes: null,
    })),
  };
}

function result(sessions: ImportedSession[], weightUnitStated = true): OkResult {
  return { ok: true, source: 'strong', weightUnitStated, sessions, skipped: [] };
}

function parsed(
  state: ImportFlowState,
  sessions: ImportedSession[],
  existing: string[] = [],
  stated = true
) {
  return importFlowReducer(state, {
    type: 'parsed',
    result: result(sessions, stated),
    existingKeys: new Set(existing),
  });
}

function reviewed(sessions: ImportedSession[], matches: ExerciseMatch[]): ImportFlowState {
  let state = importFlowReducer(INITIAL_IMPORT_FLOW, {
    type: 'fileChosen',
    assumedWeightUnit: 'kg',
    fileName: 'a.csv',
    text: 'x',
  });
  state = parsed(state, sessions);
  return importFlowReducer(state, { type: 'matchesLoaded', matches });
}

const matched: ExerciseMatch = {
  name: 'Bench Press',
  kind: 'exact',
  exerciseId: 'ex-1',
  exerciseName: 'Barbell Bench Press',
  setCount: 1,
  category: null,
};
const unmatched: ExerciseMatch = {
  name: 'Zercher Squat',
  kind: 'unmatched',
  exerciseId: null,
  exerciseName: null,
  setCount: 1,
  category: 'legs',
};

describe('importFlowReducer', () => {
  it('asks for the unit only when the file does not state it', () => {
    const unstated = parsed(INITIAL_IMPORT_FLOW, [session('a')], [], false);
    expect(unstated.step).toBe('unit');

    const stated = parsed(INITIAL_IMPORT_FLOW, [session('a')], [], true);
    expect(stated.step).toBe('review');
    expect(stated.matchesLoading).toBe(true);
  });

  it('keeps the text when the assumed unit changes and re-parses on the unit step', () => {
    let state = importFlowReducer(INITIAL_IMPORT_FLOW, {
      type: 'fileChosen',
      assumedWeightUnit: 'kg',
      fileName: 'a.csv',
      text: 'raw text',
    });
    state = parsed(state, [session('a')], [], false);
    const changed = importFlowReducer(state, { type: 'assumedUnitChanged', unit: 'lbs' });
    expect(changed.text).toBe('raw text');
    expect(changed.assumedWeightUnit).toBe('lbs');
    expect(changed.step).toBe('unit');

    const reparsed = parsed(changed, [session('a')], [], false);
    expect(reparsed.step).toBe('unit');
    expect(reparsed.text).toBe('raw text');
  });

  it('moves from the unit step to review once confirmed', () => {
    let state = parsed(INITIAL_IMPORT_FLOW, [session('a')], [], false);
    state = importFlowReducer(state, { type: 'unitConfirmed' });
    expect(state.step).toBe('review');
    expect(state.unitConfirmed).toBe(true);
  });

  it('reports nothingNew as a friendly failure when every session is already here', () => {
    const state = parsed(INITIAL_IMPORT_FLOW, [session('a'), session('b')], ['a', 'b']);
    expect(state.step).toBe('failed');
    expect(state.failure).toBe('nothingNew');
    expect(state.alreadyHereCount).toBe(2);
  });

  it('counts a cardio-only session as already here when its cardio key exists', () => {
    const cardioOnly = session('c', [], 1);
    const { fresh, alreadyHere } = partitionSessions([cardioOnly], new Set(['c#cardio0']));
    expect(fresh).toEqual([]);
    expect(alreadyHere).toBe(1);
  });

  it('keeps unmatched names without a default, so save stays disabled', () => {
    const state = reviewed([session('a', ['Bench Press', 'Zercher Squat'])], [matched, unmatched]);
    expect(state.choices['Bench Press']).toMatchObject({
      kind: 'pick',
      exerciseId: 'ex-1',
      rememberAlias: false,
    });
    expect(state.choices['Zercher Squat']).toBeUndefined();
    expect(canSaveImport(state)).toBe(false);
  });

  it('puts a matched name back on its match when its choice is reset', () => {
    let state = reviewed([session('a', ['Bench Press'])], [matched]);
    const proposed = state.choices['Bench Press'];
    state = importFlowReducer(state, {
      type: 'choose',
      name: 'Bench Press',
      choice: { kind: 'skip' },
    });

    state = importFlowReducer(state, { type: 'clearChoice', name: 'Bench Press' });

    // With no choice the commit would skip the name, and its sets would silently vanish.
    expect(state.choices['Bench Press']).toEqual(proposed);
    expect(resolutionsFor(state).get('Bench Press')?.kind).toBe('existing');
  });

  it('enables save once each unmatched name is created or skipped', () => {
    let state = reviewed([session('a', ['Bench Press', 'Zercher Squat'])], [matched, unmatched]);
    state = importFlowReducer(state, {
      type: 'choose',
      name: 'Zercher Squat',
      choice: { kind: 'skip' },
    });
    expect(canSaveImport(state)).toBe(true);

    state = importFlowReducer(state, { type: 'clearChoice', name: 'Zercher Squat' });
    expect(canSaveImport(state)).toBe(false);

    state = importFlowReducer(state, {
      type: 'choose',
      name: 'Zercher Squat',
      choice: { kind: 'create' },
    });
    expect(canSaveImport(state)).toBe(true);
    expect(resolutionsFor(state).get('Zercher Squat')).toMatchObject({
      kind: 'create',
      name: 'Zercher Squat',
    });
  });

  it('turns a manual pick into an existing resolution that remembers the alias when asked', () => {
    let state = reviewed([session('a', ['Zercher Squat'])], [unmatched]);
    state = importFlowReducer(state, {
      type: 'choose',
      name: 'Zercher Squat',
      choice: {
        kind: 'pick',
        exerciseId: 'ex-9',
        exerciseName: 'Front Squat',
        rememberAlias: true,
      },
    });
    state = importFlowReducer(state, {
      type: 'setRememberAlias',
      name: 'Zercher Squat',
      value: false,
    });
    expect(resolutionsFor(state).get('Zercher Squat')).toEqual({
      kind: 'existing',
      exerciseId: 'ex-9',
      rememberAlias: false,
    });
  });

  it('keeps the choices and stays on review when a save fails', () => {
    let state = reviewed([session('a', ['Zercher Squat'])], [unmatched]);
    state = importFlowReducer(state, {
      type: 'choose',
      name: 'Zercher Squat',
      choice: { kind: 'skip' },
    });
    state = importFlowReducer(state, { type: 'saveStarted' });
    expect(state.step).toBe('saving');

    state = importFlowReducer(state, { type: 'saveFailed' });
    expect(state.step).toBe('review');
    expect(state.saveFailed).toBe(true);
    expect(state.choices['Zercher Squat']).toEqual({ kind: 'skip' });
  });

  it('does not start a save while a name is unresolved', () => {
    const state = reviewed([session('a', ['Zercher Squat'])], [unmatched]);
    expect(importFlowReducer(state, { type: 'saveStarted' })).toBe(state);
  });

  it('reaches the summary on success', () => {
    let state = reviewed([session('a')], [matched]);
    state = importFlowReducer(state, { type: 'saveStarted' });
    state = importFlowReducer(state, {
      type: 'saveSucceeded',
      summary: {
        sessionsImported: 1,
        sessionsAlreadyHere: 0,
        setsImported: 1,
        exercisesCreated: 0,
        timedSets: 0,
        cardioImported: 0,
        exercisesSkipped: 0,
      },
    });
    expect(state.step).toBe('summary');
    expect(state.summary?.sessionsImported).toBe(1);
  });

  it('cancel resets the flow, but not while saving', () => {
    let state = reviewed([session('a')], [matched]);
    state = importFlowReducer(state, { type: 'saveStarted' });
    expect(importFlowReducer(state, { type: 'cancel' })).toBe(state);

    const cancelled = importFlowReducer(reviewed([session('a')], [matched]), { type: 'cancel' });
    expect(cancelled).toEqual(INITIAL_IMPORT_FLOW);
  });

  it('carries the file failures through to the failed step', () => {
    const state = importFlowReducer(INITIAL_IMPORT_FLOW, { type: 'failed', failure: 'tooLarge' });
    expect(state.step).toBe('failed');
    expect(state.failure).toBe('tooLarge');
  });

  it('shows the unit the file was parsed with, not a stale default', () => {
    const state = importFlowReducer(INITIAL_IMPORT_FLOW, {
      type: 'fileChosen',
      assumedWeightUnit: 'lbs',
      fileName: 'strong.csv',
      text: 'x',
    });
    expect(state.assumedWeightUnit).toBe('lbs');
  });

  it('offers the matched exercise by its own name, so the match can be checked', () => {
    expect(defaultChoicesFor([matched])).toEqual({
      [matched.name]: expect.objectContaining({ exerciseName: 'Barbell Bench Press' }),
    });
  });
});

describe('firstWeightedSet', () => {
  it('finds the first set with a weight, naming its exercise', () => {
    const bodyweightFirst = session('a', ['Pull Up', 'Bench Press']);
    bodyweightFirst.exercises[0].sets[0].weightKg = 0;

    expect(firstWeightedSet([bodyweightFirst])).toEqual({
      exerciseName: 'Bench Press',
      weightKg: 60,
      reps: 5,
    });
  });

  it('is null for a file with no weighted set', () => {
    const bodyweight = session('a', ['Pull Up']);
    bodyweight.exercises[0].sets[0].weightKg = 0;

    expect(firstWeightedSet([bodyweight])).toBeNull();
  });
});
