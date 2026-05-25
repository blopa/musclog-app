jest.mock('../repCountingModel', () => ({
  classifySegment: jest.fn(() => [0.1, 0.9]),
}));

import { segmentAndScore } from '../segmentAndScorePipeline';

function buildSamples() {
  return Array.from({ length: 300 }, (_, i) => {
    const timestamp = i * 10;
    const phase = (i / 25) * Math.PI * 2;
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
