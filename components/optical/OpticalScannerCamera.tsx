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

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  type Code,
  type CodeScannerFrame,
  type CodeType,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

import { Button } from '@/components/theme/Button';

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
  /** Fires when the session is actually streaming — not when this component mounts. */
  onStarted?: () => void;
}

export function OpticalScannerCamera({
  active,
  onCodeScanned,
  onError,
  onStarted,
}: OpticalScannerCameraProps) {
  const { t } = useTranslation();
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // Permission is owned here rather than by the screen: this component is the only thing that
  // needs the camera, and without this the screen rendered a silent black rectangle — <Camera>
  // mounts happily without permission and simply never produces frames, which looks identical to
  // a transfer that is not working.
  const { hasPermission, requestPermission } = useCameraPermission();
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);
  const hasAutoAskedRef = useRef(false);

  // The automatic ask deliberately writes no state of its own: `hasPermission` is the hook's to
  // update, and a granted prompt re-renders us through that. Only an explicit tap below can
  // conclude anything about a refusal.
  useEffect(() => {
    if (active && !hasPermission && !hasAutoAskedRef.current) {
      hasAutoAskedRef.current = true;
      void requestPermission();
    }
  }, [active, hasPermission, requestPermission]);

  const handleAllowPress = useCallback(async () => {
    const granted = await requestPermission();
    // Having already been asked once, a refusal here means the OS will not show the prompt
    // again ("don't ask again" / iOS's one-shot), so system settings is the only way forward.
    setPermanentlyDenied(!granted);
  }, [requestPermission]);

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

  if (!hasPermission) {
    return (
      <View className="flex-1 items-center justify-center gap-4 p-6">
        <Text className="text-center text-base font-bold text-text-primary">
          {t('opticalTransfer.receive.cameraPermissionTitle')}
        </Text>
        <Text className="text-center text-sm text-text-secondary">
          {t(
            permanentlyDenied
              ? 'opticalTransfer.receive.cameraPermissionSettings'
              : 'opticalTransfer.receive.cameraPermissionMessage'
          )}
        </Text>
        <Button
          label={t(
            permanentlyDenied
              ? 'opticalTransfer.receive.openSettings'
              : 'opticalTransfer.receive.allowCamera'
          )}
          onPress={() =>
            permanentlyDenied ? void Linking.openSettings() : void handleAllowPress()
          }
          size="md"
          variant="accent"
        />
      </View>
    );
  }

  if (!device) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-center text-sm text-text-secondary">
          {t('opticalTransfer.receive.noCamera')}
        </Text>
      </View>
    );
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
        onStarted={onStarted}
        photo={false}
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        video={false}
      />
    </View>
  );
}
