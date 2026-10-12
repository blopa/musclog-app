import type { SetAdjustment, StartSetAdjustment } from './setAdjustment';

export type SetPrescription = {
  established?: boolean;
  plan: { weightKg: number; reps: number };
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
    return value;
  } catch {
    return null;
  }
}

export function serializeSetPrescription(value: SetPrescription): string {
  return JSON.stringify(value);
}
