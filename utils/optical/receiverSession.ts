/**
 * Optical transfer — the receiver's pure half.
 *
 * One method, `accept(text, nowMs)`, fed straight from the camera's code-scanner callback. Knows
 * nothing about React or the camera, so the whole receive path is testable in the Jest `node`
 * project and the hot path stays free of anything that could allocate a React update.
 *
 * Two behaviours here are load-bearing:
 *
 * - It NEVER throws. The camera hands us every QR code in view — cereal boxes, URLs, half-read
 *   garbage — so "not one of ours" is the common case and must cost a cheap `'ignored'`.
 * - It rebuilds its decoder on ANY `streamIdentity` disagreement, not just a new session id.
 *   Session ids are 16 random bits, so a collision across a sender restart is rare but real, and
 *   a mismatched frame fed into the surviving decoder corrupts it silently — surfacing only as a
 *   checksum failure after the entire transfer has run.
 */

import { base44Decode } from './base44';
import { LTDecoder } from './fountain';
import { fnv1a, parseFrame, streamIdentity } from './frameProtocol';

export type OpticalAcceptResult =
  /** Not a frame of ours, or unreadable. By far the most common result. */
  | 'ignored'
  /** A different stream: the decoder was rebuilt and this frame went into the fresh one. */
  | 'reset'
  | 'accepted'
  | 'duplicate'
  /** Assembled and the FNV matched — `takeContainer()` now returns the payload. */
  | 'complete'
  /** Assembled but the FNV did not match. The stream is unusable; the caller should reset. */
  | 'checksum-failed';

export interface OpticalReceiverStats {
  streamKey: null | string;
  k: number;
  blockLen: number;
  totalLen: number;
  framesNew: number;
  framesDup: number;
  /** Codes seen that were not frames of ours. A high ratio means the wrong thing is in frame. */
  framesIgnored: number;
  solvedBlocks: number;
  startedAtMs: number;
  lastFrameAtMs: number;
}

const emptyStats = (): OpticalReceiverStats => ({
  streamKey: null,
  k: 0,
  blockLen: 0,
  totalLen: 0,
  framesNew: 0,
  framesDup: 0,
  framesIgnored: 0,
  solvedBlocks: 0,
  startedAtMs: 0,
  lastFrameAtMs: 0,
});

export class OpticalReceiver {
  private decoder: LTDecoder | null = null;
  private container: Uint8Array | null = null;
  private state = emptyStats();
  /**
   * The last text accepted, so a camera re-reading the same on-screen code costs one string
   * comparison instead of a base44 decode plus a frame parse. At 15–30 callbacks/s against a
   * sender running slower than that, most callbacks are this case.
   */
  private lastText: null | string = null;
  /**
   * Re-reads of the identical on-screen code, counted here rather than folded into `state` so
   * the published total can be recomputed from scratch each frame. Accumulating in place double
   * counts, because `LTDecoder.framesDup` is itself cumulative.
   */
  private textDups = 0;

  get stats(): Readonly<OpticalReceiverStats> {
    return this.state;
  }

  get isComplete(): boolean {
    return this.container !== null;
  }

  accept(text: string, nowMs: number): OpticalAcceptResult {
    if (this.container !== null) {
      return 'ignored';
    }
    if (text === this.lastText) {
      this.textDups++;
      this.state.framesDup = this.textDups + (this.decoder?.framesDup ?? 0);
      return 'duplicate';
    }

    const bytes = base44Decode(text);
    if (!bytes) {
      this.state.framesIgnored++;
      return 'ignored';
    }

    const parsed = parseFrame(bytes);
    if (!parsed) {
      this.state.framesIgnored++;
      return 'ignored';
    }

    const { header, block } = parsed;
    const key = streamIdentity(header);
    let didReset = false;

    if (!this.decoder || this.state.streamKey !== key) {
      this.decoder = new LTDecoder(header.k, header.blockLen, header.sessionId, header.totalLen);
      this.state = {
        ...emptyStats(),
        streamKey: key,
        k: header.k,
        blockLen: header.blockLen,
        totalLen: header.totalLen,
        startedAtMs: nowMs,
      };
      this.textDups = 0;
      didReset = true;
    }

    this.lastText = text;
    const before = this.decoder.framesNew;
    this.decoder.addFrame(header.seq, block);

    this.state.framesNew = this.decoder.framesNew;
    this.state.framesDup = this.textDups + this.decoder.framesDup;
    this.state.solvedBlocks = this.decoder.solvedCount;
    this.state.lastFrameAtMs = nowMs;

    // `addFrame` counts a repeat of a seq we already hold as a dup; that is distinct from the
    // identical-text early-out above (a re-read of the same displayed code).
    if (this.decoder.framesNew === before) {
      return 'duplicate';
    }

    if (this.decoder.isComplete) {
      const assembled = this.decoder.assemble();
      // Two independent gates guard the restore: this FNV proves the fountain reassembled the
      // exact bytes the sender hashed, and the container's own SHA-256 proves the payload
      // survived decompression and decryption.
      if (!assembled || fnv1a(assembled) !== header.payloadFnv) {
        return 'checksum-failed';
      }
      this.container = assembled;
      return 'complete';
    }

    return didReset ? 'reset' : 'accepted';
  }

  /** Non-null only after `accept` returned 'complete'. */
  takeContainer(): Uint8Array | null {
    return this.container;
  }

  reset(): void {
    this.decoder = null;
    this.container = null;
    this.state = emptyStats();
    this.lastText = null;
    this.textDups = 0;
  }
}
