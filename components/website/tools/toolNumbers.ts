/**
 * A number typed into a tool's field, as the visitor wrote it: "62.5" or "62,5", with stray
 * spaces. `null` for an empty field or anything that is not one number, so a form can tell
 * "nothing entered yet" from "zero". Negative values are rejected: no tool takes one.
 */
export function parseToolNumber(text: string | null | undefined): number | null {
  const compact = (text ?? '').replace(/\s/g, '');
  if (!/^\d+([.,]\d+)?$|^[.,]\d+$/.test(compact)) {
    return null;
  }

  const value = Number(compact.replace(',', '.'));
  return Number.isFinite(value) ? value : null;
}

/** True when the value is a whole number inside the (inclusive) range. */
export function isWholeInRange(value: number | null, min: number, max: number): value is number {
  return value !== null && Number.isInteger(value) && value >= min && value <= max;
}

/** True when the value is a finite number inside the (inclusive) range. */
export function isInRange(value: number | null, min: number, max: number): value is number {
  return value !== null && Number.isFinite(value) && value >= min && value <= max;
}
