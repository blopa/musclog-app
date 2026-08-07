/**
 * Optical transfer — draws one QR frame.
 *
 * The raster arrives as a plain `Uint32Array` of RGBA pixels, one pixel per QR module, which is
 * already an RGBA_8888 surface — so this is `Skia.Data.fromBytes` + `Skia.Image.MakeImage` with
 * no conversion pass, then a GPU upscale.
 *
 * INTEGER SCALING IS MANDATORY. The image is `raster.size` pixels across and gets blown up to
 * fill the screen; if the scale factor is fractional, nearest-neighbour sampling gives some
 * modules one more pixel than others. The receiver's decoder estimates module boundaries from a
 * uniform grid, so uneven modules measurably raise the failure rate — which shows up as "it just
 * won't scan", not as an obvious rendering bug. So the scale is floored to a whole number and the
 * canvas is sized to match exactly.
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
import { useMemo } from 'react';
import { PixelRatio, View } from 'react-native';

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

  const density = PixelRatio.get();
  const sizeDp = useMemo(() => {
    if (!raster) {
      return 0;
    }
    const scale = Math.max(1, Math.floor((budgetDp * density) / raster.size));
    return (raster.size * scale) / density;
  }, [raster, budgetDp, density]);

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
