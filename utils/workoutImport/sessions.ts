/**
 * Entry point: turns an export's text into sessions. Never throws; any
 * unexpected failure is reported as an unknown format.
 */
import { parseCsvTable } from './csv';
import { buildImportKey } from './importKey';
import { parseImportDate } from './parseDate';
import { MAX_IMPORT_SET_SECONDS } from './parseNumber';
import type { MappingContext, RowDraft } from './rows';
import { buildMappingContext, cardioActivityFor, mapRow } from './rows';
import { buildColumnMap, detectSource } from './sources';
import type {
  ImportedCardio,
  ImportedExerciseBlock,
  ImportedSession,
  ImportedSet,
  ImportWeightUnit,
  SkippedRow,
  WorkoutImportResult,
  WorkoutImportSource,
} from './types';

export interface WorkoutImportOptions {
  /** The unit for a bare `Weight` column that carries no unit information. */
  assumedWeightUnit: ImportWeightUnit;
  /** Reference time for the future-date check. */
  now: Date;
}

export function parseWorkoutImport(
  text: string,
  options: WorkoutImportOptions
): WorkoutImportResult {
  try {
    return runImport(text, options);
  } catch {
    return { ok: false, failure: 'unknownFormat' };
  }
}

function runImport(text: string, options: WorkoutImportOptions): WorkoutImportResult {
  if (typeof text !== 'string') {
    return { ok: false, failure: 'unknownFormat' };
  }

  if (text.trim() === '') {
    return { ok: false, failure: 'empty' };
  }

  const table = parseCsvTable(text);
  if (table.records.length === 0) {
    return { ok: false, failure: 'empty' };
  }

  const header = table.records[0].cells;
  const source = detectSource(header);
  if (source === null) {
    return { ok: false, failure: 'unknownFormat' };
  }

  const dataRecords = table.records.slice(1);
  if (dataRecords.length === 0) {
    return { ok: false, failure: 'noRows' };
  }

  const map = buildColumnMap(header);
  const ctx = buildMappingContext(source, map, options.assumedWeightUnit === 'lbs' ? 'lbs' : 'kg');
  const now =
    options.now instanceof Date && !Number.isNaN(options.now.getTime()) ? options.now : new Date();
  const collector: Collector = { source, now, ctx, sessions: new Map(), skipped: [] };

  for (const record of dataRecords) {
    collectRow(collector, mapRow(record.cells, record.line, ctx));
  }

  const weightColumns = ctx.weight;
  const weightUnitStated =
    weightColumns.bare === null ||
    weightColumns.kg !== null ||
    weightColumns.lbs !== null ||
    weightColumns.unit !== null;

  return {
    ok: true,
    source,
    weightUnitStated,
    sessions: finishSessions(collector),
    skipped: collector.skipped,
  };
}

interface BlockDraft {
  name: string;
  category: string | null;
  supersetKey: string | null;
  exerciseNotes: Set<string>;
  setNotes: Set<string>;
  sets: ImportedSet[];
}

interface SessionDraft {
  key: string;
  order: number;
  rawStart: string;
  name: string;
  day: string;
  startMinutes: number | null;
  durationSeconds: number | null;
  notes: Set<string>;
  blocks: Map<string, BlockDraft>;
  cardio: ImportedCardio[];
}

interface Collector {
  source: WorkoutImportSource;
  now: Date;
  ctx: MappingContext;
  sessions: Map<string, SessionDraft>;
  skipped: SkippedRow[];
}

function collectRow(collector: Collector, draft: RowDraft): void {
  if (draft.role === 'ignore') {
    return;
  }

  const parsed = parseImportDate(draft.startRaw, collector.now);
  if (parsed.kind !== 'ok') {
    collector.skipped.push({ line: draft.line, reason: parsed.kind });
    return;
  }

  if (draft.exerciseName === '') {
    collector.skipped.push({ line: draft.line, reason: 'noExercise' });
    return;
  }

  if (draft.role === 'note') {
    const session = sessionFor(collector, draft, parsed);
    addSessionMeta(session, draft);
    addExerciseNote(blockFor(session, draft), draft.exerciseNote);
    return;
  }

  if (draft.fault) {
    collector.skipped.push({ line: draft.line, reason: 'outOfRange' });
    return;
  }

  const weight = draft.weightKg ?? 0;
  const reps = draft.reps ?? 0;
  const seconds = draft.durationSeconds ?? 0;
  const distance = draft.distanceM ?? 0;
  if (weight <= 0 && reps <= 0 && seconds <= 0 && distance <= 0) {
    collector.skipped.push({ line: draft.line, reason: 'nothingMeasured' });
    return;
  }

  const session = sessionFor(collector, draft, parsed);
  addSessionMeta(session, draft);

  const activity = cardioActivityFor(draft.exerciseName);
  if (activity !== null && distance > 0 && weight <= 0 && reps <= 0) {
    session.cardio.push({
      name: draft.exerciseName,
      activity,
      distanceM: distance,
      durationSeconds: draft.durationSeconds,
      notes: joinNotes([draft.exerciseNote, draft.setNote]),
    });
    return;
  }

  const block = blockFor(session, draft);
  addExerciseNote(block, draft.exerciseNote);
  if (draft.setNote !== null) {
    block.setNotes.add(draft.setNote);
  }

  block.sets.push({
    setType: draft.setType,
    reps,
    weightKg: weight,
    rpe: draft.rpe,
    durationSeconds: draft.durationSeconds,
    distanceM: draft.distanceM,
  });
}

function sessionFor(
  collector: Collector,
  draft: RowDraft,
  parsed: { day: string; startMinutes: number | null }
): SessionDraft {
  const fitNotes = collector.source === 'fitnotes' || collector.source === 'fitnotes2';
  // FitNotes has one session per calendar day and no start time.
  const key = fitNotes
    ? `day|${parsed.day}`
    : `${draft.startRaw.trim()}\u001f${draft.workoutName}\u001f${draft.sessionTag}`;

  const existing = collector.sessions.get(key);
  if (existing) {
    return existing;
  }

  const created: SessionDraft = {
    key,
    order: collector.sessions.size,
    rawStart: draft.startRaw,
    name: fitNotes ? '' : draft.workoutName,
    day: parsed.day,
    startMinutes: fitNotes ? null : parsed.startMinutes,
    durationSeconds: null,
    notes: new Set(),
    blocks: new Map(),
    cardio: [],
  };
  collector.sessions.set(key, created);
  return created;
}

function addSessionMeta(session: SessionDraft, draft: RowDraft): void {
  if (draft.sessionNotes !== null) {
    session.notes.add(draft.sessionNotes);
  }

  const duration = draft.sessionDurationSeconds;
  if (
    session.durationSeconds === null &&
    duration !== null &&
    duration > 0 &&
    duration <= MAX_IMPORT_SET_SECONDS
  ) {
    session.durationSeconds = duration;
  }
}

function blockFor(session: SessionDraft, draft: RowDraft): BlockDraft {
  const existing = session.blocks.get(draft.exerciseName);
  if (existing) {
    if (existing.category === null) {
      existing.category = draft.category;
    }

    if (existing.supersetKey === null) {
      existing.supersetKey = draft.supersetKey;
    }

    return existing;
  }

  const created: BlockDraft = {
    name: draft.exerciseName,
    category: draft.category,
    supersetKey: draft.supersetKey,
    exerciseNotes: new Set(),
    setNotes: new Set(),
    sets: [],
  };
  session.blocks.set(draft.exerciseName, created);
  return created;
}

function addExerciseNote(block: BlockDraft, note: string | null): void {
  if (note !== null) {
    block.exerciseNotes.add(note);
  }
}

function finishSessions(collector: Collector): ImportedSession[] {
  const kept: SessionDraft[] = [];
  for (const session of collector.sessions.values()) {
    for (const [name, block] of [...session.blocks]) {
      if (block.sets.length === 0) {
        session.blocks.delete(name);
      }
    }

    if (session.blocks.size > 0 || session.cardio.length > 0) {
      kept.push(session);
    }
  }

  kept.sort(
    (a, b) =>
      compareText(a.day, b.day) ||
      (a.startMinutes ?? -1) - (b.startMinutes ?? -1) ||
      a.order - b.order
  );

  const keyCounts = new Map<string, number>();
  return kept.map((session) => {
    const base = buildImportKey(collector.source, session.rawStart, session.name);
    const count = (keyCounts.get(base) ?? 0) + 1;
    keyCounts.set(base, count);
    return toImportedSession(session, collector.source, count === 1 ? base : `${base}-${count}`);
  });
}

function toImportedSession(
  session: SessionDraft,
  source: WorkoutImportSource,
  importKey: string
): ImportedSession {
  const exercises: ImportedExerciseBlock[] = [...session.blocks.values()].map((block) => ({
    name: block.name,
    category: block.category,
    notes: joinNotes([...block.exerciseNotes, ...block.setNotes]),
    supersetKey: block.supersetKey,
    sets: block.sets,
  }));

  return {
    importKey,
    source,
    name: session.name,
    day: session.day,
    startMinutes: session.startMinutes,
    durationSeconds: session.durationSeconds,
    notes: joinNotes(session.notes),
    exercises,
    cardio: session.cardio,
  };
}

/** Distinct, non-empty notes joined with line breaks, or null. */
function joinNotes(notes: Iterable<string | null>): string | null {
  const distinct = new Set<string>();
  for (const note of notes) {
    if (note !== null && note.trim() !== '') {
      distinct.add(note.trim());
    }
  }

  return distinct.size === 0 ? null : [...distinct].join('\n');
}

function compareText(a: string, b: string): number {
  if (a === b) {
    return 0;
  }

  return a < b ? -1 : 1;
}
