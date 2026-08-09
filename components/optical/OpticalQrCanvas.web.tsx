/**
 * Optical transfer — draws one QR frame, in a browser.
 *
 * A plain DOM `<canvas>` rather than Skia: the raster is already an RGBA_8888 surface, so
 * `putImageData` uploads it with no conversion pass, and CSS does the upscale on the compositor.
 * Skia on web would mean loading CanvasKit (a megabyte of WASM) to do less than this does.
 *
 * The three things that make a frame decodable are the same as on native, and none of them is
 * cosmetic:
 *
 *  - INTEGER SCALING, via the shared `qrCanvasLayout` — the backing store is exactly one pixel per
 *    module and CSS scales it by a whole number, so every module gets the same number of device
 *    pixels. See that file for why uneven modules break decoding.
 *  - `image-rendering: pixelated`, so the browser upscales nearest-neighbour. The default smooth
 *    filter would blur every module edge into its neighbour, which is exactly the input a decoder
 *    cannot resolve.
 *  - Black on white regardless of app theme. This is not UI, it is a signal being transmitted; a
 *    dark-mode grey-on-grey QR loses the contrast the receiving camera needs.
 *
 * No `dispose()` dance here — unlike an `SkImage`, an `ImageData` is ordinary JS memory that the
 * collector accounts for, so the per-frame leak the native canvas guards against cannot happen.
 */

import { useEffect, useMemo, useRef } from 'react';

import { qrCanvasLayout } from '@/utils/optical/qrCanvasLayout';
import { type QrRaster } from '@/utils/optical/qrRaster';

interface OpticalQrCanvasProps {
  raster: null | QrRaster;
  /** Width available for the code, in CSS px. The rendered size is floored to fit whole modules. */
  budgetDp: number;
}

export function OpticalQrCanvas({ budgetDp, raster }: OpticalQrCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const density = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const sizeDp = useMemo(
    () => qrCanvasLayout(raster?.size ?? 0, budgetDp, density).sizeDp,
    [budgetDp, density, raster]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !raster) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    // The Uint32Array's bytes ARE the RGBA surface (little-endian, alpha in the high byte), which
    // is why this is a view rather than a conversion loop — the same assumption the Skia path
    // makes with `Skia.Data.fromBytes`.
    const pixels = new Uint8ClampedArray(
      raster.pixels.buffer as ArrayBuffer,
      raster.pixels.byteOffset,
      raster.pixels.byteLength
    );

    context.putImageData(new ImageData(pixels, raster.size, raster.size), 0, 0);
  }, [raster]);

  if (!raster) {
    return <div style={{ backgroundColor: '#ffffff', height: budgetDp, width: budgetDp }} />;
  }

  return (
    // The raster already carries a 4-module quiet zone; this extra white surround protects it from
    // whatever the surrounding layout happens to be.
    <div
      style={{
        alignItems: 'center',
        backgroundColor: '#ffffff',
        display: 'flex',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <canvas
        height={raster.size}
        ref={canvasRef}
        style={{ height: sizeDp, imageRendering: 'pixelated', width: sizeDp }}
        width={raster.size}
      />
    </div>
  );
}
