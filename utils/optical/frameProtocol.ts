/**
 * Optical transfer — frame wire format. FROZEN.
 *
 * Ported verbatim from decimen-optical-transfer (MIT, © 2026 Evan Crawley),
 * `shared/protocol.ts`. Only the file container half was left behind; ours lives in
 * `./container.ts` because it is *not* frozen and must be free to evolve.
 *
 * Every frame is fully self-describing, so there is NO handshake — the receiver locks onto a
 * stream mid-flight and a new session id simply starts a fresh transfer.
 *
 * Layout (little-endian), 20 bytes, followed by `blockLen` payload bytes:
 *   0  u8   magic 0xD1
 *   1  u8   magic 0x0C
 *   2  u16  sessionId   random per sender start
 *   4  u32  seq         drives the fountain PRNG (see ./fountain.ts)
 *   8  u16  k           source block count
 *  10  u16  blockLen    payload bytes per frame
 *  12  u32  totalLen    container length in bytes
 *  16  u32  payloadFnv  FNV-1a of the whole container — verified on completion
 *
 * DO NOT CHANGE ANY OF IT. The two phones in a transfer can be running app versions months
 * apart, and they derive frame contents independently without ever comparing notes — so this
 * layout is a compatibility contract with our own past releases, not an implementation detail.
 * All format evolution belongs in the container, whose version byte is checked *after*
 * reassembly and can therefore produce "update Musclog on one of these phones" instead of a
 * stream that silently never completes. `utils/__tests__/opticalFrameProtocol.test.ts` pins the
 * header byte-for-byte against decimen's golden vector.
 *
 * Note this is the binary frame only. On the wire each frame is armored to text by
 * `./base44.ts` before it reaches a QR code, because the scanner hands us a string, never bytes.
 */

export const HEADER_LEN = 20;

const MAGIC0 = 0xd1;
const MAGIC1 = 0x0c;

export interface FrameHeader {
  sessionId: number;
  seq: number;
  k: number;
  blockLen: number;
  totalLen: number;
  payloadFnv: number;
}

export function packFrame(h: FrameHeader, block: Uint8Array): Uint8Array {
  const out = new Uint8Array(HEADER_LEN + block.length);
  const dv = new DataView(out.buffer);
  dv.setUint8(0, MAGIC0);
  dv.setUint8(1, MAGIC1);
  dv.setUint16(2, h.sessionId, true);
  dv.setUint32(4, h.seq, true);
  dv.setUint16(8, h.k, true);
  dv.setUint16(10, h.blockLen, true);
  dv.setUint32(12, h.totalLen, true);
  dv.setUint32(16, h.payloadFnv, true);
  out.set(block, HEADER_LEN);
  return out;
}

export function parseFrame(bytes: Uint8Array): { header: FrameHeader; block: Uint8Array } | null {
  if (bytes.length <= HEADER_LEN) {
    return null;
  }
  if (bytes[0] !== MAGIC0 || bytes[1] !== MAGIC1) {
    return null;
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const header: FrameHeader = {
    sessionId: dv.getUint16(2, true),
    seq: dv.getUint32(4, true),
    k: dv.getUint16(8, true),
    blockLen: dv.getUint16(10, true),
    totalLen: dv.getUint32(12, true),
    payloadFnv: dv.getUint32(16, true),
  };

  if (header.k === 0 || header.blockLen === 0 || header.totalLen === 0) {
    return null;
  }
  if (bytes.length !== HEADER_LEN + header.blockLen) {
    return null;
  }

  return { header, block: bytes.subarray(HEADER_LEN) };
}

/**
 * Everything about a frame that has to hold constant for a decoder to keep accepting frames into
 * it. `seq` is deliberately absent — it is the one field that varies within a stream.
 *
 * The receiver resets on ANY disagreement, not just a new session id: session ids are 16 bits
 * drawn at random on every sender restart, so a collision across a restart is rare but real, and
 * a mismatched frame fed into the old decoder corrupts it silently — surfacing only as a
 * checksum failure after the whole transfer has run. Including `payloadFnv` also means a sender
 * restarted on the SAME payload resumes into the same decoder, which is correct: identical k,
 * sessionId and seq produce an identical frame.
 */
export function streamIdentity(h: FrameHeader): string {
  return `${h.sessionId}:${h.k}:${h.blockLen}:${h.totalLen}:${h.payloadFnv}`;
}

export function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * splitmix32 — integer ops only, so it is bit-identical across JS engines.
 *
 * Wire format, not a utility: it drives the fountain's degree sampling and block selection on
 * both ends independently. See the determinism note in ./fountain.ts.
 */
export function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x9e3779b9) | 0;
    let t = s ^ (s >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t ^= t >>> 15;
    t = Math.imul(t, 0x735a2d97);
    t ^= t >>> 15;
    return t >>> 0;
  };
}
