/**
 * Optical transfer — draws one QR frame.
 *
 * The raster arrives as a plain `Uint32Array` of RGBA pixels, one pixel per QR module, which is
 * already an RGBA_8888 surface — so this is `Skia.Data.fromBytes` + `Skia.Image.MakeImage` with
 * no conversion pass, then a GPU upscale.
 *
 * INTEGER SCALING IS MANDATORY — see `utils/optical/qrCanvasLayout.ts`, which owns that rule for
 * this canvas and its web counterpart alike.
 *
 * Colours are hard-coded black on white regardless of app theme: this is not UI, it is a signal
 * being transmitted, and a dark-mode grey-on-grey QR code loses the contrast the decoder needs.
 */

import {
  AlphaType,
  Canvas,
  ColorType,
  FilterMode,
  Image,
  MipmapMode,
  Skia,
} from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { PixelRatio, View } from 'react-native';

import { qrCanvasLayout } from '@/utils/optical/qrCanvasLayout';
import { type QrRaster } from '@/utils/optical/qrRaster';

interface OpticalQrCanvasProps {
  raster: null | QrRaster;
  /** Width available for the code, in dp. The rendered size is floored to fit whole modules. */
  budgetDp: number;
}

export function OpticalQrCanvas({ raster, budgetDp }: OpticalQrCanvasProps) {
  const image = useMemo(() => {
    if (!raster) {
      return null;
    }
    return Skia.Image.MakeImage(
      {
        alphaType: AlphaType.Opaque,
        colorType: ColorType.RGBA_8888,
        height: raster.size,
        width: raster.size,
      },
      Skia.Data.fromBytes(new Uint8Array(raster.pixels.buffer)),
      raster.size * 4
    );
  }, [raster]);

  // An SkImage owns native memory that JS garbage collection does not account for, so at a dozen
  // frames a second the collector sees a trickle of small JS objects while native memory climbs
  // by ~65 KB a frame. On a low-end device that shows up as a stream that starts fine and grinds
  // to a halt after a few seconds. React runs this cleanup for the previous image only after the
  // new one has been committed and drawn, so the image being released is never the one on screen.
  useEffect(
    () => () => {
      image?.dispose();
    },
    [image]
  );

  const density = PixelRatio.get();
  const sizeDp = useMemo(
    () => qrCanvasLayout(raster?.size ?? 0, budgetDp, density).sizeDp,
    [raster, budgetDp, density]
  );

  if (!raster || !image) {
    return <View style={{ backgroundColor: '#ffffff', height: budgetDp, width: budgetDp }} />;
  }

  return (
    // The raster already carries a 4-module quiet zone; this extra white surround protects it
    // from whatever the surrounding layout happens to be.
    <View
      style={{
        alignItems: 'center',
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        padding: 12,
      }}
    >
      <Canvas style={{ height: sizeDp, width: sizeDp }}>
        <Image
          fit="fill"
          height={sizeDp}
          image={image}
          sampling={{ filter: FilterMode.Nearest, mipmap: MipmapMode.None }}
          width={sizeDp}
          x={0}
          y={0}
        />
      </Canvas>
    </View>
  );
}
