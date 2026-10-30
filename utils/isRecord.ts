/** A plain JSON-style object: not null, not an array. The guard for untrusted parsed data. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
