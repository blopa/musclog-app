/**
 * Optical transfer — how big to draw a QR frame.
 *
 * INTEGER SCALING IS MANDATORY, and it is the whole reason this is a function rather than a
 * `width: '100%'`. The raster is `raster.size` pixels across (one pixel per module) and gets blown
 * up to fill the screen; at a fractional scale factor, nearest-neighbour sampling gives some
 * modules one more device pixel than others. The receiver's decoder estimates module boundaries
 * from a uniform grid, so uneven modules measurably raise the failure rate — and it shows up as
 * "it just won't scan", never as an obviously wrong-looking render.
 *
 * Shared by both canvases (`OpticalQrCanvas.tsx` on Skia, `OpticalQrCanvas.web.tsx` on a DOM
 * canvas) so the two platforms cannot drift into different rounding.
 */

export interface QrCanvasLayout {
  /** Whole device pixels per module. Never below 1 — a sub-module scale is not renderable. */
  scale: number;
  /** The size to give the canvas, in dp/CSS px. `scale × size` device pixels, exactly. */
  sizeDp: number;
}

export function qrCanvasLayout(
  rasterSize: number,
  budgetDp: number,
  density: number
): QrCanvasLayout {
  if (rasterSize <= 0) {
    return { scale: 1, sizeDp: 0 };
  }

  const scale = Math.max(1, Math.floor((budgetDp * density) / rasterSize));

  return { scale, sizeDp: (rasterSize * scale) / density };
}
