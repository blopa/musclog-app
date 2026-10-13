/** Smallest difference in kg that counts as a different load (SQLite floats are not exact). */
export const WEIGHT_EPSILON = 0.01;

/** Whether two loads (kg) are the same load once float noise is ignored. */
export const sameLoad = (a: number, b: number): boolean => Math.abs(a - b) < WEIGHT_EPSILON;
