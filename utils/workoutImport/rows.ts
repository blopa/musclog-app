/**
 * Maps one CSV record of a known export to a row draft: strings trimmed, units
 * converted to kg and metres, numeric sanity checked. Session grouping and
 * skipping happen in sessions.ts.
 */
import type { CardioActivity } from '@/utils/cardioEnergy';

import { parseDateText } from './parseDate';
import {
  distanceUnitFactor,
  foldUnitText,
  LB_TO_KG,
  MAX_IMPORT_DISTANCE_M,
  MAX_IMPORT_REPS,
  MAX_IMPORT_SET_SECONDS,
  MAX_IMPORT_WEIGHT_KG,
  parseImportNumber,
  parseImportSeconds,
  parseRpe,
  weightUnitFromText,
} from './parseNumber';
import type { ColumnMap, DistanceColumn, WeightColumns } from './sources';
import { cellAt, cellAtIndex, colOf, resolveDistanceColumn, resolveWeightColumns } from './sources';
import type { ImportedSetType, ImportWeightUnit, WorkoutImportSource } from './types';

export interface RowDraft {
  line: number;
  /** 'ignore' rows (Strong rest timers) vanish without a skip record. */
  role: 'ignore' | 'set' | 'note';
  startRaw: string;
  workoutName: string;
  /** Strong `Workout #`; keeps two workouts with the same name and day apart. */
  sessionTag: string;
  sessionNotes: string | null;
  sessionDurationSeconds: number | null;
  exerciseName: string;
  category: string | null;
  exerciseNote: string | null;
  setNote: string | null;
  supersetKey: string | null;
  setType: ImportedSetType;
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  distanceM: number | null;
  durationSeconds: number | null;
  /** A value was negative or over a product limit: the row is a broken cell. */
  fault: boolean;
}

export interface MappingContext {
  source: WorkoutImportSource;
  map: ColumnMap;
  assumedWeightUnit: ImportWeightUnit;
  weight: WeightColumns;
  distance: DistanceColumn | null;
  distanceUnitIndex: number | null;
}

export function buildMappingContext(
  source: WorkoutImportSource,
  map: ColumnMap,
  assumedWeightUnit: ImportWeightUnit
): MappingContext {
  return {
    source,
    map,
    assumedWeightUnit,
    weight: resolveWeightColumns(map),
    distance: resolveDistanceColumn(map),
    distanceUnitIndex: colOf(map, ['distance unit', 'distance units']),
  };
}

export function emptyDraft(line: number): RowDraft {
  return {
    line,
    role: 'set',
    startRaw: '',
    workoutName: '',
    sessionTag: '',
    sessionNotes: null,
    sessionDurationSeconds: null,
    exerciseName: '',
    category: null,
    exerciseNote: null,
    setNote: null,
    supersetKey: null,
    setType: 'normal',
    weightKg: null,
    reps: null,
    rpe: null,
    distanceM: null,
    durationSeconds: null,
    fault: false,
  };
}

export function mapRow(cells: readonly string[], line: number, ctx: MappingContext): RowDraft {
  switch (ctx.source) {
    case 'strong':
      return mapStrong(cells, line, ctx);
    case 'hevy':
      return mapHevy(cells, line, ctx);
    case 'fitnotes':
      return mapFitNotes(cells, line, ctx, null);
    case 'fitnotes2':
      return mapFitNotes(cells, line, ctx, 'kind');
  }
}

/**
 * Cardio is a walk or run by name, matched on whole words. A walk word wins
 * over a run word; `treadmill` alone is a run.
 */
export function cardioActivityFor(name: string): CardioActivity | null {
  const words = new Set(foldUnitText(name).split(' '));
  if (STRENGTH_WALK_WORDS.some((word) => words.has(word))) {
    return null;
  }

  if (WALK_WORDS.some((word) => words.has(word))) {
    return 'walk';
  }

  if (RUN_WORDS.some((word) => words.has(word))) {
    return 'run';
  }

  return null;
}

/** A walking lunge or a farmer's walk logged by distance is lifting, not a walk. */
const STRENGTH_WALK_WORDS = [
  'lunge',
  'lunges',
  'farmer',
  'farmers',
  'carry',
  'carries',
  'sled',
  'yoke',
  'bear',
  'crab',
  'duck',
  'plank',
];

const WALK_WORDS = [
  'walk',
  'walking',
  'hike',
  'hiking',
  'caminhada',
  'caminar',
  'caminata',
  'wandelen',
];
const RUN_WORDS = [
  'run',
  'running',
  'jog',
  'jogging',
  'treadmill',
  'corrida',
  'correr',
  'hardlopen',
];

function mapStrong(cells: readonly string[], line: number, ctx: MappingContext): RowDraft {
  const get = (key: string): string => cellAt(cells, ctx.map, key);
  const order = get('set order').trim();
  const orderKey = foldUnitText(order);

  if (orderKey === 'rest timer') {
    return { ...emptyDraft(line), role: 'ignore' };
  }

  const isNote = orderKey === 'note';
  const notes = textOrNull(get('notes'));
  return {
    ...emptyDraft(line),
    ...readMeasures(cells, ctx, ['seconds']),
    role: isNote ? 'note' : 'set',
    startRaw: get('date'),
    workoutName: get('workout name').trim(),
    sessionTag: get('workout no').trim(),
    sessionNotes: textOrNull(get('workout notes')),
    sessionDurationSeconds:
      parseImportSeconds(get('duration')) ??
      parseImportSeconds(get('duration sec')) ??
      parseImportSeconds(get('workout duration')),
    exerciseName: get('exercise name').trim(),
    exerciseNote: isNote ? notes : null,
    setNote: isNote ? null : notes,
    setType: isNote ? 'normal' : strongSetType(order),
  };
}

function mapHevy(cells: readonly string[], line: number, ctx: MappingContext): RowDraft {
  const get = (key: string): string => cellAt(cells, ctx.map, key);
  const start = get('start time');

  return {
    ...emptyDraft(line),
    ...readMeasures(cells, ctx, ['duration seconds']),
    role: 'set',
    startRaw: start,
    workoutName: get('title').trim(),
    sessionNotes: textOrNull(decodeLineBreaks(get('description'))),
    sessionDurationSeconds: hevyDuration(start, get('end time')),
    exerciseName: get('exercise title').trim(),
    exerciseNote: textOrNull(decodeLineBreaks(get('exercise notes'))),
    supersetKey: textOrNull(get('superset id')),
    setType: hevySetType(get('set type')),
  };
}

function mapFitNotes(
  cells: readonly string[],
  line: number,
  ctx: MappingContext,
  kindKey: 'kind' | null
): RowDraft {
  const get = (key: string): string => cellAt(cells, ctx.map, key);
  const kind = kindKey === null ? '' : get(kindKey);
  const setNote = textOrNull(get(kindKey === null ? 'comment' : 'notes'));

  return {
    ...emptyDraft(line),
    ...readMeasures(cells, ctx, ['time']),
    role: 'set',
    startRaw: get('date'),
    exerciseName: get('exercise').trim(),
    category: textOrNull(get('category')),
    setNote,
    setType: foldUnitText(kind).includes('warm') ? 'warmup' : 'normal',
  };
}

interface Measures {
  weightKg: number | null;
  reps: number | null;
  rpe: number | null;
  distanceM: number | null;
  durationSeconds: number | null;
  fault: boolean;
}

/**
 * Weight, reps, RPE, distance and set time. Zero where the source said zero
 * is kept as zero for reps and weight; a zero time or distance is absent.
 */
function readMeasures(
  cells: readonly string[],
  ctx: MappingContext,
  secondsKeys: readonly string[]
): Measures {
  const weight = readWeightKg(cells, ctx);
  const reps = readReps(cellAt(cells, ctx.map, 'reps'));
  const seconds = readSeconds(cells, ctx, secondsKeys);
  const distance = readDistanceM(cells, ctx);

  return {
    weightKg: weight.value,
    reps: reps.value,
    rpe: parseRpe(cellAt(cells, ctx.map, 'rpe')),
    distanceM: distance.value,
    durationSeconds: seconds.value,
    fault: weight.fault || reps.fault || seconds.fault || distance.fault,
  };
}

interface Reading {
  value: number | null;
  fault: boolean;
}

const ABSENT: Reading = { value: null, fault: false };
const FAULT: Reading = { value: null, fault: true };

function readWeightKg(cells: readonly string[], ctx: MappingContext): Reading {
  const columns = ctx.weight;
  const candidates: [number, 'kg' | 'lbs' | 'row'][] = [];
  if (columns.kg !== null) {
    candidates.push([columns.kg, 'kg']);
  }

  if (columns.lbs !== null) {
    candidates.push([columns.lbs, 'lbs']);
  }

  if (columns.bare !== null) {
    candidates.push([columns.bare, 'row']);
  }

  for (const [index, kind] of candidates) {
    const amount = parseImportNumber(cellAtIndex(cells, index));
    if (amount === null) {
      continue;
    }

    const unit =
      kind === 'row'
        ? (weightUnitFromText(cellAtIndex(cells, columns.unit)) ?? ctx.assumedWeightUnit)
        : kind;
    const kg = unit === 'lbs' ? amount * LB_TO_KG : amount;
    if (amount < 0 || kg > MAX_IMPORT_WEIGHT_KG) {
      return FAULT;
    }

    return { value: kg, fault: false };
  }

  return ABSENT;
}

function readReps(raw: string): Reading {
  const reps = parseImportNumber(raw);
  if (reps === null) {
    return ABSENT;
  }

  if (reps < 0 || reps > MAX_IMPORT_REPS) {
    return FAULT;
  }

  return { value: Math.round(reps), fault: false };
}

function readSeconds(
  cells: readonly string[],
  ctx: MappingContext,
  secondsKeys: readonly string[]
): Reading {
  const key = secondsKeys.find((candidate) => ctx.map.has(candidate));
  if (key === undefined) {
    return ABSENT;
  }

  const seconds = parseImportSeconds(cellAt(cells, ctx.map, key));
  if (seconds === null) {
    return ABSENT;
  }

  if (seconds < 0 || seconds > MAX_IMPORT_SET_SECONDS) {
    return FAULT;
  }

  return seconds === 0 ? ABSENT : { value: seconds, fault: false };
}

function readDistanceM(cells: readonly string[], ctx: MappingContext): Reading {
  if (ctx.distance === null) {
    return ABSENT;
  }

  const amount = parseImportNumber(cellAtIndex(cells, ctx.distance.index));
  if (amount === null) {
    return ABSENT;
  }

  // A per-row unit beats the header unit; an unknown unit means metres.
  const rowFactor = distanceUnitFactor(cellAtIndex(cells, ctx.distanceUnitIndex));
  const meters = amount * (rowFactor ?? ctx.distance.factor ?? 1);
  if (amount < 0 || meters > MAX_IMPORT_DISTANCE_M) {
    return FAULT;
  }

  return meters === 0 ? ABSENT : { value: meters, fault: false };
}

/** Hevy's workout length is its end minus its start, when both read in the same way. */
function hevyDuration(start: string, end: string): number | null {
  const startParsed = parseDateText(start);
  const endParsed = parseDateText(end);
  if (!startParsed || !endParsed || startParsed.zoned !== endParsed.zoned) {
    return null;
  }

  const seconds = Math.round((endParsed.ms - startParsed.ms) / 1000);
  return seconds > 0 && seconds <= MAX_IMPORT_SET_SECONDS ? seconds : null;
}

function strongSetType(order: string): ImportedSetType {
  switch (order.trim().toUpperCase()) {
    case 'W':
      return 'warmup';
    case 'D':
      return 'drop_set';
    case 'F':
      return 'failure';
    default:
      return 'normal';
  }
}

function hevySetType(raw: string): ImportedSetType {
  const key = foldUnitText(raw);
  if (key === 'warmup' || key === 'warm up') {
    return 'warmup';
  }

  if (key === 'dropset' || key === 'drop set' || key === 'drop') {
    return 'drop_set';
  }

  if (key === 'failure') {
    return 'failure';
  }

  return 'normal';
}

/** Hevy writes line breaks inside notes as the two characters backslash and n. */
function decodeLineBreaks(text: string): string {
  return text.replace(/\\r\\n|\\n/g, '\n');
}

function textOrNull(text: string): string | null {
  const trimmed = text.trim();
  return trimmed === '' ? null : trimmed;
}
