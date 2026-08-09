/**
 * Optical transfer — QR decoding in a browser.
 *
 * On native, MLKit does this behind vision-camera's code scanner. On web nothing equivalent is
 * handed to us, so this file owns what decodes a frame. The DOM half — camera, video element,
 * frame pump — lives in `components/optical/OpticalScannerCamera.web.tsx`.
 *
 * TWO PATHS, IN THIS ORDER:
 *
 *  1. The browser's own `BarcodeDetector` (Chrome/Edge on Android, ChromeOS and macOS). It reads
 *     the `<video>` element directly — no pixel copy into JS at all — and decodes off the main
 *     thread, so where it exists nothing else comes close.
 *  2. `zxing-wasm` (zxing-cpp compiled to WebAssembly), fed an `ImageData` we grab off a canvas.
 *
 * WHY NOT `@zxing/library`, WHICH IS ALREADY A DIRECT DEPENDENCY: it is the old Java detector
 * ported to JS, and it is not good enough for this. Measured on simulated camera frames built from
 * our own presets (area-sampled, blurred, noisy, off-centre — the harness is in
 * `utils/__tests__/opticalWebQrDecode.test.ts`), it read 5 of 18 at 10–280 ms each, failing even at
 * 10 px/module, while zxing-cpp read 18 of 18 at 2–12 ms — including `max` at 2.6 px/module. A
 * decoder that misses most frames does not produce a slow transfer, it produces a progress bar
 * that never moves, because the fountain only advances on frames that decode. The JS reader stays
 * in the tree for `qrEncode.ts` (which uses its ENCODER internals, a different question entirely).
 *
 * WHY THE WASM IS SELF-HOSTED: `zxing-wasm` fetches its binary from a CDN by default. This feature
 * promises "no internet, no account, nothing leaves the room", so `scripts/sync-web-wasm.js` copies
 * the binary into `public/` at install time and we point the loader at our own origin. There is
 * deliberately NO CDN fallback: silently going online would be worse than the error the receive
 * screen shows.
 */

// Statically imported, not `import()`-ed: this module is only ever reached from
// `OpticalScannerCamera.web.tsx`, so it never enters a native bundle, and a dynamic import here
// buys a lazy chunk at the cost of not being loadable under Jest's CJS runtime — where the
// round-trip test below is the main guarantee that the web receiver decodes our own frames. The
// heavy part is the 1 MB `.wasm`, which is fetched on first decode either way.
import { prepareZXingModule, readBarcodes } from 'zxing-wasm/reader';

/** The subset of `ImageData` this file needs, so callers can pass one and tests can fake one. */
export interface RgbaFrame {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Where the reader binary lives on our own origin. `EXPO_BASE_URL` is how the rest of the web app
 * builds absolute asset paths (see `app/+html.tsx`), and it matters here because the app is served
 * under a base path in some deployments.
 */
export const OPTICAL_WASM_URL = `${(process.env.EXPO_BASE_URL ?? '').replace(/\/+$/, '')}/zxing_reader.wasm`;

/** Overrides handed to the wasm loader. Tests pass a `wasmBinary`; the app passes `locateFile`. */
export type OpticalWasmOverrides = Record<string, unknown>;

let readerPromise: null | Promise<unknown> = null;

/**
 * Instantiate the wasm reader — once per session, whatever the caller count.
 *
 * The overrides are applied BEFORE the first decode: `prepareZXingModule` is what decides where the
 * binary comes from, and once the module has instantiated, that location is fixed.
 */
export function loadOpticalWasmReader(
  overrides: OpticalWasmOverrides = { locateFile: () => OPTICAL_WASM_URL }
): Promise<unknown> {
  readerPromise ??= prepareZXingModule({ fireImmediately: true, overrides });

  return readerPromise;
}

/** Test seam: forget the loaded module so another test can install different overrides. */
export function resetOpticalWasmReader(): void {
  readerPromise = null;
}

/**
 * Decode a single QR payload out of an RGBA frame, or `null` when the frame holds none.
 *
 * "No code in this frame" is the common case, not an error: most frames from a hand-held camera
 * pointed at a flickering screen are mid-refresh, blurred, or between codes.
 */
export async function decodeQrFromRgba(frame: RgbaFrame): Promise<null | string> {
  if (frame.width <= 0 || frame.height <= 0) {
    return null;
  }

  await loadOpticalWasmReader();
  const results = await readBarcodes(
    {
      colorSpace: 'srgb',
      // A view, not a copy — `getImageData` already handed us exactly these bytes. The cast is
      // only about `ArrayBufferLike` vs `ArrayBuffer`; a camera frame is never a SharedArrayBuffer.
      data: new Uint8ClampedArray(
        frame.data.buffer as ArrayBuffer,
        frame.data.byteOffset,
        frame.data.byteLength
      ),
      height: frame.height,
      width: frame.width,
    },
    {
      formats: ['QRCode'],
      // One code is all a frame ever carries, and searching for more costs a full extra pass.
      maxNumberOfSymbols: 1,
      // tryHarder re-scans rotated and inverted. The sender is a screen held the right way up, and
      // at frame rate it is better to fail fast and look at the next frame.
      tryHarder: false,
    }
  );

  return results[0]?.text ?? null;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
}

/**
 * Whether this browser ships a usable `BarcodeDetector`.
 *
 * Presence of the constructor does not imply QR support (the spec lets an implementation support
 * any subset), so callers confirm with `getSupportedFormats()` before committing — this predicate
 * only answers "is it worth asking".
 */
export function supportsNativeBarcodeDetector(scope: unknown = globalThis): boolean {
  return typeof (scope as { BarcodeDetector?: unknown })?.BarcodeDetector === 'function';
}

export interface OpticalWebQrDecoder {
  /** Which path this decoder took. Surfaced so the scanner can report it in a dev log. */
  kind: 'native' | 'wasm';
  /**
   * Decode one frame. `video` goes straight to `BarcodeDetector`; the wasm path needs pixels, so it
   * asks `readFrame` for them and never calls it otherwise — which is what keeps the native path
   * free of a full-frame copy per frame.
   */
  decode: (video: CanvasImageSource, readFrame: () => null | RgbaFrame) => Promise<null | string>;
}

/** Resolves once, at scanner start-up — never per frame. */
export async function createOpticalWebQrDecoder(
  scope: unknown = globalThis
): Promise<OpticalWebQrDecoder> {
  const wasmDecoder: OpticalWebQrDecoder = {
    decode: async (_video, readFrame) => {
      const frame = readFrame();
      return frame ? decodeQrFromRgba(frame) : null;
    },
    kind: 'wasm',
  };

  if (!supportsNativeBarcodeDetector(scope)) {
    return wasmDecoder;
  }

  const Detector = (scope as { BarcodeDetector: BarcodeDetectorConstructor }).BarcodeDetector;

  try {
    const formats = (await Detector.getSupportedFormats?.()) ?? [];
    if (!formats.includes('qr_code')) {
      return wasmDecoder;
    }

    const detector = new Detector({ formats: ['qr_code'] });
    return {
      decode: async (video) => {
        const codes = await detector.detect(video);
        return codes[0]?.rawValue ?? null;
      },
      kind: 'native',
    };
  } catch {
    // A browser that advertises the constructor but throws while being probed (older Chrome behind
    // a disabled flag, a polyfill that failed to initialise) is not one to hand frames to.
    return wasmDecoder;
  }
}
