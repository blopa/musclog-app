/**
 * Optical transfer — QR generation with the version AND mask pattern pinned.
 *
 * WHY NOT A QR PACKAGE: `@zxing/library` is already a direct dependency, and it exposes every
 * public static piece of `Encoder.encode`'s body. Only `chooseMode`, `chooseVersion`,
 * `recommendVersion`, `willFit`, `calculateMaskPenalty` and `chooseMaskPattern` are private —
 * and those are precisely the steps we want to skip. So this file re-walks the same sequence
 * with our own decisions substituted, and adds no new dependency.
 *
 * WHY NOT `QRCodeEncoder.encode()` DIRECTLY — two reasons, and the first is correctness:
 *
 * 1. IT CANNOT ENCODE A SYMBOL FILLED TO CAPACITY. `Encoder.willFit` (Encoder.js:262) computes
 *    `totalInputBytes = (numInputBits + 7) / 8` — the Java original truncates there via integer
 *    division, but the TypeScript port left it a float, so a payload occupying the final partial
 *    codeword is compared as `1174 >= 1174.25` and rejected with "Data too big for requested
 *    version". Our `standard`, `dense` and `max` presets all size frames to exactly that
 *    boundary, so all three are simply unreachable through the public encoder. Skipping
 *    `willFit` is therefore not an optimisation, it is the only way to use the capacity we paid
 *    for. `utils/__tests__/opticalQrEncode.test.ts` proves the resulting symbols are valid by
 *    round-tripping them through zxing's own DECODER.
 *
 * 2. It always runs `chooseMaskPattern`, which builds the full matrix 8 extra times and runs 4
 *    O(dimension²) penalty rules over each — for a result that is irrelevant to us, since any of
 *    the 8 masks is spec-legal and every decoder reads the mask id out of the format info.
 *    Measured on V8, pinning it is worth ~1.43× across every preset (V16 2.2ms vs 3.2ms, V33
 *    7.8ms vs 11.2ms). NOTE that is far less than the mask search's share of the *work* would
 *    suggest: Reed–Solomon in `interleaveWithECBytes` dominates encode cost, and both paths pay
 *    it once. So if a future sender is encode-bound, the lever is the RS step or a native
 *    encoder — not further trimming around the mask.
 *
 * WHY THE DEEP `cjs/` IMPORTS: the package root re-exports the entire ~2 MB library (decoders,
 * every other symbology, the browser DOM writers) for the handful of symbols below, and it would
 * all land in the native bundle. Importing the modules directly keeps that out. CJS specifically
 * because Jest needs no `transformIgnorePatterns` change for it. `@zxing/library` is pinned to an
 * exact version in package.json, and `utils/__tests__/opticalQrEncode.test.ts` pins a known
 * matrix — so if a future upgrade moves these files or changes their behaviour, it fails loudly
 * rather than silently emitting undecodable codes.
 */

import BitArray from '@zxing/library/cjs/core/common/BitArray';
import ErrorCorrectionLevel from '@zxing/library/cjs/core/qrcode/decoder/ErrorCorrectionLevel';
import Mode from '@zxing/library/cjs/core/qrcode/decoder/Mode';
import Version from '@zxing/library/cjs/core/qrcode/decoder/Version';
import ByteMatrix from '@zxing/library/cjs/core/qrcode/encoder/ByteMatrix';
import Encoder from '@zxing/library/cjs/core/qrcode/encoder/Encoder';
import MatrixUtil from '@zxing/library/cjs/core/qrcode/encoder/MatrixUtil';

import { alphanumericBits } from './presets';

/**
 * Any mask 0–7 is valid — the decoder reads which one from the symbol's format information — so
 * this is a free choice. 4 matches decimen, which keeps our codes visually comparable to its
 * reference implementation when debugging side by side.
 */
export const QR_MASK_PATTERN = 4;

export type QrEcLevel = 'L' | 'M' | 'Q' | 'H';

export interface QrMatrix {
  moduleCount: number;
  /** Row-major, 1 = dark, 0 = light. Length is moduleCount². */
  modules: Uint8Array;
}

const EC_LEVELS: Record<QrEcLevel, ErrorCorrectionLevel> = {
  L: ErrorCorrectionLevel.L,
  M: ErrorCorrectionLevel.M,
  Q: ErrorCorrectionLevel.Q,
  H: ErrorCorrectionLevel.H,
};

/**
 * Bits the character-count indicator occupies for an ALPHANUMERIC segment, by version band.
 * (ISO/IEC 18004 Table 3.)
 */
function characterCountBits(version: number): number {
  if (version <= 9) {
    return 9;
  }
  return version <= 26 ? 11 : 13;
}

/** Maximum ALPHANUMERIC characters a version/ECC combination can carry. */
export function alphanumericCapacity(version: number, ecLevel: QrEcLevel = 'L'): number {
  const ver = Version.getVersionForNumber(version);
  const ecBlocks = ver.getECBlocksForLevel(EC_LEVELS[ecLevel]);
  const dataBits = (ver.getTotalCodewords() - ecBlocks.getTotalECCodewords()) * 8;
  const available = dataBits - 4 - characterCountBits(version);

  // Pairs cost 11 bits; 6 spare bits still fit one more character.
  const chars = Math.floor(available / 11) * 2;
  return available % 11 >= 6 ? chars + 1 : chars;
}

/**
 * Encode `content` as an ALPHANUMERIC QR symbol at exactly `version`, masked with `maskPattern`.
 *
 * Throws if `content` contains a character outside QR's alphanumeric set, or does not fit the
 * requested version. Callers pass base44 output, whose alphabet is chosen precisely so neither
 * can happen (see ./base44.ts and ./presets.ts).
 */
export function encodeQrAlphanumericFixed(
  content: string,
  version: number,
  ecLevel: QrEcLevel = 'L',
  maskPattern: number = QR_MASK_PATTERN
): QrMatrix {
  const ecl = EC_LEVELS[ecLevel];
  const ver = Version.getVersionForNumber(version);

  // Mirrors Encoder.encode()'s body: mode marker, then length, then the data segment.
  const dataBits = new BitArray();
  Encoder.appendAlphanumericBytes(content, dataBits);

  const bits = new BitArray();
  Encoder.appendModeInfo(Mode.ALPHANUMERIC, bits);
  Encoder.appendLengthInfo(content.length, ver, Mode.ALPHANUMERIC, bits);
  bits.appendBitArray(dataBits);

  const ecBlocks = ver.getECBlocksForLevel(ecl);
  const numDataBytes = ver.getTotalCodewords() - ecBlocks.getTotalECCodewords();
  Encoder.terminateBits(numDataBytes, bits);

  const finalBits = Encoder.interleaveWithECBytes(
    bits,
    ver.getTotalCodewords(),
    numDataBytes,
    ecBlocks.getNumBlocks()
  );

  const moduleCount = ver.getDimensionForVersion();
  const matrix = new ByteMatrix(moduleCount, moduleCount);
  MatrixUtil.buildMatrix(finalBits, ecl, ver, maskPattern, matrix);

  // ByteMatrix is row-major Uint8Array[] using -1 for "unset". buildMatrix fills every cell, but
  // -1 is truthy, so normalise rather than relying on that.
  const rows = matrix.getArray();
  const modules = new Uint8Array(moduleCount * moduleCount);
  for (let y = 0; y < moduleCount; y++) {
    const row = rows[y];
    const offset = y * moduleCount;
    for (let x = 0; x < moduleCount; x++) {
      modules[offset + x] = row[x] === 1 ? 1 : 0;
    }
  }

  return { moduleCount, modules };
}

/** Whether a base44 string of this length fits the version, without building the symbol. */
export function fitsAlphanumericVersion(
  chars: number,
  version: number,
  ecLevel: QrEcLevel = 'L'
): boolean {
  const ver = Version.getVersionForNumber(version);
  const ecBlocks = ver.getECBlocksForLevel(EC_LEVELS[ecLevel]);
  const dataBits = (ver.getTotalCodewords() - ecBlocks.getTotalECCodewords()) * 8;
  return 4 + characterCountBits(version) + alphanumericBits(chars) <= dataBits;
}
