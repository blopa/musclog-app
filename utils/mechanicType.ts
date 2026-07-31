/**
 * Canonical exercise mechanic types, shared by everything that has to agree on
 * them: the one-hot feature block in `segmentAndScorePipeline.ts` and the
 * per-mechanic model dispatch in `repCountingModel/index.ts`.
 *
 * This list and `normalizeMechanicType` mirror `MECHANIC_TYPES` /
 * `normalize_mechanic_type` in `training-data/train.py`. They must stay in
 * sync: the list order fixes the position of the `mechanic_*` columns in the
 * feature vector, and the normalization rule decides both which one-hot column
 * is set and which model classifies the segment. Those two decisions have to
 * be made the same way at training and at inference time, so they are made
 * once, here.
 */
export const MECHANIC_TYPES = [
  'cardio',
  'compound',
  'isolation',
  'mobility',
  'other',
  'plyometric',
  'stretching',
  'unknown',
] as const;

export type MechanicType = (typeof MECHANIC_TYPES)[number];

const MECHANIC_TYPE_SET = new Set<string>(MECHANIC_TYPES);

/**
 * Maps any raw `mechanicType` value onto the canonical list. Missing, blank,
 * differently-cased, padded and unrecognised values all collapse to
 * `'unknown'` — the same rule `train.py` applies when building the training
 * set, so a segment's `mechanic_unknown` one-hot and its chosen model always
 * refer to the same bucket.
 */
export function normalizeMechanicType(value: null | string | undefined): MechanicType {
  const key = (value ?? '').trim().toLowerCase();
  return MECHANIC_TYPE_SET.has(key) ? (key as MechanicType) : 'unknown';
}
