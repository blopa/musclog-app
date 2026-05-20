import { readFileSync } from 'fs';
import { join } from 'path';

import type { MotionSample } from '@/utils/repAnalysis';
import { analyzeRecordedReps } from '@/utils/repAnalysis';

function loadRepsJson(fileName: string = 'slow_reps.json'): MotionSample[] {
  const filePath = join(__dirname, `../../training-data/recordings/${fileName}`);
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

  it('counts 10 reps in pushups.json', () => {
    const samples = loadRepsJson('pushups.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it('counts 7 reps in slow_fast_mixed.json', () => {
    const samples = loadRepsJson('slow_fast_mixed.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(7);
  });

  it('counts 8 reps in slow_fast_mixed_2.json', () => {
    const samples = loadRepsJson('slow_fast_mixed_2.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(8);
  });

  it('counts 8 reps in slow_fast_mixed_3.json', () => {
    const samples = loadRepsJson('slow_fast_mixed_3.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(8);
  });

  it('counts 5 reps in fast_paced.json', () => {
    const samples = loadRepsJson('fast_paced.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(5);
  });

  it('counts 5 reps in standing_shoulder_barbell_press.json', () => {
    const samples = loadRepsJson('standing_shoulder_barbell_press.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(5);
  });

  it('counts 13 reps in barbell_bicep_curls.json', () => {
    const samples = loadRepsJson('barbell_bicep_curls.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(13);
  });

  it('counts 13 reps in cable_lateral_raises.json', () => {
    const samples = loadRepsJson('cable_lateral_raises.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(13);
  });

  it('counts 13 reps in bench_press.json', () => {
    const samples = loadRepsJson('bench_press.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(13);
  });

  it.skip('counts 10 reps in barbell_back_squat.json', () => {
    const samples = loadRepsJson('barbell_back_squat.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it('counts 10 reps in deadlift.json', () => {
    const samples = loadRepsJson('deadlift.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it.skip('counts 10 reps in legpress.json', () => {
    const samples = loadRepsJson('legpress.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it.skip('counts 10 reps in chest_supported_row.json', () => {
    const samples = loadRepsJson('chest_supported_row.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it('counts 10 reps in machine_calf_raises.json', () => {
    const samples = loadRepsJson('machine_calf_raises.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
  });

  it('counts 10 reps in machine_bench_press.json', () => {
    const samples = loadRepsJson('machine_bench_press.json');
    const result = analyzeRecordedReps(samples);
    expect(result.repCount).toBe(10);
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
