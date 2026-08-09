/**
 * The web receiving path's decoder.
 *
 * THE TEST THAT MATTERS is the round trip: a frame produced by the REAL sender pipeline
 * (`encodeQrAlphanumericFixed` → `rasterizeQr`), rendered the way a camera would actually see it,
 * must come back out of the decoder byte-identical. That is the whole web transfer in miniature
 * minus the camera, and it is what proves the decoder can read OUR presets rather than "some QR
 * code" — the presets are pinned to versions and filled to capacity, which is not what a QR
 * library's own test corpus looks like.
 *
 * `cameraFrame` is deliberately not a clean render. A pixel-perfect integer-scaled bitmap is the
 * one input every decoder handles, so testing on one proves nothing about a phone screen held in
 * front of a webcam. It area-samples at a fractional scale (a real sensor integrates over the
 * pixel, so module edges land grey), blurs, adds deterministic noise, sits the code off-centre in
 * a darker room, and never fills the frame.
 *
 * That harness is also the evidence behind the decoder choice recorded in `webQrDecode.ts`: on
 * these same 18 frames `@zxing/library` (pure JS) read 5, taking 10–280 ms, while zxing-cpp via
 * wasm read 18 in 2–12 ms.
 */

import { readFileSync } from 'node:fs';

import { BASE44_ALPHABET } from '@/utils/optical/base44';
import {
  base44CharsForBytes,
  getOpticalPreset,
  QR_QUIET_ZONE_MODULES,
} from '@/utils/optical/presets';
import { encodeQrAlphanumericFixed } from '@/utils/optical/qrEncode';
import { type QrRaster, rasterizeQr } from '@/utils/optical/qrRaster';
import {
  createOpticalWebQrDecoder,
  decodeQrFromRgba,
  loadOpticalWasmReader,
  resetOpticalWasmReader,
  type RgbaFrame,
  supportsNativeBarcodeDetector,
} from '@/utils/optical/webQrDecode';

/** Deterministic base44-alphabet filler of an exact character length. */
function fillerText(chars: number): string {
  let out = '';
  for (let index = 0; index < chars; index++) {
    out += BASE44_ALPHABET[(index * 17 + (index >> 5) * 3) % BASE44_ALPHABET.length];
  }
  return out;
}

const ROOM = 70;
const SCREEN_WHITE = 235;
const SCREEN_BLACK = 20;
const SUPERSAMPLE = 4;

function cameraFrame(
  raster: QrRaster,
  options: { codePx: number; height: number; seed: number; width: number }
): RgbaFrame {
  const { codePx, height, seed, width } = options;
  const scale = codePx / raster.size;
  const originX = (width - codePx) / 2 + 11;
  const originY = (height - codePx) / 2 - 7;

  // Area sampling: each output pixel integrates over its own footprint, so a module edge that
  // falls mid-pixel comes out grey rather than snapping to one side.
  const luminance = new Float64Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let accumulated = 0;
      for (let subY = 0; subY < SUPERSAMPLE; subY++) {
        for (let subX = 0; subX < SUPERSAMPLE; subX++) {
          const sourceX = (x + (subX + 0.5) / SUPERSAMPLE - originX) / scale;
          const sourceY = (y + (subY + 0.5) / SUPERSAMPLE - originY) / scale;
          const inside =
            sourceX >= 0 && sourceY >= 0 && sourceX < raster.size && sourceY < raster.size;
          accumulated += inside
            ? raster.pixels[Math.floor(sourceY) * raster.size + Math.floor(sourceX)] === 0xffffffff
              ? SCREEN_WHITE
              : SCREEN_BLACK
            : ROOM;
        }
      }
      luminance[y * width + x] = accumulated / (SUPERSAMPLE * SUPERSAMPLE);
    }
  }

  const blurred = Float64Array.from(luminance);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          sum += luminance[(y + dy) * width + (x + dx)] * (dx === 0 && dy === 0 ? 4 : 1);
        }
      }
      blurred[y * width + x] = sum / 12;
    }
  }

  let random = seed;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index++) {
    random = (random * 1664525 + 1013904223) >>> 0;
    const value = blurred[index] + ((random >>> 24) / 255 - 0.5) * 8;
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }

  return { data, height, width };
}

function senderRaster(presetId: string): { raster: QrRaster; text: string } {
  const preset = getOpticalPreset(presetId);
  const text = fillerText(base44CharsForBytes(preset.frameBytes));
  const matrix = encodeQrAlphanumericFixed(text, preset.qrVersion, 'L');

  return { raster: rasterizeQr(matrix.moduleCount, matrix.modules, QR_QUIET_ZONE_MODULES), text };
}

beforeAll(async () => {
  resetOpticalWasmReader();
  // In the browser the binary is fetched from our own origin (`public/zxing_reader.wasm`, put
  // there by `scripts/sync-web-wasm.js`). Node has no fetch target, so hand the loader the bytes
  // — this is the same file the web build serves.
  const binary = readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm'));
  await loadOpticalWasmReader({
    wasmBinary: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength),
  });
});

describe('decodeQrFromRgba', () => {
  // The default density, the middle of the ladder, and the densest preset the manual override can
  // reach — at both a phone-webcam resolution and a laptop one.
  const presets = ['tiny', 'standard', 'max'];
  // 640×480 is what Android's code scanner analyses at (see `presets.ts`); 1280×720 stands in for
  // a laptop webcam. Rendering the frame costs far more here than decoding it, so the resolutions
  // stop there rather than at 1080p.
  const captures = [
    { codePx: 410, height: 480, label: '640x480', width: 640 },
    { codePx: 610, height: 720, label: '1280x720', width: 1280 },
  ];

  for (const presetId of presets) {
    for (const capture of captures) {
      it(`reads a ${presetId} frame off a simulated ${capture.label} camera`, async () => {
        const { raster, text } = senderRaster(presetId);
        const frame = cameraFrame(raster, { ...capture, seed: 1234 });

        await expect(decodeQrFromRgba(frame)).resolves.toBe(text);
      });
    }
  }

  it('returns null rather than throwing when the frame holds no code', async () => {
    const width = 128;
    const data = new Uint8ClampedArray(width * width * 4).fill(0xff);

    await expect(decodeQrFromRgba({ data, height: width, width })).resolves.toBeNull();
  });

  it('treats an empty frame as no code', async () => {
    await expect(
      decodeQrFromRgba({ data: new Uint8ClampedArray(0), height: 0, width: 0 })
    ).resolves.toBeNull();
  });
});

describe('createOpticalWebQrDecoder', () => {
  const readFrame = jest.fn<null | RgbaFrame, []>(() => null);

  beforeEach(() => readFrame.mockClear());

  const scopeWith = (
    detect: () => Promise<{ rawValue: string }[]>,
    getSupportedFormats: () => Promise<string[]>
  ) => ({
    BarcodeDetector: Object.assign(
      function BarcodeDetector() {
        return { detect };
      },
      { getSupportedFormats }
    ),
  });

  it('falls back to wasm when the browser has no BarcodeDetector', async () => {
    expect(supportsNativeBarcodeDetector({})).toBe(false);
    expect((await createOpticalWebQrDecoder({})).kind).toBe('wasm');
  });

  it('uses the browser decoder when it supports QR', async () => {
    const detect = jest.fn(async () => [{ rawValue: 'FRAME' }]);
    const decoder = await createOpticalWebQrDecoder(
      scopeWith(detect, async () => ['qr_code', 'ean_13'])
    );

    expect(decoder.kind).toBe('native');
    await expect(decoder.decode({} as CanvasImageSource, readFrame)).resolves.toBe('FRAME');
    // The native path reads the video element directly; asking for pixels would mean a full-frame
    // copy per frame for nothing.
    expect(readFrame).not.toHaveBeenCalled();
  });

  it('falls back to wasm when the browser decoder cannot do QR', async () => {
    const decoder = await createOpticalWebQrDecoder(
      scopeWith(
        async () => [],
        async () => ['ean_13']
      )
    );

    expect(decoder.kind).toBe('wasm');
  });

  it('falls back to wasm when probing the browser decoder throws', async () => {
    const decoder = await createOpticalWebQrDecoder(
      scopeWith(
        async () => [],
        async () => {
          throw new Error('disabled by flag');
        }
      )
    );

    expect(decoder.kind).toBe('wasm');
  });

  it('reports no code when the wasm path has no pixels to read', async () => {
    const decoder = await createOpticalWebQrDecoder({});

    await expect(decoder.decode({} as CanvasImageSource, readFrame)).resolves.toBeNull();
    expect(readFrame).toHaveBeenCalledTimes(1);
  });
});
