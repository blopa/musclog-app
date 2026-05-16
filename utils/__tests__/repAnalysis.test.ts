import { readFileSync } from 'fs';
import { join } from 'path';

import { analyzeRecordedReps } from '@/utils/repAnalysis';
import type { MotionSample } from '@/utils/repAnalysis';

function loadRepsJson(fileName: string = 'slow_reps.json'): MotionSample[] {
  const filePath = join(__dirname, `../../data/dev/${fileName}`);
  const raw = JSON.parse(readFileSync(filePath, 'utf-8')) as { samples: MotionSample[] };
  return raw.samples;
}

describe('analyzeRecordedReps', () => {
  it('counts 3 reps in slow_reps.json', () => {
    const samples = loadRepsJson();
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(3);
  });

  it('counts 10 reps in normal_pace.json', () => {
    const samples = loadRepsJson('normal_pace.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it('counts 7 reps in slow_fast_mixed.json', () => {
    const samples = loadRepsJson('slow_fast_mixed.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(7);
  });

  it('returns 0 reps for empty input', () => {
    expect(analyzeRecordedReps([])).toEqual({ repCount: 0, sampleCount: 0, durationMs: 0 });
  });

  it('reports correct sample count and duration', () => {
    const samples = loadRepsJson();
    const result = analyzeRecordedReps(samples);
    expect(result.sampleCount).toBe(samples.length);
    expect(result.durationMs).toBe(samples[samples.length - 1].timestamp - samples[0].timestamp);
  });
});
