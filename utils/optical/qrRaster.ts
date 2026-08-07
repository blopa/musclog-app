/**
 * Optical transfer — paint a QR module matrix into a pixel buffer, quiet zone included.
 *
 * Ported verbatim from decimen-optical-transfer (MIT), `shared/qr-raster.ts`.
 *
 * Deliberately stops at a plain `Uint32Array` and imports nothing: that keeps this file (and so
 * the whole sender pipeline up to this point) runnable in the Jest `node` project and free of
 * React Native. Turning the result into an `SkImage` is the job of `components/optical/
 * OpticalQrCanvas.tsx`, which is the only place Skia is allowed to appear.
 *
 * The bytes behind the Uint32Array ARE an RGBA_8888 surface, so the Skia side needs no
 * conversion pass: `Skia.Data.fromBytes(new Uint8Array(pixels.buffer))` with `bytesPerRow =
 * size * 4`. One module is one pixel; the canvas scales up by an INTEGER factor with nearest
 * sampling (fractional scaling makes module widths uneven and measurably hurts decode).
 *
 * RGBA rather than a 1-byte grayscale is intentional: it is decimen's file unchanged, so its
 * golden test ports as-is, and it sidesteps any Skia colour-type surprise. At the `standard`
 * preset that is 121² × 4 = 58 564 B per frame — ~700 KB/s of copies at 12 fps, i.e. nothing.
 */

const WHITE = 0xffffffff;
const BLACK = 0xff000000; // opaque black: alpha in the high byte, little-endian

export interface QrRaster {
  /** Pixels per side: moduleCount + 2 × margin. One module = one pixel. */
  size: number;
  pixels: Uint32Array;
}

/** `modules` is row-major, truthy = dark. */
export function rasterizeQr(
  moduleCount: number,
  modules: ArrayLike<number>,
  margin: number
): QrRaster {
  const size = moduleCount + 2 * margin;
  const pixels = new Uint32Array(size * size);
  pixels.fill(WHITE);

  for (let y = 0; y < moduleCount; y++) {
    const row = (y + margin) * size + margin;
    const src = y * moduleCount;
    for (let x = 0; x < moduleCount; x++) {
      if (modules[src + x]) {
        pixels[row + x] = BLACK;
      }
    }
  }

  return { size, pixels };
}
