/**
 * The microphone level behind the hold-to-talk overlay's waveform (`VoiceWaveform`). Pure: the
 * recognizer's events go in through `useHoldToTranscribe`, the bars come out here.
 *
 * On a phone the level is measured: `expo-speech-recognition` sends `volumechange` events, a value
 * from -2 to 10 where anything at or below 0 is inaudible (Android's `onRmsChanged`, iOS's own
 * power reading scaled to the same range). A browser's Web Speech API reports no level at all, so
 * on the web every recognized burst of speech stands in for one (`speechBurstLevel`): the bars
 * show that words are arriving, not how loud they were.
 *
 * The waveform scrolls on its own sample clock (`WAVEFORM_TICK_MS`) rather than per event, because
 * the web's bursts are sparse and a waveform that only moved on events would freeze between them.
 */

/** How often a phone sends a `volumechange` event while a hold listens. */
export const VOICE_LEVEL_INTERVAL_MS = 60;

/** How often the waveform takes a sample and scrolls by one bar. */
export const WAVEFORM_TICK_MS = 70;

/** Bars on screen: about 2.2 seconds of history at `WAVEFORM_TICK_MS`. */
export const WAVEFORM_BAR_COUNT = 32;

/**
 * A recognizer reading at or below this is room noise, not a voice. Product choice from the
 * libraries' documented range, not a measurement: raise it if bars dance in a quiet room.
 */
const NOISE_FLOOR = 1;

const MAX_VOLUME = 10;

/** What is left of the last level after one tick with no new reading. */
const SILENT_DECAY = 0.6;

/** Below this a decaying level is flat. */
const SILENCE = 0.02;

function clampUnit(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(value, 1);
}

/**
 * A `volumechange` value (-2 to 10) as a bar level from 0 to 1. The square root lifts ordinary
 * speech, which sits in the middle of the range, so a quiet voice still draws visible bars.
 */
export function normalizeVoiceVolume(value: number): number {
  if (!Number.isFinite(value) || value <= NOISE_FLOOR) {
    return 0;
  }

  const share = (Math.min(value, MAX_VOLUME) - NOISE_FLOOR) / (MAX_VOLUME - NOISE_FLOOR);
  return Math.sqrt(share);
}

/**
 * The web's stand-in for a level: a recognition result that added text is a burst, louder the more
 * it added. A result that only revised earlier words (same length or shorter) adds nothing.
 */
export function speechBurstLevel(previous: string, next: string): number {
  const added = next.trim().length - previous.trim().length;
  if (added <= 0) {
    return 0;
  }

  return Math.min(1, 0.45 + added * 0.05);
}

/**
 * Collects levels between waveform samples. `sample()` returns the loudest level pushed since the
 * last sample, or the last one decayed when nothing arrived, so a burst fades instead of dropping
 * to zero and a phone's steady readings come through as measured.
 */
export type VoiceLevelMeter = {
  push: (level: number) => void;
  sample: () => number;
  reset: () => void;
};

export function createVoiceLevelMeter(): VoiceLevelMeter {
  let peak: number | null = null;
  let last = 0;

  return {
    push(level) {
      const clamped = clampUnit(level);
      peak = peak === null ? clamped : Math.max(peak, clamped);
    },
    sample() {
      const next = peak ?? last * SILENT_DECAY;
      peak = null;
      last = next < SILENCE ? 0 : next;
      return last;
    },
    reset() {
      peak = null;
      last = 0;
    },
  };
}

/** A flat waveform: every bar at rest. */
export function silentWaveform(size: number = WAVEFORM_BAR_COUNT): number[] {
  return Array.from({ length: Math.max(0, size) }, () => 0);
}

/** The waveform after one tick: the oldest bar leaves on the left, `level` enters on the right. */
export function appendWaveformSample(
  bars: readonly number[],
  level: number,
  size: number = WAVEFORM_BAR_COUNT
): number[] {
  const kept = bars.slice(Math.max(0, bars.length - size + 1));
  return [...kept, clampUnit(level)];
}
