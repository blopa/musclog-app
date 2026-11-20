import { summarizeTimings } from '@/utils/premium/timingStats';

describe('summarizeTimings', () => {
  it('returns nulls for no samples', () => {
    expect(summarizeTimings([])).toEqual({
      n: 0,
      minMs: null,
      medianMs: null,
      p95Ms: null,
      maxMs: null,
      meanMs: null,
    });
  });

  it('handles one sample', () => {
    expect(summarizeTimings([5])).toEqual({
      n: 1,
      minMs: 5,
      medianMs: 5,
      p95Ms: 5,
      maxMs: 5,
      meanMs: 5,
    });
  });

  it('uses nearest-rank p95 and an even median, without mutating the input', () => {
    const samples = Array.from({ length: 20 }, (_, i) => 20 - i);
    const copy = [...samples];
    const s = summarizeTimings(samples);

    expect(samples).toEqual(copy);
    expect(s.p95Ms).toBe(19);
    expect(s.medianMs).toBe(10.5);
    expect(s.minMs).toBe(1);
    expect(s.maxMs).toBe(20);
    expect(s.meanMs).toBe(10.5);
  });

  it('ignores non-finite samples', () => {
    expect(summarizeTimings([1, NaN, Infinity, 3]).n).toBe(2);
  });
});
