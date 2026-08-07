/**
 * Optical transfer — density presets.
 *
 * Each preset pins a QR version, and everything else follows from it. `frameBytes` is NOT a
 * tuning knob: it is the largest even byte count whose base44 armoring (1.5 chars/byte) still
 * fits that version's ALPHANUMERIC capacity at ECC level L. `utils/__tests__/opticalPresets.test.ts`
 * recomputes every row from zxing's own version tables, so this stops being a table someone
 * typed and becomes a table that is checked.
 *
 * WHY THE CEILING IS V33 AND NOT V40: on Android the code scanner's analysis resolution is not
 * ours to choose. `react-native-vision-camera` builds it as a bare `ImageAnalysis.Builder().build()`
 * (`CameraSession+Configuration.kt`, "5. Code Scanner") with no ResolutionSelector — unlike its
 * frame-processor branch, which sets one — so CameraX's ~640×480 default applies and the `format`
 * prop cannot raise it. At a 480 px short edge a code filling ~90% of the frame gets ~432 px, so
 * px-per-module is:
 *
 *     preset     ver  modules+quiet  px/module
 *     tiny        16       89           4.85
 *     compact     20      105           4.11
 *     standard    24      121           3.57
 *     dense       27      133           3.25
 *     max         33      157           2.75
 *     (rejected)  40      185           2.34
 *
 * MLKit wants ≥2 px/module in ideal conditions and realistically ≥3 with any motion, so V40 —
 * decimen's own default, which is fine browser-to-browser where the receiver controls its own
 * capture resolution — is not viable here. On iOS the picture differs (AVCaptureMetadataOutput
 * samples `device.activeFormat`, which `format` does set), but a preset that only works on one
 * platform is a support burden, so the ladder is shared.
 *
 * `tiny` exists as the documented contingency if field testing shows even `compact` is
 * unreliable on low-end Android.
 *
 * DEFAULT FPS IS PROVISIONAL. The sender derives its real rate from an on-device warm-up
 * measurement (encode cost varies hugely across devices); these are only the fallback used
 * before that measurement exists.
 */

import { HEADER_LEN } from './frameProtocol';

export type OpticalPresetId = 'tiny' | 'compact' | 'standard' | 'dense' | 'max';

export interface OpticalPreset {
  readonly id: OpticalPresetId;
  readonly qrVersion: number;
  /** 17 + 4 × version — the QR spec's dimension formula. */
  readonly moduleCount: number;
  /** Whole frame: header + block. Always even, so base44 emits only full 3-char triples. */
  readonly frameBytes: number;
  readonly blockLen: number;
  readonly defaultFps: number;
}

const preset = (
  id: OpticalPresetId,
  qrVersion: number,
  frameBytes: number,
  defaultFps: number
): OpticalPreset => ({
  id,
  qrVersion,
  moduleCount: 17 + 4 * qrVersion,
  frameBytes,
  blockLen: frameBytes - HEADER_LEN,
  defaultFps,
});

export const OPTICAL_PRESETS: readonly OpticalPreset[] = [
  preset('tiny', 16, 568, 15),
  preset('compact', 20, 832, 14),
  preset('standard', 24, 1136, 12),
  preset('dense', 27, 1420, 10),
  preset('max', 33, 2006, 8),
];

export const DEFAULT_OPTICAL_PRESET_ID: OpticalPresetId = 'standard';

/**
 * The quiet zone the spec requires around a symbol. Rendered as part of the raster rather than
 * left to the surrounding layout, so the margin survives however the canvas is positioned.
 */
export const QR_QUIET_ZONE_MODULES = 4;

export function getOpticalPreset(id: string): OpticalPreset {
  return (
    OPTICAL_PRESETS.find((candidate) => candidate.id === id) ??
    (OPTICAL_PRESETS.find(
      (candidate) => candidate.id === DEFAULT_OPTICAL_PRESET_ID
    ) as OpticalPreset)
  );
}

/**
 * Bits an ALPHANUMERIC segment of `chars` characters occupies: pairs pack into 11 bits, a lone
 * trailing character into 6. (ISO/IEC 18004 §8.4.3.)
 */
export function alphanumericBits(chars: number): number {
  return 11 * Math.floor(chars / 2) + 6 * (chars % 2);
}

/** base44 emits 3 characters per 2 bytes, so a whole frame is exactly this many characters. */
export function base44CharsForBytes(bytes: number): number {
  return Math.floor(bytes / 2) * 3 + (bytes % 2) * 2;
}
