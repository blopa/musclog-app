jest.mock('../repCountingModel', () => ({
  classifySegment: jest.fn(() => [0.1, 0.9]),
}));

import { segmentAndScore } from '../segmentAndScorePipeline';

// 100 Hz sampling, one rep every 60 samples = 600 ms/rep (1.67 Hz). The period
// has to clear MIN_SEG_DURATION_MS (300 ms) and sit inside the pipeline's
// 0.1–3.0 Hz band-pass, or over-segmentation discards every candidate and
// segmentAndScore returns "No segments found".
const SAMPLE_INTERVAL_MS = 10;
const SAMPLES_PER_REP = 60;

function buildSamples() {
  return Array.from({ length: 300 }, (_, i) => {
    const timestamp = i * SAMPLE_INTERVAL_MS;
    const phase = (i / SAMPLES_PER_REP) * Math.PI * 2;
    const signal = Math.sin(phase);

    return {
      timestamp,
      accel: { x: signal, y: 0, z: 0 },
      gyro: { x: signal, y: 0, z: 0 },
      angle: { x: signal, y: 0, z: 0 },
    };
  });
}

describe('segmentAndScore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips chart payload generation when disabled', () => {
    const result = segmentAndScore(buildSamples(), {}, false);

    expect(result.error).toBeUndefined();
    expect(result.predictedReps).toBeGreaterThan(0);
    expect(result.chartPayload).toBeUndefined();
  });

  it('generates chart payload when enabled', () => {
    const result = segmentAndScore(buildSamples(), {}, true);

    expect(result.error).toBeUndefined();
    expect(result.predictedReps).toBeGreaterThan(0);
    expect(result.chartPayload).toBeDefined();
    expect(result.chartPayload?.signal.length).toBeGreaterThan(0);
  });
});
