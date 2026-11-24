// Several independent readings of one extraction (a nutrition label, past workouts, a food log),
// combined field by field, with the fields they disagreed on listed so only those are asked again.
// Pure and relative-import-only. Used from the High thinking level up (`extractionSamples`).

import { median } from 'simple-statistics';

export type CombinedExtraction = {
  value: unknown;
  /** JSON paths (`pastWorkouts[0].sets[2].reps`) where the readings did not agree. */
  disputed: string[];
};

/** Two readings of a number agree within 5%, or within half a unit for small values. */
function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(0.5, 0.05 * Math.max(Math.abs(a), Math.abs(b)));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function majorityOf(count: number): number {
  return Math.floor(count / 2) + 1;
}

function childPath(path: string, key: string | number): string {
  if (typeof key === 'number') {
    return `${path}[${key}]`;
  }

  return path ? `${path}.${key}` : key;
}

function combineNumbers(values: number[], path: string): CombinedExtraction {
  const most = Math.max(
    ...values.map((value) => values.filter((other) => closeEnough(value, other)).length)
  );
  const middle = median(values);
  const integers = values.every((value) => Number.isInteger(value));

  return {
    value: integers ? Math.round(middle) : middle,
    disputed: most >= majorityOf(values.length) ? [] : [path],
  };
}

/** Strings, booleans, nulls and mixed kinds: the reading most samples share, else the first. */
function combineByVote(values: unknown[], path: string): CombinedExtraction {
  const keyOf = (value: unknown) =>
    typeof value === 'string' ? `s:${normalizeText(value)}` : `j:${JSON.stringify(value)}`;
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(keyOf(value), (counts.get(keyOf(value)) ?? 0) + 1);
  }

  let winner = values[0];
  let best = 0;
  for (const value of values) {
    const count = counts.get(keyOf(value)) ?? 0;
    if (count > best) {
      best = count;
      winner = value;
    }
  }

  return { value: winner, disputed: best >= majorityOf(values.length) ? [] : [path] };
}

function combineArrays(values: unknown[][], path: string): CombinedExtraction {
  const lengthCounts = new Map<number, number>();
  for (const value of values) {
    lengthCounts.set(value.length, (lengthCounts.get(value.length) ?? 0) + 1);
  }

  let length = values[0].length;
  for (const value of values) {
    if ((lengthCounts.get(value.length) ?? 0) > (lengthCounts.get(length) ?? 0)) {
      length = value.length;
    }
  }

  const agreeing = values.filter((value) => value.length === length);
  const disputed = agreeing.length === values.length ? [] : [path];
  const combined: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const item = combineAt(
      agreeing.map((value) => value[index]),
      childPath(path, index)
    );
    combined.push(item.value);
    disputed.push(...item.disputed);
  }

  return { value: combined, disputed };
}

function combineObjects(values: Record<string, unknown>[], path: string): CombinedExtraction {
  const keys: string[] = [];
  for (const value of values) {
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  const combined: Record<string, unknown> = {};
  const disputed: string[] = [];
  for (const key of keys) {
    const present = values.filter((value) => key in value && value[key] !== undefined);
    if (present.length < values.length) {
      disputed.push(childPath(path, key));
    }

    if (present.length < majorityOf(values.length)) {
      continue;
    }

    const item = combineAt(
      present.map((value) => value[key]),
      childPath(path, key)
    );
    combined[key] = item.value;
    disputed.push(...item.disputed.filter((entry) => !disputed.includes(entry)));
  }

  return { value: combined, disputed };
}

function combineAt(values: unknown[], path: string): CombinedExtraction {
  if (values.length === 1) {
    return { value: values[0], disputed: [] };
  }

  if (values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return combineNumbers(values as number[], path);
  }

  if (values.every(Array.isArray)) {
    return combineArrays(values as unknown[][], path);
  }

  if (values.every(isPlainObject)) {
    return combineObjects(values as Record<string, unknown>[], path);
  }

  return combineByVote(values, path);
}

/**
 * Combines readings of one extraction. Numbers that agree (within `closeEnough`) take their median
 * (rounded when every reading was a whole number); text, booleans and anything else take the
 * reading a strict majority shares, else the first sample's; lists of the same length are combined
 * item by item, otherwise the length most readings share wins (the first sample's on a tie); an
 * object keeps a key a strict majority of readings has. With two readings any disagreement is
 * disputed; with three, only a field no two of them agree on. One reading is returned as it is.
 */
export function combineExtractions(samples: unknown[]): CombinedExtraction {
  if (samples.length === 0) {
    return { value: null, disputed: [] };
  }

  return combineAt(samples, '');
}
