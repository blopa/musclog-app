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
 * Cap the display rate so frame generation uses at most half the JS thread, and never exceed 24 —
 * a frame must be held for at least two display refreshes or the receiver's capture straddles a
 * transition and reads a torn code.
 */
export function suggestedFpsForFrameCost(frameMs: number): number {
  if (frameMs <= 0) {
    return 24;
  }
  return Math.max(4, Math.min(24, Math.floor(1000 / (frameMs * 2))));
}
