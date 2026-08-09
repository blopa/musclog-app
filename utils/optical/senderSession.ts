/**
 * Optical transfer — the sender's pure half.
 *
 * Owns the fountain encoder and turns a seq number into the exact text that goes into a QR code.
 * Deliberately knows nothing about React, Skia, timers or frame rates: the display loop decides
 * *when* to pull a frame, this decides *what* the frame is. That split is what lets the whole
 * sender path be tested in the Jest `node` project.
 */

import { base44Encode } from './base44';
import { LTEncoder } from './fountain';
import { fnv1a, type FrameHeader, packFrame } from './frameProtocol';
import { type OpticalPreset } from './presets';

/**
 * Session ids are 16 bits and random per sender start. Never 0 — a zero id is indistinguishable
 * from an uninitialised header field when eyeballing a hex dump, and costs nothing to avoid.
 */
export function newOpticalSessionId(): number {
  return 1 + Math.floor(Math.random() * 0xffff);
}

export class OpticalStream {
  readonly k: number;
  readonly totalLen: number;
  readonly payloadFnv: number;
  /** Next seq `next()` will emit. Wraps at 2^32 to stay inside the header's u32. */
  seq = 0;

  private readonly encoder: LTEncoder;
  private readonly headerTemplate: Omit<FrameHeader, 'seq'>;

  constructor(
    payload: Uint8Array,
    readonly preset: OpticalPreset,
    readonly sessionId: number
  ) {
    this.totalLen = payload.length;
    // Computed once, here, so the caller can drop its reference to `payload` immediately: the
    // LTEncoder already holds its own packed copy, and keeping both doubles peak sender memory
    // for what is often the largest allocation in the app.
    this.payloadFnv = fnv1a(payload);
    this.encoder = new LTEncoder(payload, preset.blockLen, sessionId);
    this.k = this.encoder.k;
    this.headerTemplate = {
      sessionId,
      k: this.k,
      blockLen: preset.blockLen,
      totalLen: this.totalLen,
      payloadFnv: this.payloadFnv,
    };
  }

  /** The base44 text for an explicit seq. Pure — used by tests and by the lookahead pump. */
  frameText(seq: number): string {
    return base44Encode(packFrame({ ...this.headerTemplate, seq }, this.encoder.encode(seq)));
  }

  /** The next frame's text, advancing the stream. */
  next(): string {
    const text = this.frameText(this.seq);
    this.seq = (this.seq + 1) >>> 0;
    return text;
  }
}
