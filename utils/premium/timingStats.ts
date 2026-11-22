export type TimingSummary = {
  n: number;
  minMs: number | null;
  medianMs: number | null;
  p95Ms: number | null;
  maxMs: number | null;
  meanMs: number | null;
};

/** Timing summary of a sample list; p95 is nearest-rank. Empty input gives nulls, never NaN. */
export function summarizeTimings(samplesMs: number[]): TimingSummary {
  const sorted = samplesMs.filter((s) => Number.isFinite(s)).sort((a, b) => a - b);
  const n = sorted.length;

  if (n === 0) {
    return { n: 0, minMs: null, medianMs: null, p95Ms: null, maxMs: null, meanMs: null };
  }

  const mid = Math.floor(n / 2);
  const medianMs = n % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const p95Index = Math.min(n - 1, Math.max(0, Math.ceil(0.95 * n) - 1));
  const sum = sorted.reduce((acc, s) => acc + s, 0);

  return {
    n,
    minMs: sorted[0],
    medianMs,
    p95Ms: sorted[p95Index],
    maxMs: sorted[n - 1],
    meanMs: sum / n,
  };
}
