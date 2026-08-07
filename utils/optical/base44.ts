/**
 * Optical transfer — binary ⇄ text armoring. Wire format; changing it breaks compatibility with
 * every already-shipped release (see the note in ./frameProtocol.ts).
 *
 * WHY THIS EXISTS: our QR frames are binary, but nothing in the receive path can carry binary.
 * `react-native-vision-camera`'s code scanner surfaces a code as `value?: string` — there is no
 * byte array on the `Code` type — and its Android backend is MLKit, whose `Barcode.rawValue` is
 * *nullable* and returns null when the payload is not valid text in the detected encoding. A
 * byte-mode frame would therefore be either mangled by a UTF-8 round trip or silently dropped.
 * (The frame header's first two bytes, 0xD1 0x0C, are an invalid UTF-8 lead byte followed by an
 * illegal continuation — it would not survive.) Getting real bytes back would mean enabling
 * frame processors and shipping a native decoder; armoring to text costs 3% instead.
 *
 * WHY BASE44 AND NOT BASE64: the alphabet below is exactly QR's ALPHANUMERIC charset, so an
 * encoder can pack our text at 5.5 bits/char (11 bits per 2 chars) instead of byte mode's 8 bits.
 * At 1.5 chars/byte that is 8.25 bits/byte — a 3.1% cost. Base64 would force byte mode and cost
 * 25%. `utils/__tests__/opticalBase44.test.ts` mechanically asserts every character here is
 * accepted by zxing's own alphanumeric table, so "we stay in alphanumeric mode" is a checked
 * fact rather than a comment.
 *
 * WHY SPACE IS EXCLUDED: QR's alphanumeric set has 45 characters, and 45³ ≥ 2¹⁶ would work too
 * (that is RFC 9285 base45). Space is dropped deliberately — it is the one character that
 * whitespace-trimming anywhere in the scanner stack could silently eat off a frame's head or
 * tail, and a corrupted frame is indistinguishable from a corrupt payload downstream. 44³ =
 * 85 184 ≥ 65 536, so the 2-bytes-to-3-chars ratio survives losing it.
 *
 * This is NOT RFC 9285 base45: different alphabet (no space) and most-significant-digit-first
 * rather than base45's little-endian digit order. Do not assume interop.
 */

/** QR alphanumeric charset (ISO/IEC 18004 Table 5) minus the space at index 36. */
export const BASE44_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$%*+-./:';

const RADIX = 44;
const RADIX_SQ = RADIX * RADIX; // 1936

/**
 * charCode → digit, or -1. Sized 128 because the alphabet's highest character is 'Z' (90); any
 * code point at or above the table length is rejected as out-of-alphabet.
 */
const DIGITS = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < BASE44_ALPHABET.length; i++) {
    table[BASE44_ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

export function base44Encode(bytes: Uint8Array): string {
  const out: string[] = [];
  const pairs = bytes.length - (bytes.length % 2);

  for (let i = 0; i < pairs; i += 2) {
    const v = bytes[i] * 256 + bytes[i + 1];
    out.push(
      BASE44_ALPHABET[(v / RADIX_SQ) | 0],
      BASE44_ALPHABET[((v / RADIX) | 0) % RADIX],
      BASE44_ALPHABET[v % RADIX]
    );
  }

  // A trailing odd byte becomes 2 chars (44² = 1936 ≥ 256). Frames never hit this — every
  // preset's frameBytes is even — but the codec is total, and the tests exercise it.
  if (pairs < bytes.length) {
    const v = bytes[pairs];
    out.push(BASE44_ALPHABET[(v / RADIX) | 0], BASE44_ALPHABET[v % RADIX]);
  }

  return out.join('');
}

/**
 * Returns null on ANY malformed input rather than throwing.
 *
 * This runs on every single scanner callback, and the camera happily hands us QR codes from
 * cereal boxes, URLs, and half-decoded garbage. A throw here would either cost a try/catch on
 * the hot path or take down the receive screen; "not one of ours" is an expected, uninteresting
 * outcome, not an error.
 */
export function base44Decode(text: string): Uint8Array | null {
  const remainder = text.length % 3;
  // 1 leftover char cannot encode anything: 2 chars carry a byte, 3 carry two.
  if (remainder === 1) {
    return null;
  }

  const triples = (text.length - remainder) / 3;
  const out = new Uint8Array(triples * 2 + (remainder === 2 ? 1 : 0));
  let o = 0;

  for (let i = 0; i < triples * 3; i += 3) {
    const d0 = digitAt(text, i);
    const d1 = digitAt(text, i + 1);
    const d2 = digitAt(text, i + 2);
    if (d0 < 0 || d1 < 0 || d2 < 0) {
      return null;
    }
    const v = d0 * RADIX_SQ + d1 * RADIX + d2;
    // 44³ overshoots 2¹⁶, so the top of the digit space is not a valid byte pair.
    if (v > 0xffff) {
      return null;
    }
    out[o++] = v >> 8;
    out[o++] = v & 0xff;
  }

  if (remainder === 2) {
    const d0 = digitAt(text, text.length - 2);
    const d1 = digitAt(text, text.length - 1);
    if (d0 < 0 || d1 < 0) {
      return null;
    }
    const v = d0 * RADIX + d1;
    if (v > 0xff) {
      return null;
    }
    out[o] = v;
  }

  return out;
}

function digitAt(text: string, index: number): number {
  const code = text.charCodeAt(index);
  return code < DIGITS.length ? DIGITS[code] : -1;
}
