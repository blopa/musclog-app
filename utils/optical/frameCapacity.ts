/**
 * Optical transfer — how much payload fits in a stream at a given frame size.
 *
 * Ported verbatim from decimen-optical-transfer (MIT), `shared/frame-capacity.ts`.
 *
 * The frame header numbers source blocks in a u16, so a large payload at a small bytes-per-frame
 * runs out of block numbers long before it runs out of size budget. The sender has to catch that
 * before it starts streaming, and name the setting that fixes it.
 *
 * In practice this never binds for us — our container is capped far below the limit (see
 * MAX_OPTICAL_CONTAINER_BYTES in ./container.ts) and the smallest preset still carries ~53 MB.
 * It is kept because it is the check that makes that claim true rather than assumed.
 */

import { HEADER_LEN } from './frameProtocol';

/** `k` is a u16 in the frame header. */
export const MAX_SOURCE_BLOCKS = 0xffff;

/** Payload bytes per frame, once the header has taken its cut. */
export function blockLength(frameBytes: number): number {
  return frameBytes - HEADER_LEN;
}

/** Source blocks a payload splits into at this frame size. */
export function sourceBlockCount(payloadBytes: number, frameBytes: number): number {
  return Math.ceil(payloadBytes / blockLength(frameBytes));
}

export function fitsInOneStream(payloadBytes: number, frameBytes: number): boolean {
  return sourceBlockCount(payloadBytes, frameBytes) <= MAX_SOURCE_BLOCKS;
}

/** The smallest bytes-per-frame that can carry this payload at all. */
export function minimumFrameBytes(payloadBytes: number): number {
  return Math.ceil(payloadBytes / MAX_SOURCE_BLOCKS) + HEADER_LEN;
}

/**
 * The smallest offered preset size that works, so the sender can name a value the user can
 * actually pick instead of the bare arithmetic minimum.
 */
export function smallestSufficientFrameSize(
  payloadBytes: number,
  options: readonly number[]
): number | undefined {
  const minimum = minimumFrameBytes(payloadBytes);
  return options.filter((value) => value >= minimum).sort((a, b) => a - b)[0];
}
