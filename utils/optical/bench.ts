/**
 * Optical transfer — Phase 0 measurements.
 *
 * These answer the questions the design cannot answer from a desk, on the engine and hardware we
 * actually ship. Kept pure (no React, no Skia) so the numbers come from the same code paths the
 * sender uses, and so they can be exercised in Jest.
 *
 * Everything long-running is chunked with a yield, because these run on the JS thread and a
 * multi-second block would freeze the very screen reporting the result.
 */

import { BASE44_ALPHABET } from './base44';
import { dlog } from './fountain';
import { fnv1a } from './frameProtocol';
import {
  base44CharsForBytes,
  MAX_RECOMMENDED_OPTICAL_PRESET_ID,
  OPTICAL_PRESETS,
  type OpticalPresetId,
} from './presets';
import { encodeQrAlphanumericFixed } from './qrEncode';
import { rasterizeQr } from './qrRaster';

/** `performance.now()` where available (sub-ms), else the millisecond clock. */
const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * The digest decimen's golden vectors record for the exhaustive dlog sweep, and which
 * `utils/__tests__/opticalFountain.test.ts` already proves we reproduce on V8/Node.
 */
export const DLOG_SWEEP_EXPECTED_DIGEST = '0x27b0f3cc';

export interface DlogSweepResult {
  digest: string;
  expected: string;
  matches: boolean;
  ms: number;
}

/**
 * A4 — the determinism check, on Hermes.
 *
 * Sweeps exactly the two domains `solitonCdf()` feeds dlog: `dlog(2k)` for every k a u16 can
 * hold, and `dlog(i/64)` across R's range. Hashes the raw Float64 bytes.
 *
 * WHY THIS IS NOT OPTIONAL: sender and receiver build their degree distributions independently
 * and never compare notes. If Hermes' float codegen differs from V8's anywhere in this sweep,
 * two phones would sample different degrees, and the transfer would simply never complete — no
 * error, no diagnostic, just a progress bar that stops. Jest proving this on V8 says nothing
 * about the engine in the user's hand.
 */
export async function runDlogSweep(
  onProgress?: (fraction: number) => void
): Promise<DlogSweepResult> {
  const kMax = 65535;
  const rMax = 64 * 4096;
  const values = new Float64Array(kMax + rMax - 64);
  const started = now();
  let n = 0;

  const CHUNK = 8192;
  for (let k = 1; k <= kMax; k += CHUNK) {
    const end = Math.min(k + CHUNK, kMax + 1);
    for (let i = k; i < end; i++) {
      values[n++] = dlog(2 * i);
    }
    onProgress?.((n / values.length) * 0.5);
    await yieldToUi();
  }
  for (let i = 64; i < rMax; i += CHUNK) {
    const end = Math.min(i + CHUNK, rMax);
    for (let j = i; j < end; j++) {
      values[n++] = dlog(j / 64);
    }
    onProgress?.((n / values.length) * 0.5 + 0.5);
    await yieldToUi();
  }

  const digest = fnv1a(new Uint8Array(values.buffer, 0, n * 8));
  const hex = `0x${digest.toString(16).padStart(8, '0')}`;

  return {
    digest: hex,
    expected: DLOG_SWEEP_EXPECTED_DIGEST,
    matches: hex === DLOG_SWEEP_EXPECTED_DIGEST,
    ms: now() - started,
  };
}

export interface EncodeBenchRow {
  label: string;
  qrVersion: number;
  chars: number;
  /** QR generation only. */
  encodeP50: number;
  encodeP90: number;
  encodeMax: number;
  /** Module matrix → RGBA pixels. */
  rasterP50: number;
  /** encodeP90 + rasterP50 — what a display tick actually costs before Skia. */
  frameP90: number;
  /** Sustainable rate at 50% JS-thread occupancy, the sender's fps cap. */
  suggestedFps: number;
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

/** Distinct strings, so Reed–Solomon and masking do representative work rather than repeating. */
function benchTexts(chars: number, count: number): string[] {
  const texts: string[] = [];
  for (let i = 0; i < count; i++) {
    let text = '';
    for (let j = 0; j < chars; j++) {
      text += BASE44_ALPHABET[(i * 7 + j * 17 + (j >> 5) * 3) % BASE44_ALPHABET.length];
    }
    texts.push(text);
  }
  return texts;
}

/**
 * A1 — per-frame sender cost.
 *
 * The number that decides whether the sender can generate frames live or needs another strategy.
 * `suggestedFps` caps JS-thread occupancy at 50% so the Stop button stays responsive; the sender
 * uses the same formula.
 */
export async function benchQrEncode(
  label: string,
  qrVersion: number,
  chars: number,
  iterations = 40,
  quietZone = 4
): Promise<EncodeBenchRow> {
  const texts = benchTexts(chars, iterations + 5);

  // Warm up: first calls pay one-off allocation and JIT costs that are not representative.
  for (let i = 0; i < 5; i++) {
    const matrix = encodeQrAlphanumericFixed(texts[i], qrVersion, 'L');
    rasterizeQr(matrix.moduleCount, matrix.modules, quietZone);
  }
  await yieldToUi();

  const encodeTimes: number[] = [];
  const rasterTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const text = texts[i + 5];

    const encodeStart = now();
    const matrix = encodeQrAlphanumericFixed(text, qrVersion, 'L');
    encodeTimes.push(now() - encodeStart);

    const rasterStart = now();
    rasterizeQr(matrix.moduleCount, matrix.modules, quietZone);
    rasterTimes.push(now() - rasterStart);

    // Yield periodically so a slow device still repaints during a long run.
    if (i % 8 === 7) {
      await yieldToUi();
    }
  }

  encodeTimes.sort((a, b) => a - b);
  rasterTimes.sort((a, b) => a - b);

  const encodeP90 = percentile(encodeTimes, 0.9);
  const rasterP50 = percentile(rasterTimes, 0.5);
  const frameP90 = encodeP90 + rasterP50;

  return {
    label,
    qrVersion,
    chars,
    encodeP50: percentile(encodeTimes, 0.5),
    encodeP90,
    encodeMax: encodeTimes[encodeTimes.length - 1],
    rasterP50,
    frameP90,
    suggestedFps: suggestedFpsForFrameCost(frameP90),
  };
}

/**
 * Above this there is nothing to gain: the receiving camera decodes on the order of 10 codes a
 * second, and a sender running far ahead of it just shows frames nobody reads. Decimen's rule of
 * thumb is ~1.5–2× the receiver's rate, which lands here. (A frame must also be held for at
 * least two display refreshes, so 30 is a hard ceiling on a 60 Hz panel regardless.)
 */
export const OPTICAL_MAX_DISPLAY_FPS = 15;

/**
 * Display rate this device can actually sustain while generating frames live, with ~15% headroom.
 *
 * The floor is 1, not 4. An earlier floor of 4 was actively harmful: on a 2018 phone a `max`
 * frame costs ~320 ms, so "4 fps" asked for a 250 ms period against 320 ms of work. With a
 * `setInterval` that silently piles callbacks up until the thread never catches up — the observed
 * "fps drops off a cliff after a few seconds". The sender now self-schedules (each tick is queued
 * only once the previous one finishes) so an over-optimistic target degrades gracefully instead,
 * but reporting an unreachable number was still a lie.
 */
export function suggestedFpsForFrameCost(frameMs: number): number {
  if (frameMs <= 0) {
    return OPTICAL_MAX_DISPLAY_FPS;
  }
  return Math.max(1, Math.min(OPTICAL_MAX_DISPLAY_FPS, Math.floor(1000 / (frameMs * 1.15))));
}

export interface PresetCalibration {
  presetId: OpticalPresetId;
  qrVersion: number;
  encodeP90: number;
  /** Frames per second this device can generate at this density. */
  buildFps: number;
  /** blockLen × the rate we could actually run at — the number that decides the winner. */
  throughputBytesPerSec: number;
}

export interface DeviceCalibration {
  presets: PresetCalibration[];
  recommendedPresetId: OpticalPresetId;
  recommendedFps: number;
  notes: string[];
}

/**
 * Measure this device and pick settings for it.
 *
 * THE FINDING THIS ENCODES: when the sender is encode-bound, goodput is very nearly independent
 * of density, because a QR symbol's data capacity and its encoding cost both scale with the
 * module count squared. Measured on a Moto Z3 Play (2018, Snapdragon 636, Hermes):
 *
 *     preset    ver  encode p90   bytes/frame   bytes/sec
 *     tiny       16      81 ms         568        7 003
 *     compact    20     123 ms         832        6 759
 *     standard   24     175 ms        1136        6 503
 *     dense      27     228 ms        1420        6 231
 *     max        33     321 ms        2006        6 251
 *
 * Density buys nothing — it is very slightly *worse* — while costing a lot of decode margin (at
 * Android's locked ~640×480 analysis resolution, v16 gets 4.85 px/module and v33 only 2.75). So
 * on a slow device the lowest density is strictly better on both axes.
 *
 * ON A FAST DEVICE THE THROUGHPUT RANKING BECOMES ACTIVELY WRONG, which cost a real transfer an
 * hour before this cap existed. Once generation outruns the camera, every preset hits the display
 * cap, so `blockLen × fps` simply picks the densest one — and density is what the receiving camera
 * cannot hold focus on. A frame that fails to decode has zero throughput, and no sender-side
 * measurement can see that. So the search is restricted to presets no denser than
 * `MAX_RECOMMENDED_OPTICAL_PRESET_ID`; the rest of the ladder stays available for manual override.
 */
export async function calibrateDevice(iterations = 8): Promise<DeviceCalibration> {
  const presets: PresetCalibration[] = [];
  const ceilingVersion =
    OPTICAL_PRESETS.find((preset) => preset.id === MAX_RECOMMENDED_OPTICAL_PRESET_ID)?.qrVersion ??
    Infinity;

  for (const preset of OPTICAL_PRESETS) {
    const row = await benchQrEncode(
      preset.id,
      preset.qrVersion,
      base44CharsForBytes(preset.frameBytes),
      iterations
    );
    const buildFps = 1000 / Math.max(1, row.frameP90);
    presets.push({
      presetId: preset.id,
      qrVersion: preset.qrVersion,
      encodeP90: row.encodeP90,
      buildFps,
      throughputBytesPerSec: preset.blockLen * Math.min(buildFps, OPTICAL_MAX_DISPLAY_FPS),
    });
  }

  // Only densities the receiving camera can be expected to hold focus on are eligible.
  const eligible = presets.filter((candidate) => candidate.qrVersion <= ceilingVersion);
  const best = [...eligible].sort(
    (a, b) => b.throughputBytesPerSec - a.throughputBytesPerSec || a.qrVersion - b.qrVersion
  )[0];

  // Anything within 10% of the best is a wash; take the least dense of those.
  const chosen = eligible
    .filter((candidate) => candidate.throughputBytesPerSec >= best.throughputBytesPerSec * 0.9)
    .sort((a, b) => a.qrVersion - b.qrVersion)[0];
  const recommendedFps = suggestedFpsForFrameCost(1000 / chosen.buildFps);

  const notes = [
    `Measured ${presets.length} densities on this device.`,
    `Goodput is ${Math.round(Math.min(...presets.map((p) => p.throughputBytesPerSec)))}–` +
      `${Math.round(Math.max(...presets.map((p) => p.throughputBytesPerSec)))} B/s across all of ` +
      `them — density barely moves it, because QR capacity and QR encode cost both scale with ` +
      `modules².`,
    `Selection is capped at "${MAX_RECOMMENDED_OPTICAL_PRESET_ID}": denser codes do not transfer ` +
      `faster in practice, they just stop decoding once the receiving camera loses focus.`,
    `Chose "${chosen.presetId}" (QR v${chosen.qrVersion}) at ${recommendedFps} fps.`,
  ];

  if (chosen.buildFps < 3) {
    notes.push(
      `NOTE: this device generates under 3 frames/s even at the lowest density. The first pass ` +
        `will be slow; the frame cache makes any later pass fast.`
    );
  }

  return {
    presets,
    recommendedPresetId: chosen.presetId,
    recommendedFps,
    notes,
  };
}

/**
 * How many distinct frames to keep so the stream can loop without re-encoding.
 *
 * WHY CACHE AT ALL: encoding is the sender's whole cost, and a frame's contents depend only on
 * its seq — so a frame generated once can be shown again for free. The first pass runs at
 * whatever the device can generate; every pass after that runs at the display rate.
 *
 * WHY 2.5× k: a receiver that has seen every frame the cache holds and still cannot peel is
 * deadlocked, so the cache must comfortably exceed the worst-case frame count. Decimen's measured
 * p90 overhead reaches 1.9–2.2 at small k, so 1.6 (the ETA model's clamp) would not be safe here
 * and 2.5 is.
 *
 * The byte cap keeps a huge payload from exhausting memory on a low-end device; past it the
 * sender must keep generating rather than looping (see the caller).
 */
export const OPTICAL_FRAME_CACHE_MULTIPLIER = 2.5;
export const OPTICAL_FRAME_CACHE_MAX_BYTES = 8 * 1024 * 1024;

export interface FrameCachePlan {
  /** Frames to cache. **0 means do not cache** — generate every frame live, forever. */
  frames: number;
  /** True when the cache is big enough that looping it is safe. */
  loopSafe: boolean;
}

/**
 * A HALF-SIZED CACHE IS WORSE THAN NO CACHE, which is why this returns a plan rather than a
 * number. Looping N distinct frames when the receiver needs more than N is a hard deadlock: it
 * has seen everything the sender will ever show and still cannot peel, so the transfer sits at
 * ~98% forever. That failure is silent and unrecoverable without restarting the sender.
 *
 * So the cache is all-or-nothing: either it holds a safely loopable set, or we do not cache at
 * all and pay the encode cost on every frame (slower, but always correct — the fountain never
 * runs out of new frames). A big payload on a low-end phone takes the second path.
 */
export function planFrameCache(k: number, moduleCount: number): FrameCachePlan {
  const safeFrames = Math.ceil(k * OPTICAL_FRAME_CACHE_MULTIPLIER);
  const perFrameBytes = Math.max(1, moduleCount * moduleCount);
  const affordable = Math.floor(OPTICAL_FRAME_CACHE_MAX_BYTES / perFrameBytes);

  return safeFrames <= affordable
    ? { frames: safeFrames, loopSafe: true }
    : { frames: 0, loopSafe: false };
}
