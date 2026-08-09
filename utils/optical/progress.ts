/**
 * Optical transfer — receiver progress and ETA.
 *
 * Ported verbatim from decimen-optical-transfer (MIT), `shared/progress.ts`.
 *
 * THE RULE THIS FILE ENCODES: progress tracks FRAMES COLLECTED, never blocks solved. The LT
 * peeling cascade back-loads — blocks-solved sits near zero and then hockey-sticks to done,
 * while frame arrival is linear. A bar driven by solved blocks looks stalled for most of the
 * transfer and then teleports, which reads as a bug. Blocks belong on a secondary line only.
 *
 * `formatDuration` is for diagnostics. User-facing durations go through the app's Intl helpers
 * (`utils/formatAppNumber.ts` / `hooks/useFormatAppNumber.ts`) per AGENTS.md.
 */

/**
 * Distinct frames per source block an LT stream needs, as a function of k.
 *
 * The often-quoted ~1.15 is asymptotic and only holds for large k. Measured upstream over 200
 * trials per k (128-byte blocks, frames fed until the decoder completes):
 *
 *     k       1     5    25    50   100   200   400   800  1600  3200
 *     p50  1.00  1.40  1.44  1.38  1.31  1.26  1.22  1.18  1.15  1.12
 *     p90  1.00  2.20  1.92  1.76  1.52  1.38  1.30  1.24  1.19  1.15
 *
 * `1.1 + 2.45/sqrt(k)` tracks the p50 closely from k≈50 up and sits just above it, which is the
 * direction that matters: an ETA that quotes too little and then keeps slipping reads as a
 * stall. Clamped at both ends.
 *
 * Note the p90 column when sizing anything that must hold a *fixed* number of frames — it is why
 * a pre-rendered frame pool is not safe at ceil(1.6k).
 */
export function expectedFountainOverhead(sourceBlocks: number): number {
  const k = Math.max(1, sourceBlocks);
  return Math.min(1.6, Math.max(1.15, 1.1 + 2.45 / Math.sqrt(k)));
}

export interface TransferProgressEstimate {
  fraction: number;
  expectedFrames: number;
  etaSeconds?: number;
  phase: 'collecting' | 'decoding';
}

export function estimateTransferProgress(
  sourceBlocks: number,
  uniqueFrames: number,
  elapsedSeconds: number,
  solvedBlocks = 0
): TransferProgressEstimate {
  const minimumFrames = Math.max(1, sourceBlocks);
  const expectedFrames = Math.max(
    minimumFrames + 1,
    Math.ceil(minimumFrames * expectedFountainOverhead(minimumFrames))
  );
  const expectedRedundancy = expectedFrames - minimumFrames;

  // Frames drive a continuously moving baseline: 0–86% while collecting the theoretical minimum,
  // 86–96% through the expected redundancy, then an asymptotic 96–99% if this particular stream
  // needs more. Actual decoded blocks can move the bar further ahead at any time.
  let frameFraction: number;
  if (uniqueFrames < minimumFrames) {
    frameFraction = 0.86 * (uniqueFrames / minimumFrames);
  } else if (uniqueFrames <= expectedFrames) {
    frameFraction = 0.86 + 0.1 * ((uniqueFrames - minimumFrames) / expectedRedundancy);
  } else {
    const extra = (uniqueFrames - expectedFrames) / expectedRedundancy;
    frameFraction = 0.96 + 0.03 * (1 - Math.exp(-extra));
  }

  const decodedFraction = 0.99 * Math.min(1, solvedBlocks / minimumFrames);
  const fraction = Math.min(0.99, Math.max(frameFraction, decodedFraction));
  const phase = uniqueFrames < minimumFrames ? 'collecting' : 'decoding';
  const rate = elapsedSeconds > 0 ? uniqueFrames / elapsedSeconds : 0;

  // Past the expected frame count the stream is running long — poor light, motion blur, a camera
  // that won't hold focus. That is exactly when someone is staring at the bar wondering whether
  // it has stalled, so keep quoting a time instead of going silent: extend the target one
  // redundancy block at a time. The estimate steps up when a step is missed, which is honest
  // about the transfer taking longer than the fountain's nominal overhead predicts.
  const overshoot = uniqueFrames - expectedFrames;
  const target =
    overshoot < 0
      ? expectedFrames
      : expectedFrames + expectedRedundancy * (Math.floor(overshoot / expectedRedundancy) + 1);
  const etaSeconds =
    uniqueFrames >= 3 && elapsedSeconds >= 1 && rate > 0
      ? (target - uniqueFrames) / rate
      : undefined;

  return { fraction, expectedFrames, etaSeconds, phase };
}

export function formatDuration(seconds: number): string {
  const rounded = Math.max(1, Math.ceil(seconds));
  if (rounded < 60) {
    return `${rounded}s`;
  }

  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes < 60) {
    return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
}
