// Several independent readings of one extraction (a nutrition label, past workouts, a food log),
// combined field by field, with the fields they disagreed on listed so only those are asked again.
// An optional arbiter (a fresh reading of the whole input) is threaded through the SAME recursion,
// aligned the way the readings were (by key, by identity or by index), and settles only the nodes
// the readings disputed.
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

function combineNumbers(values: number[], path: string, arbiter: unknown): CombinedExtraction {
  const most = Math.max(
    ...values.map((value) => values.filter((other) => closeEnough(value, other)).length)
  );
  const middle = median(values);
  const integers = values.every((value) => Number.isInteger(value));
  const agreed = most >= majorityOf(values.length);

  if (!agreed && arbiter !== undefined) {
    return { value: arbiter, disputed: [path] };
  }

  return { value: integers ? Math.round(middle) : middle, disputed: agreed ? [] : [path] };
}

/** Strings, booleans, nulls and mixed kinds: the reading most samples share, else the first. */
function combineByVote(values: unknown[], path: string, arbiter: unknown): CombinedExtraction {
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

  if (best < majorityOf(values.length)) {
    return { value: arbiter !== undefined ? arbiter : winner, disputed: [path] };
  }

  return { value: winner, disputed: [] };
}

const IDENTITY_KEYS = ['date', 'title', 'name', 'productTitle'] as const;

/** `date|title|name|productTitle` (normalized) of an object item; null when it has none. */
function identityOf(item: unknown): string | null {
  if (!isPlainObject(item)) {
    return null;
  }

  const parts: string[] = [];
  for (const key of IDENTITY_KEYS) {
    const value = item[key];
    if (typeof value === 'string' && value.trim() !== '') {
      parts.push(normalizeText(value));
    }
  }

  return parts.length > 0 ? parts.join('|') : null;
}

/** Items keyed by a unique identity; null when the list is no array or any item lacks/repeats one. */
function keyByIdentity(list: unknown): Map<string, unknown> | null {
  if (!Array.isArray(list)) {
    return null;
  }

  const byIdentity = new Map<string, unknown>();
  for (const item of list) {
    const identity = identityOf(item);
    if (identity === null || byIdentity.has(identity)) {
      return null;
    }

    byIdentity.set(identity, item);
  }

  return byIdentity;
}

/**
 * Lists whose items all carry a unique identity are matched by identity, so readings that list the
 * same entries in another order combine per entry (and the arbiter is looked up the same way).
 * Null when any item lacks one, or repeats one.
 */
function combineByIdentity(
  values: unknown[][],
  path: string,
  arbiter: unknown
): CombinedExtraction | null {
  const readings: Map<string, unknown>[] = [];
  for (const value of values) {
    const byIdentity = keyByIdentity(value);
    if (byIdentity === null) {
      return null;
    }

    readings.push(byIdentity);
  }

  const order: string[] = [];
  for (const byIdentity of readings) {
    for (const identity of byIdentity.keys()) {
      if (!order.includes(identity)) {
        order.push(identity);
      }
    }
  }

  const needed = majorityOf(values.length);
  const kept = order.filter(
    (identity) => readings.filter((byIdentity) => byIdentity.has(identity)).length >= needed
  );
  const identical = order.every((identity) =>
    readings.every((byIdentity) => byIdentity.has(identity))
  );
  const disputed = identical ? [] : [path];
  const arbiterByIdentity = keyByIdentity(arbiter);
  const combined: unknown[] = [];
  kept.forEach((identity, index) => {
    const item = combineAt(
      readings
        .filter((byIdentity) => byIdentity.has(identity))
        .map((byIdentity) => byIdentity.get(identity)),
      childPath(path, index),
      arbiterByIdentity?.get(identity)
    );
    combined.push(item.value);
    disputed.push(...item.disputed);
  });

  return { value: !identical && Array.isArray(arbiter) ? arbiter : combined, disputed };
}

function combineArrays(values: unknown[][], path: string, arbiter: unknown): CombinedExtraction {
  const aligned = combineByIdentity(values, path, arbiter);
  if (aligned) {
    return aligned;
  }

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
  const lengthsAgree = agreeing.length === values.length;
  const disputed = lengthsAgree ? [] : [path];
  const combined: unknown[] = [];
  for (let index = 0; index < length; index++) {
    const item = combineAt(
      agreeing.map((value) => value[index]),
      childPath(path, index),
      Array.isArray(arbiter) ? arbiter[index] : undefined
    );
    combined.push(item.value);
    disputed.push(...item.disputed);
  }

  return { value: !lengthsAgree && Array.isArray(arbiter) ? arbiter : combined, disputed };
}

function combineObjects(
  values: Record<string, unknown>[],
  path: string,
  arbiter: unknown
): CombinedExtraction {
  const keys: string[] = [];
  for (const value of values) {
    for (const key of Object.keys(value)) {
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }
  }

  const arbiterObject = isPlainObject(arbiter) ? arbiter : null;
  const combined: Record<string, unknown> = {};
  const disputed: string[] = [];
  for (const key of keys) {
    const present = values.filter((value) => key in value && value[key] !== undefined);
    const missingSomewhere = present.length < values.length;
    const settled = arbiterObject ? arbiterObject[key] : undefined;
    if (missingSomewhere) {
      disputed.push(childPath(path, key));
    }

    if (present.length < majorityOf(values.length)) {
      if (settled !== undefined) {
        combined[key] = settled;
      }

      continue;
    }

    const item = combineAt(
      present.map((value) => value[key]),
      childPath(path, key),
      settled
    );
    combined[key] = missingSomewhere && settled !== undefined ? settled : item.value;
    disputed.push(...item.disputed.filter((entry) => !disputed.includes(entry)));
  }

  return { value: combined, disputed };
}

/** `arbiter` is the arbiter's value aligned to this node; undefined when it has none here. */
function combineAt(values: unknown[], path: string, arbiter: unknown): CombinedExtraction {
  if (values.length === 1) {
    return { value: values[0], disputed: [] };
  }

  if (values.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    return combineNumbers(values as number[], path, arbiter);
  }

  if (values.every(Array.isArray)) {
    return combineArrays(values as unknown[][], path, arbiter);
  }

  if (values.every(isPlainObject)) {
    return combineObjects(values as Record<string, unknown>[], path, arbiter);
  }

  return combineByVote(values, path, arbiter);
}

/**
 * Combines readings of one extraction. Numbers that agree (within `closeEnough`) take their median
 * (rounded when every reading was a whole number); text, booleans and anything else take the
 * reading a strict majority shares, else the first sample's; lists of the same length are combined
 * item by item, otherwise the length most readings share wins (the first sample's on a tie); an
 * object keeps a key a strict majority of readings has. With two readings any disagreement is
 * disputed; with three, only a field no two of them agree on. One reading is returned as it is.
 *
 * `disputed` always lists what the READINGS disputed. With an `arbiter` (a fresh reading of the
 * whole input), it settles exactly those places: aligned by key, by identity or by index like the
 * readings were, it replaces the combined value where it has one (not undefined; at the root not
 * null) and a place it left out stays as combined. It cannot change what every reading agreed on.
 */
export function combineExtractions(
  samples: unknown[],
  options: { arbiter?: unknown } = {}
): CombinedExtraction {
  if (samples.length === 0) {
    return { value: null, disputed: [] };
  }

  const arbiter = options.arbiter === null ? undefined : options.arbiter;

  return combineAt(samples, '', arbiter);
}
