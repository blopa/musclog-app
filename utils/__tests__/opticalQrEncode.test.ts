/**
 * The QR layer: presets, and the pinned-version/pinned-mask encoder.
 *
 * Two things are actually being defended here.
 *
 * 1. The preset table is DERIVED, not typed. Every row is recomputed from zxing's own version
 *    tables, so a wrong frameBytes cannot sit in the table looking plausible — it would
 *    overflow the symbol at runtime, on a user's phone, mid-transfer.
 * 2. Our reimplementation of `Encoder.encode` is faithful. It is checked two ways: against
 *    zxing's own encoder (same input + same mask must give a bit-identical matrix) and by
 *    round-tripping through a real QR DECODER. The second is the one that matters — it proves
 *    we emit valid, readable symbols rather than merely self-consistent ones.
 */

import BitArray from '@zxing/library/cjs/core/common/BitArray';
import QrDecoder from '@zxing/library/cjs/core/qrcode/decoder/Decoder';
import ErrorCorrectionLevel from '@zxing/library/cjs/core/qrcode/decoder/ErrorCorrectionLevel';
import ZxingEncoder from '@zxing/library/cjs/core/qrcode/encoder/Encoder';
import EncodeHintType from '@zxing/library/cjs/core/EncodeHintType';

import { base44Decode, base44Encode, BASE44_ALPHABET } from '@/utils/optical/base44';
import { fnv1a, HEADER_LEN, packFrame, parseFrame } from '@/utils/optical/frameProtocol';
import {
  alphanumericBits,
  base44CharsForBytes,
  DEFAULT_OPTICAL_PRESET_ID,
  getOpticalPreset,
  MAX_RECOMMENDED_OPTICAL_PRESET_ID,
  OPTICAL_PRESETS,
  type OpticalPreset,
  QR_QUIET_ZONE_MODULES,
} from '@/utils/optical/presets';
import {
  alphanumericCapacity,
  encodeQrAlphanumericFixed,
  fitsAlphanumericVersion,
  QR_MASK_PATTERN,
  type QrMatrix,
} from '@/utils/optical/qrEncode';
import { rasterizeQr } from '@/utils/optical/qrRaster';

/** Deterministic base44-alphabet filler of an exact character length. */
function fillerText(chars: number): string {
  let out = '';
  for (let i = 0; i < chars; i++) {
    out += BASE44_ALPHABET[(i * 17 + (i >> 5) * 3) % BASE44_ALPHABET.length];
  }
  return out;
}

/** Decode one of our matrices with zxing's real QR decoder. */
function decodeMatrix(matrix: QrMatrix): string {
  const image: boolean[][] = [];
  for (let y = 0; y < matrix.moduleCount; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < matrix.moduleCount; x++) {
      row.push(matrix.modules[y * matrix.moduleCount + x] === 1);
    }
    image.push(row);
  }
  return new QrDecoder().decodeBooleanArray(image).getText();
}

describe('preset table', () => {
  it('has internally consistent geometry', () => {
    for (const preset of OPTICAL_PRESETS) {
      expect(preset.moduleCount).toBe(17 + 4 * preset.qrVersion);
      expect(preset.blockLen).toBe(preset.frameBytes - HEADER_LEN);
      // Even, so base44 emits only full 3-char triples and never a 2-char tail.
      expect(preset.frameBytes % 2).toBe(0);
      expect(preset.blockLen).toBeGreaterThan(0);
    }
  });

  it('sizes every frame to its version’s real alphanumeric capacity', () => {
    // The check that makes the table trustworthy: frameBytes must be the LARGEST even byte count
    // that still fits. Too big overflows the symbol; too small silently wastes goodput.
    for (const preset of OPTICAL_PRESETS) {
      const capacity = alphanumericCapacity(preset.qrVersion, 'L');
      const used = base44CharsForBytes(preset.frameBytes);

      expect(used).toBeLessThanOrEqual(capacity);
      expect(base44CharsForBytes(preset.frameBytes + 2)).toBeGreaterThan(capacity);
      expect(fitsAlphanumericVersion(used, preset.qrVersion, 'L')).toBe(true);
    }
  });

  it('is ordered by ascending density and excludes V40', () => {
    const versions = OPTICAL_PRESETS.map((p) => p.qrVersion);
    expect(versions).toEqual([...versions].sort((a, b) => a - b));
    // V40 at Android's ~640x480 locked analysis resolution is ~2.3 px/module — below what MLKit
    // reliably reads with any motion. See the header comment in presets.ts.
    expect(versions).not.toContain(40);
  });

  it('keeps automatic selection in the sparse half of the ladder', () => {
    // Field evidence: a transfer at `dense` took an hour because the receiving camera could not
    // hold focus. Density is not a speed/reliability trade-off here — undecoded frames carry
    // nothing — so anything denser than the ceiling is manual-override only.
    const ceiling = OPTICAL_PRESETS.find((p) => p.id === MAX_RECOMMENDED_OPTICAL_PRESET_ID);
    expect(ceiling).toBeDefined();

    const denser = OPTICAL_PRESETS.filter(
      (p) => p.qrVersion > (ceiling as OpticalPreset).qrVersion
    );
    expect(denser.length).toBeGreaterThan(0);
    // The default the app ships with must itself be within the cap.
    const shipped = OPTICAL_PRESETS.find((p) => p.id === DEFAULT_OPTICAL_PRESET_ID);
    expect((shipped as OpticalPreset).qrVersion).toBeLessThanOrEqual(
      (ceiling as OpticalPreset).qrVersion
    );
  });

  it('offers a preset sparse enough for a struggling camera', () => {
    // ~5.6 px/module at a 480 px short edge — the fallback when even `tiny` will not hold.
    const sparsest = OPTICAL_PRESETS[0];
    expect(sparsest.qrVersion).toBeLessThanOrEqual(13);
    // Roughly half the payload of the old `standard` default, which is what the density
    // complaint asked for.
    expect(sparsest.blockLen).toBeLessThan(1116 / 2);
  });

  it('resolves ids, falling back to the default for anything unknown', () => {
    for (const preset of OPTICAL_PRESETS) {
      expect(getOpticalPreset(preset.id)).toBe(preset);
    }
    expect(getOpticalPreset('nonsense').id).toBe(DEFAULT_OPTICAL_PRESET_ID);
    expect(getOpticalPreset('').id).toBe(DEFAULT_OPTICAL_PRESET_ID);
  });

  it('computes alphanumeric segment bits per the spec', () => {
    // Pairs pack into 11 bits, a lone trailing character into 6.
    expect(alphanumericBits(0)).toBe(0);
    expect(alphanumericBits(1)).toBe(6);
    expect(alphanumericBits(2)).toBe(11);
    expect(alphanumericBits(3)).toBe(17);
    expect(alphanumericBits(4)).toBe(22);
  });
});

describe('encodeQrAlphanumericFixed', () => {
  it('produces symbols a real QR decoder reads back exactly', () => {
    // The end-to-end proof that pinning the mask and version yields valid, readable symbols.
    for (const preset of OPTICAL_PRESETS) {
      const content = fillerText(base44CharsForBytes(preset.frameBytes));
      const matrix = encodeQrAlphanumericFixed(content, preset.qrVersion, 'L');

      expect(matrix.moduleCount).toBe(preset.moduleCount);
      expect(matrix.modules).toHaveLength(preset.moduleCount ** 2);
      expect(decodeMatrix(matrix)).toBe(content);
    }
  });

  it('stays decodable under every mask pattern', () => {
    // Justifies pinning one: all 8 are spec-legal and the decoder reads the choice out of the
    // symbol's format info, so the choice is free.
    const content = fillerText(200);
    for (let mask = 0; mask < 8; mask++) {
      expect(decodeMatrix(encodeQrAlphanumericFixed(content, 20, 'L', mask))).toBe(content);
    }
  });

  it('is bit-identical to zxing’s own encoder given the same version and mask', () => {
    // Proves the reimplementation skipped only the mask SEARCH, not any step that shapes output.
    const content = fillerText(400);
    const hints = new Map<EncodeHintType, unknown>([[EncodeHintType.QR_VERSION, 20]]);
    const reference = ZxingEncoder.encode(content, ErrorCorrectionLevel.L, hints as never);

    const ours = encodeQrAlphanumericFixed(content, 20, 'L', reference.getMaskPattern());
    const referenceRows = reference.getMatrix().getArray();

    const flattened = new Uint8Array(ours.modules.length);
    for (let y = 0; y < ours.moduleCount; y++) {
      for (let x = 0; x < ours.moduleCount; x++) {
        flattened[y * ours.moduleCount + x] = referenceRows[y][x] === 1 ? 1 : 0;
      }
    }
    expect(ours.modules).toEqual(flattened);
  });

  it('emits only 0 and 1, never ByteMatrix’s -1 sentinel', () => {
    const matrix = encodeQrAlphanumericFixed(fillerText(100), 16, 'L');
    expect(new Set(matrix.modules)).toEqual(new Set([0, 1]));
  });

  it('defaults to the pinned mask', () => {
    const content = fillerText(120);
    expect(encodeQrAlphanumericFixed(content, 16, 'L').modules).toEqual(
      encodeQrAlphanumericFixed(content, 16, 'L', QR_MASK_PATTERN).modules
    );
  });

  it('encodes symbols filled to capacity, which zxing’s public encoder cannot', () => {
    // Encoder.willFit (Encoder.js:262) does `(numInputBits + 7) / 8` where the Java original
    // truncates, so it rejects anything occupying the final partial codeword. Our densest three
    // presets sit exactly there. This is the primary reason encodeQrAlphanumericFixed exists —
    // if someone "simplifies" it back to Encoder.encode, this fails and says why.
    const preset = getOpticalPreset('standard');
    const atCapacity = fillerText(alphanumericCapacity(preset.qrVersion, 'L'));
    const hints = new Map<EncodeHintType, unknown>([[EncodeHintType.QR_VERSION, preset.qrVersion]]);

    expect(() => ZxingEncoder.encode(atCapacity, ErrorCorrectionLevel.L, hints as never)).toThrow(
      /too big/i
    );
    expect(decodeMatrix(encodeQrAlphanumericFixed(atCapacity, preset.qrVersion, 'L'))).toBe(
      atCapacity
    );
  });

  it('throws rather than silently truncating over-capacity content', () => {
    const preset = getOpticalPreset('standard');
    const overCapacity = fillerText(alphanumericCapacity(preset.qrVersion, 'L') + 1);
    expect(() => encodeQrAlphanumericFixed(overCapacity, preset.qrVersion, 'L')).toThrow();
  });

  it('throws on characters outside the alphanumeric set', () => {
    // base44 makes this unreachable in production; the guard is what keeps that true.
    expect(() => encodeQrAlphanumericFixed('lowercase', 10, 'L')).toThrow();
  });
});

describe('full sender→receiver frame pipeline', () => {
  it('round-trips a packed frame through QR for every preset', () => {
    // packFrame → base44 → QR → decode → base44Decode → parseFrame. Everything except the
    // camera and the physical channel.
    for (const preset of OPTICAL_PRESETS) {
      const block = new Uint8Array(preset.blockLen);
      for (let i = 0; i < block.length; i++) {
        block[i] = (i * 37 + (i >> 8) * 11) & 0xff;
      }
      const header = {
        sessionId: 4242,
        seq: 1234,
        k: 99,
        blockLen: preset.blockLen,
        totalLen: 123456,
        payloadFnv: fnv1a(block),
      };

      const frame = packFrame(header, block);
      expect(frame).toHaveLength(preset.frameBytes);

      const text = base44Encode(frame);
      expect(text).toHaveLength(base44CharsForBytes(preset.frameBytes));

      const decoded = decodeMatrix(encodeQrAlphanumericFixed(text, preset.qrVersion, 'L'));
      const parsed = parseFrame(base44Decode(decoded) as Uint8Array);

      expect(parsed?.header).toEqual(header);
      expect(parsed?.block).toEqual(block);
    }
  });
});

describe('rasterizeQr', () => {
  it('surrounds the symbol with a white quiet zone', () => {
    const matrix = encodeQrAlphanumericFixed(fillerText(60), 16, 'L');
    const raster = rasterizeQr(matrix.moduleCount, matrix.modules, QR_QUIET_ZONE_MODULES);

    expect(raster.size).toBe(matrix.moduleCount + 2 * QR_QUIET_ZONE_MODULES);
    expect(raster.pixels).toHaveLength(raster.size ** 2);

    // Every border ring pixel must be white, or the decoder loses the finder patterns.
    for (let i = 0; i < raster.size; i++) {
      for (const index of [
        i, // top row
        (raster.size - 1) * raster.size + i, // bottom row
        i * raster.size, // left column
        i * raster.size + raster.size - 1, // right column
      ]) {
        expect(raster.pixels[index]).toBe(0xffffffff);
      }
    }
  });

  it('maps dark modules to opaque black, offset by the margin', () => {
    // 1 module = 1 pixel; the canvas scales up by an integer factor.
    const modules = Uint8Array.from([1, 0, 0, 1]);
    const raster = rasterizeQr(2, modules, 1);

    expect(raster.size).toBe(4);
    expect(raster.pixels[1 * 4 + 1]).toBe(0xff000000);
    expect(raster.pixels[1 * 4 + 2]).toBe(0xffffffff);
    expect(raster.pixels[2 * 4 + 1]).toBe(0xffffffff);
    expect(raster.pixels[2 * 4 + 2]).toBe(0xff000000);
  });

  it('produces bytes that are already an RGBA_8888 surface', () => {
    // What lets the Skia side do Skia.Data.fromBytes(pixels.buffer) with no conversion pass.
    const raster = rasterizeQr(1, Uint8Array.from([1]), 0);
    expect(new Uint8Array(raster.pixels.buffer)).toEqual(Uint8Array.from([0, 0, 0, 255]));
  });
});

describe('BitArray import', () => {
  it('resolves the deep CJS path the encoder depends on', () => {
    // If a @zxing/library upgrade moves these files, this fails here rather than at runtime on a
    // user's phone.
    expect(typeof new BitArray().getSize()).toBe('number');
  });
});
