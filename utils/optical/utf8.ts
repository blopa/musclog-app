/**
 * Optical transfer — UTF-8 conversion.
 *
 * WHY THIS FILE EXISTS: `TextDecoder` is NOT native here. Expo installs a JavaScript polyfill
 * (`install('TextDecoder', () => require('./TextDecoder').TextDecoder)` in
 * `expo/src/winter/runtime.native.ts`) whose `decode()` walks the input a byte at a time through a
 * token stream and pushes every code point into a plain `number[]` before building a string. On a
 * multi-hundred-kilobyte export that is pathological.
 *
 * `TextEncoder` is absent from that install list because Hermes provides it natively — measured at
 * 12 ms for a 649 KB export on a 2018 phone — so only the decode direction needs replacing.
 *
 * Do not "simplify" `utf8Decode` back to `new TextDecoder().decode(bytes)`.
 */

const DECODE_CHUNK = 4096;

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Decode UTF-8 bytes into a string.
 *
 * Emits UTF-16 code units in fixed chunks through `String.fromCharCode.apply`, which keeps the
 * argument count well under any engine's stack limit while avoiding both per-character string
 * concatenation and a full intermediate array.
 *
 * Malformed input is not expected — the container verifies SHA-256 over these exact bytes before
 * calling this — but truncated sequences are clamped rather than allowed to read past the end and
 * produce NaN code units.
 */
export function utf8Decode(bytes: Uint8Array): string {
  const parts: string[] = [];
  const units: number[] = new Array(DECODE_CHUNK);
  const length = bytes.length;
  let unitCount = 0;
  let index = 0;

  const flush = () => {
    parts.push(String.fromCharCode.apply(null, units.slice(0, unitCount)));
    unitCount = 0;
  };
  const continuation = () => (index < length ? bytes[index++] & 0x3f : 0);

  while (index < length) {
    const first = bytes[index++];
    let codePoint: number;

    if (first < 0x80) {
      codePoint = first;
    } else if (first < 0xe0) {
      codePoint = ((first & 0x1f) << 6) | continuation();
    } else if (first < 0xf0) {
      codePoint = ((first & 0x0f) << 12) | (continuation() << 6) | continuation();
    } else {
      codePoint =
        ((first & 0x07) << 18) | (continuation() << 12) | (continuation() << 6) | continuation();
    }

    if (codePoint > 0xffff) {
      // Astral plane: split into a surrogate pair.
      const offset = codePoint - 0x10000;
      units[unitCount++] = 0xd800 + (offset >> 10);
      if (unitCount === DECODE_CHUNK) {
        flush();
      }
      units[unitCount++] = 0xdc00 + (offset & 0x3ff);
    } else {
      units[unitCount++] = codePoint;
    }

    if (unitCount === DECODE_CHUNK) {
      flush();
    }
  }

  if (unitCount > 0) {
    flush();
  }

  return parts.join('');
}
