import type { SetAdjustment, StartSetAdjustment } from './setAdjustment';

export type SetPrescription = {
  established?: boolean;
  /** Original working-set count, retained when a mid-session swap splits the block. */
  workingSetCount?: number;
  plan: { weightKg: number; reps: number };
  /** The reps in reserve the set carried before a Weekly Review lighter week overwrote them. */
  planRepsInReserve?: number;
  /** Working sets a Weekly Review lighter week removed from this block, so undo can bring them back. */
  droppedSetIds?: string[];
  recommendation: { weightKg: number; reps: number };
  explanation?: StartSetAdjustment;
  intraAdjustment?: SetAdjustment;
  previous?: { weightKg: number; reps: number };
  override?: 'plan' | 'manual';
};

export function parseSetPrescription(raw?: string | null): SetPrescription | null {
  if (!raw) {
    return null;
  }

  try {
    const value = JSON.parse(raw) as SetPrescription;
    if (
      ![
        value.plan?.weightKg,
        value.plan?.reps,
        value.recommendation?.weightKg,
        value.recommendation?.reps,
      ].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)
    ) {
      return null;
    }

    if (
      value.workingSetCount !== undefined &&
      (!Number.isInteger(value.workingSetCount) || value.workingSetCount <= 0)
    ) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
}

export function serializeSetPrescription(value: SetPrescription): string {
  return JSON.stringify(value);
}
