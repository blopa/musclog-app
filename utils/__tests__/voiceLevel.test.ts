import {
  appendWaveformSample,
  createVoiceLevelMeter,
  normalizeVoiceVolume,
  silentWaveform,
  speechBurstLevel,
  WAVEFORM_BAR_COUNT,
} from '@/utils/voiceLevel';

describe('normalizeVoiceVolume', () => {
  it('returns 0 at or below the noise floor', () => {
    expect(normalizeVoiceVolume(-2)).toBe(0);
    expect(normalizeVoiceVolume(0)).toBe(0);
    expect(normalizeVoiceVolume(1)).toBe(0);
  });

  it('returns 0 for NaN and Infinity', () => {
    expect(normalizeVoiceVolume(Number.NaN)).toBe(0);
    expect(normalizeVoiceVolume(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('returns 1 at 10 and above', () => {
    expect(normalizeVoiceVolume(10)).toBe(1);
    expect(normalizeVoiceVolume(14)).toBe(1);
  });

  it('lifts the middle of the range with a square root', () => {
    expect(normalizeVoiceVolume(5.5)).toBeCloseTo(Math.sqrt(0.5), 10);
  });

  it('stays within [0, 1] and never decreases as the input rises', () => {
    let previous = -1;
    for (let value = 1; value <= 10; value += 0.5) {
      const level = normalizeVoiceVolume(value);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe('speechBurstLevel', () => {
  it('returns 0 when the text did not grow after trimming', () => {
    expect(speechBurstLevel('hello', 'hello')).toBe(0);
    expect(speechBurstLevel('hello there', 'hello')).toBe(0);
    expect(speechBurstLevel('hi', 'hi  ')).toBe(0);
  });

  it('scales with the characters added for small growth', () => {
    expect(speechBurstLevel('', 'hi')).toBeCloseTo(0.55, 10);
  });

  it('caps at 1 for long growth', () => {
    expect(speechBurstLevel('', 'a'.repeat(40))).toBe(1);
  });
});

describe('createVoiceLevelMeter', () => {
  it('starts at 0', () => {
    const meter = createVoiceLevelMeter();
    expect(meter.sample()).toBe(0);
  });

  it('samples the peak pushed since the last sample', () => {
    const meter = createVoiceLevelMeter();
    meter.push(0.3);
    meter.push(0.8);
    meter.push(0.5);
    expect(meter.sample()).toBe(0.8);
  });

  it('decays by 0.6 per sample without new pushes and reaches exactly 0 below 0.02', () => {
    const meter = createVoiceLevelMeter();
    meter.push(0.8);
    expect(meter.sample()).toBe(0.8);
    expect(meter.sample()).toBeCloseTo(0.48, 10);
    expect(meter.sample()).toBeCloseTo(0.288, 10);

    let level = 1;
    for (let i = 0; i < 20 && level !== 0; i += 1) {
      level = meter.sample();
    }
    expect(level).toBe(0);
  });

  it('clamps pushed values to [0, 1]', () => {
    const high = createVoiceLevelMeter();
    high.push(3);
    expect(high.sample()).toBe(1);

    const low = createVoiceLevelMeter();
    low.push(-1);
    expect(low.sample()).toBe(0);

    const nan = createVoiceLevelMeter();
    nan.push(Number.NaN);
    expect(nan.sample()).toBe(0);
  });

  it('reset makes the next sample 0 even after pushes', () => {
    const meter = createVoiceLevelMeter();
    meter.push(0.9);
    meter.sample();
    meter.push(0.7);
    meter.reset();
    expect(meter.sample()).toBe(0);
  });

  it('keeps each meter independent of another', () => {
    const first = createVoiceLevelMeter();
    const second = createVoiceLevelMeter();
    first.push(0.6);
    expect(second.sample()).toBe(0);
    expect(first.sample()).toBe(0.6);
  });
});

describe('silentWaveform', () => {
  it('defaults to WAVEFORM_BAR_COUNT zeros', () => {
    const bars = silentWaveform();
    expect(bars).toHaveLength(WAVEFORM_BAR_COUNT);
    expect(bars.every((bar) => bar === 0)).toBe(true);
  });

  it('returns the requested number of zeros', () => {
    expect(silentWaveform(4)).toEqual([0, 0, 0, 0]);
  });

  it('returns an empty array for a negative size', () => {
    expect(silentWaveform(-3)).toEqual([]);
  });
});

describe('appendWaveformSample', () => {
  it('drops the oldest bar and appends the new level once full', () => {
    expect(appendWaveformSample([1, 2, 3], 0.5, 3)).toEqual([2, 3, 0.5]);
  });

  it('keeps values above 1 already in the bars as given', () => {
    expect(appendWaveformSample([2, 3], 0.4, 2)).toEqual([3, 0.4]);
  });

  it('grows a shorter array by one', () => {
    expect(appendWaveformSample([], 0.25, 3)).toEqual([0.25]);
    expect(appendWaveformSample([0.1], 0.25, 3)).toEqual([0.1, 0.25]);
  });

  it('clamps the new level to [0, 1]', () => {
    expect(appendWaveformSample([], 2)).toEqual([1]);
    expect(appendWaveformSample([], -1)).toEqual([0]);
  });

  it('does not mutate the input array', () => {
    const bars = [1, 2, 3];
    appendWaveformSample(bars, 0.5, 3);
    expect(bars).toEqual([1, 2, 3]);
  });

  it('defaults to WAVEFORM_BAR_COUNT bars', () => {
    const full = silentWaveform();
    expect(appendWaveformSample(full, 0.5)).toHaveLength(WAVEFORM_BAR_COUNT);
  });
});
