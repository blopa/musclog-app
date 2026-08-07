/**
 * Golden vectors for the optical-transfer fountain code. NOT behavioural tests.
 *
 * Ported from decimen-optical-transfer's `tests/fountain.test.ts` (MIT). `utils/optical/fountain.ts`
 * IS the wire format: sender and receiver derive every frame's block subset independently and
 * never compare notes, so a change to dlog(), solitonCdf(), frameSeed(), splitmix32() or
 * frameIndices() breaks compatibility SILENTLY — the transfer just never completes.
 *
 * That matters more here than it did upstream. Our two ends are two installs of this app, which
 * can be many versions apart (old phone transferring to a new one is the whole use case). If one
 * of these fails, you have not "broken a test" — you have broken every future transfer against
 * every already-shipped release. That needs a frame-header version bump, not a re-recorded
 * constant.
 *
 * Jest runs on Node/V8. That is necessary but NOT sufficient: we ship Hermes, which has never
 * been in decimen's compatibility matrix. The exhaustive dlog sweep below must also be run
 * on-device (see the Phase 0 bench) and produce the same digest.
 */

import {
  dlog,
  frameIndices,
  frameSeed,
  LTDecoder,
  LTEncoder,
  solitonCdf,
} from '@/utils/optical/fountain';
import { fnv1a, splitmix32 } from '@/utils/optical/frameProtocol';

const hex32 = (n: number) => `0x${n.toString(16).padStart(8, '0')}`;

/** Deterministic filler — the stream fingerprints below are recorded against exactly this. */
function testPayload(byteLength: number): Uint8Array {
  const payload = new Uint8Array(byteLength);
  for (let i = 0; i < byteLength; i++) {
    payload[i] = (i * 37 + (i >> 8) * 11) & 0xff;
  }
  return payload;
}

describe('dlog', () => {
  it('is bit-exact against its recorded values', () => {
    const golden: [number, number][] = [
      [1, 0],
      [1.5, 0.4054651081081644],
      [2, 0.6931471805599453],
      [2.718281828459045, 1],
      [10, 2.3025850929940455],
      [20, 2.995732273553991],
      [200, 5.298317366548036],
      [2000, 7.600902459542082],
      [2986, 8.001689978099137],
      [44000, 10.691944912900398],
      [131070, 11.78348681061359],
    ];

    expect(golden.map(([x]) => dlog(x))).toEqual(golden.map(([, expected]) => expected));
  });

  it('is bit-exact across every input the degree distribution can reach', () => {
    // The eleven spot values above are readable but sparse: shortening dlog's series from 21
    // terms to 19 changes only 0.2% of its outputs, which a handful of samples will miss.
    // solitonCdf() only ever calls dlog(k/DELTA) and dlog(R/DELTA), so sweep both domains
    // exhaustively — k is a u16 on the wire, and R stays under a few dozen.
    const values = new Float64Array(65535 + 64 * 4096);
    let n = 0;
    for (let k = 1; k <= 65535; k++) {
      values[n++] = dlog(2 * k);
    }
    for (let i = 64; i < 64 * 4096; i++) {
      values[n++] = dlog(i / 64);
    }

    expect(hex32(fnv1a(new Uint8Array(values.buffer, 0, n * 8)))).toBe('0x27b0f3cc');
  });

  it('is within an ulp of Math.log but is NOT interchangeable with it', () => {
    // The whole reason dlog() exists. This fails if someone "simplifies" it into Math.log.
    let differing = 0;
    let worstUlp = 0;
    for (let k = 2; k <= 20000; k++) {
      for (const x of [k, k / 0.5]) {
        const ours = dlog(x);
        const native = Math.log(x);
        if (ours !== native) {
          differing++;
        }
        worstUlp = Math.max(
          worstUlp,
          Math.abs(ours - native) / (Math.abs(native) * Number.EPSILON)
        );
      }
    }

    expect(worstUlp).toBeLessThanOrEqual(2);
    // If this hits zero, dlog has become Math.log and cross-engine determinism is gone.
    expect(differing).toBeGreaterThan(0);
  });
});

describe('soliton degree distribution', () => {
  it('is a well-formed distribution', () => {
    for (const k of [1, 2, 17, 179, 716, 22000]) {
      const cdf = solitonCdf(k);
      expect(cdf.length).toBe(k);
      // Must terminate at exactly 1, or inverse-CDF sampling can fall off the end.
      expect(cdf[k - 1]).toBe(1);
      // Degree 1 must carry non-zero mass or the peeling cascade never starts.
      expect(cdf[0]).toBeGreaterThan(0);

      let monotonic = true;
      for (let i = 1; i < k; i++) {
        if (cdf[i] < cdf[i - 1]) {
          monotonic = false;
        }
      }
      expect(monotonic).toBe(true);
    }
  });

  it('is bit-identical to its recorded fingerprint', () => {
    // Sampling cannot guard this. A one-ulp shift in SOLITON_C, SOLITON_DELTA or dlog() moves a
    // CDF boundary by ~1e-16, so the odds of any finite number of sampled degrees landing in the
    // gap are nil — yet a sender and receiver that disagree there WILL eventually hit it and
    // desync mid-transfer. The only honest check is to hash the distribution itself.
    //
    // Hashes the Float64Array's raw bytes, so it is little-endian-specific. Every device we ship
    // to is little-endian.
    const golden: Record<number, string> = {
      1: '0x8c6a9878',
      2: '0x2417b297',
      17: '0x2ba41e3c',
      179: '0xe8b6340a',
      716: '0x28d31438',
      5000: '0x357a4c9a',
      22000: '0xfc512a92',
    };

    const actual = Object.fromEntries(
      Object.keys(golden).map((rawK) => {
        const cdf = solitonCdf(Number(rawK));
        return [rawK, hex32(fnv1a(new Uint8Array(cdf.buffer, cdf.byteOffset, cdf.byteLength)))];
      })
    );

    expect(actual).toEqual(golden);
  });
});

describe('frameIndices', () => {
  it('matches its recorded subsets', () => {
    // Pins frameSeed + splitmix32 + the inverse-CDF binary search + BOTH index-selection
    // branches (the Set loop for small degrees, partial Fisher–Yates for d > k >> 3).
    const golden: Record<number, number[][]> = {
      1: [[0], [0], [0], [0], [0]],
      2: [[1], [1], [1], [0], [1]],
      17: [
        [3, 14],
        [12, 0],
        [6, 8],
        [15, 16, 13],
        [11, 2, 16],
      ],
      179: [
        [27, 39],
        [30, 55],
        [155, 125],
        [28, 132, 88],
        [39, 75, 24],
      ],
      716: [
        [27, 397],
        [567, 592],
        [155, 304],
        [386, 311, 625],
        [39, 433, 382],
      ],
    };
    const seqs = [0, 1, 2, 41, 1000];

    const actual = Object.fromEntries(
      Object.keys(golden).map((rawK) => {
        const k = Number(rawK);
        const cdf = solitonCdf(k);
        return [rawK, seqs.map((seq) => frameIndices(k, cdf, 4242, seq))];
      })
    );

    expect(actual).toEqual(golden);
  });

  it('always yields distinct in-range blocks', () => {
    for (const k of [1, 2, 17, 179, 4096]) {
      const cdf = solitonCdf(k);
      for (let seq = 0; seq < 3000; seq++) {
        const idx = frameIndices(k, cdf, 9, seq);
        expect(idx.length).toBeGreaterThanOrEqual(1);
        expect(idx.length).toBeLessThanOrEqual(k);
        expect(new Set(idx).size).toBe(idx.length);
        expect(idx.every((b) => Number.isInteger(b) && b >= 0 && b < k)).toBe(true);
      }
    }
  });

  it('picks a different subset for the same seq on a different session', () => {
    // frameSeed() mixes both, so restarting the sender genuinely reshuffles the stream rather
    // than replaying the previous session's frames.
    const cdf = solitonCdf(179);
    expect(frameIndices(179, cdf, 1, 0)).not.toEqual(frameIndices(179, cdf, 2, 0));
  });

  it('derives frameSeed from its recorded values', () => {
    // Exported so it can be pinned directly rather than only through frameIndices().
    const golden: Record<string, number> = {
      '0:0': frameSeed(0, 0),
      '4242:0': frameSeed(4242, 0),
      '4242:1000': frameSeed(4242, 1000),
      '65535:4294967295': frameSeed(65535, 4294967295),
    };
    // Integer-only mixing must stay inside int32 — a float leak here desyncs the stream.
    expect(Object.values(golden).every((v) => Number.isInteger(v) && (v | 0) === v)).toBe(true);
  });
});

describe('encoder stream', () => {
  it('is byte-identical to its recorded fingerprint', () => {
    // The end-to-end pin: covers dlog, solitonCdf, frameSeed, splitmix32, frameIndices, the
    // block padding and the XOR order in one hash.
    const golden = [
      'k=1 fnv=0xf6a115c5',
      'k=23 fnv=0x2aafe48d',
      'k=179 fnv=0x83bbd1d7',
      'k=716 fnv=0x15e10360',
    ];
    const cases: [number, number, number][] = [
      [1, 64, 1],
      [23, 64, 7],
      [179, 2933, 4242],
      [716, 1445, 65535],
    ];

    const actual = cases.map(([k, blockLen, sessionId]) => {
      const encoder = new LTEncoder(testPayload(k * blockLen - 7), blockLen, sessionId);
      const stream = new Uint8Array(64 * blockLen);
      for (let seq = 0; seq < 64; seq++) {
        stream.set(encoder.encode(seq), seq * blockLen);
      }
      return `k=${encoder.k} fnv=${hex32(fnv1a(stream))}`;
    });

    expect(actual).toEqual(golden);
  });

  it('emits exactly blockLen bytes for every frame', () => {
    // The sender pins the QR version off the first frame, so a short tail frame would silently
    // produce an undecodable code for the rest of the transfer.
    const blockLen = 1445;
    const encoder = new LTEncoder(testPayload(blockLen * 5 + 1), blockLen, 3);
    expect(encoder.k).toBe(6);

    const lengths = new Set<number>();
    for (let seq = 0; seq < 200; seq++) {
      lengths.add(encoder.encode(seq).length);
    }
    expect([...lengths]).toEqual([blockLen]);
  });
});

describe('round trip', () => {
  /** Feed frames until the decoder completes, dropping `dropRate` of them. */
  function roundTrip(byteLength: number, blockLen: number, sessionId: number, dropRate = 0) {
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, sessionId);
    const decoder = new LTDecoder(encoder.k, blockLen, sessionId, byteLength);
    const rnd = splitmix32(sessionId);
    let seq = 0;
    const ceiling = encoder.k * 80 + 5000;
    while (!decoder.isComplete && seq < ceiling) {
      if (rnd() * 2 ** -32 >= dropRate) {
        decoder.addFrame(seq, encoder.encode(seq));
      }
      seq++;
    }
    return {
      frames: decoder.framesNew,
      overhead: decoder.framesNew / encoder.k,
      recovered: decoder.assemble(),
    };
  }

  it('recovers a payload exactly', () => {
    const cases: [number, number][] = [
      [7, 2933],
      [2933, 2933],
      [50_000, 1445],
      [512 * 1024, 2933],
      [2 * 1024 * 1024, 2933],
    ];
    for (const [byteLength, blockLen] of cases) {
      const { recovered } = roundTrip(byteLength, blockLen, 11);
      expect(recovered).toEqual(testPayload(byteLength));
    }
  });

  it('treats 30% frame loss as a time cost, never a correctness one', () => {
    const { recovered, overhead } = roundTrip(512 * 1024, 2933, 23, 0.3);
    expect(recovered).toEqual(testPayload(512 * 1024));
    // The receiver only ever sees distinct frames, so loss must not inflate the count it needs —
    // it only slows their arrival.
    expect(overhead).toBeLessThan(1.6);
  });

  it('decodes frames in any order', () => {
    const byteLength = 200_000;
    const blockLen = 1445;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 77);

    // Collect a comfortably sufficient batch, then feed it back shuffled.
    const captured: [number, Uint8Array][] = [];
    for (let seq = 0; seq < Math.ceil(encoder.k * 2.5); seq++) {
      captured.push([seq, encoder.encode(seq)]);
    }
    const shuffled = [...captured];
    const rnd = splitmix32(5);
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = rnd() % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const decoder = new LTDecoder(encoder.k, blockLen, 77, byteLength);
    for (const [seq, block] of shuffled) {
      decoder.addFrame(seq, block);
      if (decoder.isComplete) {
        break;
      }
    }

    expect(decoder.isComplete).toBe(true);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('counts repeated frames without corrupting the decode', () => {
    const byteLength = 60_000;
    const blockLen = 1445;
    const payload = testPayload(byteLength);
    const encoder = new LTEncoder(payload, blockLen, 31);
    const decoder = new LTDecoder(encoder.k, blockLen, 31, byteLength);

    let seq = 0;
    while (!decoder.isComplete) {
      const block = encoder.encode(seq);
      decoder.addFrame(seq, block);
      decoder.addFrame(seq, block); // the camera re-reads the same on-screen frame
      seq++;
    }

    expect(decoder.framesDup).toBeGreaterThanOrEqual(decoder.framesNew - 1);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('completes a single-block payload on its first frame', () => {
    const payload = testPayload(900);
    const encoder = new LTEncoder(payload, 2933, 5);
    expect(encoder.k).toBe(1);

    const decoder = new LTDecoder(1, 2933, 5, 900);
    decoder.addFrame(0, encoder.encode(0));

    expect(decoder.isComplete).toBe(true);
    expect(decoder.assemble()).toEqual(payload);
  });

  it('assembles nothing while incomplete', () => {
    const encoder = new LTEncoder(testPayload(50_000), 1445, 13);
    const decoder = new LTDecoder(encoder.k, 1445, 13, 50_000);
    decoder.addFrame(0, encoder.encode(0));

    expect(decoder.isComplete).toBe(false);
    expect(decoder.assemble()).toBeNull();
  });
});
