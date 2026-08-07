/**
 * Golden vectors for the optical-transfer frame header. NOT behavioural tests.
 *
 * Ported from decimen-optical-transfer's `tests/protocol.test.ts` (MIT), frame half only.
 *
 * The 20-byte header is frozen: two phones running app versions months apart parse each other's
 * frames with no handshake and no negotiation. If the byte-for-byte vector below fails, you have
 * broken compatibility with every already-shipped release — that is a header version bump, not a
 * re-recorded constant. See the header comment in `utils/optical/frameProtocol.ts`.
 */

import {
  fnv1a,
  type FrameHeader,
  HEADER_LEN,
  packFrame,
  parseFrame,
  splitmix32,
  streamIdentity,
} from '@/utils/optical/frameProtocol';

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');

describe('frame header', () => {
  it('is byte-for-byte what the wire expects', () => {
    const header: FrameHeader = {
      sessionId: 0xbeef,
      seq: 0x01020304,
      k: 0x0111,
      blockLen: 6,
      totalLen: 0x00fedcba,
      payloadFnv: 0x89abcdef,
    };
    const frame = packFrame(header, new Uint8Array([1, 2, 3, 4, 5, 6]));

    expect(toHex(frame)).toBe(
      'd1 0c ef be 04 03 02 01 11 01 06 00 ba dc fe 00 ef cd ab 89 01 02 03 04 05 06'
    );
    expect(frame.length).toBe(HEADER_LEN + 6);

    const parsed = parseFrame(frame);
    expect(parsed?.header).toEqual(header);
    expect(parsed?.block).toEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
  });

  it('round-trips the full range of every field', () => {
    const header: FrameHeader = {
      sessionId: 0xffff,
      seq: 0xffffffff,
      k: 0xffff,
      blockLen: 8,
      totalLen: 0xffffffff,
      payloadFnv: 0xffffffff,
    };
    const parsed = parseFrame(packFrame(header, new Uint8Array(8)));

    // u32s must come back unsigned — a sign-extended seq would desync the fountain PRNG.
    expect(parsed?.header).toEqual(header);
  });

  it('rejects frames that are not ours, or not self-consistent', () => {
    const good = packFrame(
      { sessionId: 1, seq: 2, k: 3, blockLen: 4, totalLen: 10, payloadFnv: 0 },
      new Uint8Array([9, 9, 9, 9])
    );
    expect(parseFrame(good)).not.toBeNull();

    // A QR code from somewhere else — this is the common case, not an edge case.
    const wrongMagic = good.slice();
    wrongMagic[0] = 0xd2;
    expect(parseFrame(wrongMagic)).toBeNull();

    expect(parseFrame(good.subarray(0, HEADER_LEN))).toBeNull(); // header with no block
    expect(parseFrame(good.subarray(0, good.length - 1))).toBeNull(); // truncated block

    // k=0 would divide by zero downstream; blockLen/totalLen=0 are equally nonsensical.
    for (const [offset, setter] of [
      [8, 'setUint16'],
      [10, 'setUint16'],
      [12, 'setUint32'],
    ] as const) {
      const zeroed = good.slice();
      new DataView(zeroed.buffer)[setter](offset, 0, true);
      expect(parseFrame(zeroed)).toBeNull();
    }
  });

  it('parses a frame sitting at a non-zero byteOffset', () => {
    // parseFrame builds its DataView from byteOffset/byteLength. A frame that arrives as a
    // subarray of a larger buffer must not read its neighbours' bytes.
    const header: FrameHeader = {
      sessionId: 7,
      seq: 9,
      k: 2,
      blockLen: 4,
      totalLen: 8,
      payloadFnv: 0x1234,
    };
    const frame = packFrame(header, new Uint8Array([1, 2, 3, 4]));

    const padded = new Uint8Array(frame.length + 8);
    padded.set(frame, 5);

    expect(parseFrame(padded.subarray(5, 5 + frame.length))?.header).toEqual(header);
  });
});

describe('streamIdentity', () => {
  const base: FrameHeader = {
    sessionId: 1,
    seq: 0,
    k: 3,
    blockLen: 4,
    totalLen: 10,
    payloadFnv: 0xabcdef,
  };

  it('is invariant in seq and only seq', () => {
    // seq is the one field that varies within a stream; every other field changing means this is
    // a different transfer and the decoder must be rebuilt.
    expect(streamIdentity({ ...base, seq: 99999 })).toBe(streamIdentity(base));

    const varying: (keyof FrameHeader)[] = ['sessionId', 'k', 'blockLen', 'totalLen', 'payloadFnv'];
    for (const field of varying) {
      expect(streamIdentity({ ...base, [field]: base[field] + 1 })).not.toBe(streamIdentity(base));
    }
  });

  it('cannot be confused by its own separator', () => {
    // Without a separator, {k:1, blockLen:23} and {k:12, blockLen:3} would collide — and a
    // mismatched frame fed into the wrong decoder corrupts it silently, surfacing only as a
    // checksum failure after the whole transfer has run.
    expect(streamIdentity({ ...base, k: 1, blockLen: 23 })).not.toBe(
      streamIdentity({ ...base, k: 12, blockLen: 3 })
    );
  });
});

describe('fnv1a', () => {
  it('matches its recorded values', () => {
    // Used as the frame header's payload checksum, so it is wire format too.
    expect(fnv1a(new Uint8Array(0))).toBe(0x811c9dc5);
    expect(fnv1a(new Uint8Array([0x61]))).toBe(0xe40c292c); // "a"
    expect(fnv1a(new Uint8Array([0x61, 0x62, 0x63]))).toBe(0x1a47e90b); // "abc"
  });

  it('returns an unsigned 32-bit value', () => {
    // Math.imul yields a signed int32; a leaked negative would not survive setUint32 round trip.
    const wide = new Uint8Array(1024);
    for (let i = 0; i < wide.length; i++) {
      wide[i] = (i * 31) & 0xff;
    }
    const digest = fnv1a(wide);
    expect(digest).toBeGreaterThanOrEqual(0);
    expect(digest).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('splitmix32', () => {
  const take = (seed: number, n: number) => {
    const rnd = splitmix32(seed);
    return Array.from({ length: n }, () => rnd());
  };

  it('is deterministic per seed and stays in uint32', () => {
    // Integer ops only, so this is identical on every JS engine — which is the entire point.
    // A negative here (a leaked int32) would shift every degree the fountain samples.
    const first = take(0, 4);

    expect(first.every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff)).toBe(true);
    expect(take(0, 4)).toEqual(first);
    expect(take(1, 4)).not.toEqual(first);
  });
});
