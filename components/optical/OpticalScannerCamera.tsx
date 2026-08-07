/**
 * Optical transfer — the receiving camera.
 *
 * Deliberately NOT `components/CameraView.tsx`, which exists for the still-photo shutter path:
 * it sets `photo={true}` and fires a warm-up capture on init (a still-capture request that
 * contends with the analysis pipeline for no benefit here), picks its format by `photoResolution`
 * only, reads just `codes[0]`, and drops the `frame` argument — which is exactly the number we
 * most need.
 *
 * `frame` is the code scanner's analysis resolution, and on Android it is the single most
 * important diagnostic in this feature. vision-camera builds the code-scanner analyzer as a bare
 * `ImageAnalysis.Builder().build()` (`CameraSession+Configuration.kt`, "5. Code Scanner") with no
 * ResolutionSelector — unlike its frame-processor branch — so CameraX's default applies and the
 * `format` prop below cannot change it. On iOS `format` does matter, because
 * AVCaptureMetadataOutput samples `device.activeFormat`. Reporting `frame` upward is how we find
 * out what we actually got rather than what we asked for.
 *
 * No torch: the thing being read is an emissive screen, so a flashlight only adds glare.
 */

import { useCallback, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  type Code,
  type CodeScannerFrame,
  type CodeType,
  useCameraDevice,
  useCameraFormat,
  useCodeScanner,
} from 'react-native-vision-camera';

/** Module constant so the scanner config is not rebuilt on every render. */
const QR_ONLY: CodeType[] = ['qr'];

interface OpticalScannerCameraProps {
  active: boolean;
  /**
   * MUST be identity-stable (a `useCallback(…, [])` writing to refs). MLKit can fire this
   * 15–30×/s; anything that triggers a React render per call starves the very work it feeds.
   */
  onCodeScanned: (codes: Code[], frame: CodeScannerFrame) => void;
  onError?: (error: Error) => void;
}

export function OpticalScannerCamera({
  active,
  onCodeScanned,
  onError,
}: OpticalScannerCameraProps) {
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // iOS: drives AVCaptureDevice.activeFormat, which AVCaptureMetadataOutput samples.
  // Android: affects the preview only — see the note above.
  const format = useCameraFormat(device, [
    { videoResolution: { height: 1080, width: 1920 } },
    { fps: 30 },
  ]);

  const codeScanner = useCodeScanner({ codeTypes: QR_ONLY, onCodeScanned });

  // Autofocus hunting is the top decode killer, and re-focusing is the one thing the person
  // holding the phone can actually do about it.
  const handleFocus = useCallback((x: number, y: number) => {
    cameraRef.current?.focus({ x, y }).catch(() => {
      // Devices without focus support reject; nothing to recover.
    });
  }, []);

  if (!device) {
    return <View style={StyleSheet.absoluteFill} />;
  }

  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderRelease={(event) =>
        handleFocus(event.nativeEvent.locationX, event.nativeEvent.locationY)
      }
      style={StyleSheet.absoluteFill}
    >
      <Camera
        codeScanner={codeScanner}
        device={device}
        format={format}
        fps={30}
        isActive={active}
        onError={onError}
        photo={false}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        video={false}
      />
    </View>
  );
}
