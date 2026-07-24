import * as Sentry from '@sentry/react-native';
import {
  forwardRef,
  ReactNode,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import {
  Camera,
  type CameraPermissionStatus,
  type CodeType,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

/**
 * Upper bound on how long `takePictureAsync` will wait for the preview to report its first
 * rendered frame (see `previewReady` below) before giving up and attempting the snapshot
 * anyway. Comfortably above the ~hundreds-of-ms this normally takes, while still far cheaper
 * than falling through to a full `takePhoto()` capture.
 */
const PREVIEW_READY_TIMEOUT_MS = 2000;

export type CameraViewRef = {
  takePictureAsync: () => Promise<{ uri: string }>;
};

export type PermissionResponse = {
  granted: boolean;
  status: CameraPermissionStatus;
  canAskAgain: boolean;
  expires: 'never';
};

/**
 * Maps the app's expo-camera-shaped barcode type strings (kept as the public prop shape so
 * call sites didn't need to change) to vision-camera's CodeType strings.
 */
const CODE_TYPE_MAP = {
  code39: 'code-39',
  code93: 'code-93',
  code128: 'code-128',
  ean8: 'ean-8',
  ean13: 'ean-13',
  qr: 'qr',
  upc_a: 'upc-a',
  upc_e: 'upc-e',
} as const satisfies Record<string, CodeType>;

export type BarcodeType = keyof typeof CODE_TYPE_MAP;

/**
 * Target still-photo size (~3MP, 4:3) for the `takePhoto` fallback/warm-up path (see below —
 * the shutter itself no longer uses `takePhoto`). Without a format vision-camera captures at
 * the full sensor resolution (12–108MP on modern phones), and that megapixel count inflates the
 * JPEG encode + file write for no benefit here: the warm-up photo is discarded, and the
 * takePhoto fallback feeds the same ≤3MP-hungry consumers (barcode detection, label OCR, AI
 * vision) as everything else.
 */
const PHOTO_RESOLUTION_TARGET = { width: 2048, height: 1536 };

/** Normalizes a native file path (with or without the `file://` scheme) to a URI. */
const toFileUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

type CameraViewProps = {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  facing?: 'front' | 'back';
  active?: boolean;
  enableTorch?: boolean;
  onBarcodeScanned?: (event: { data: string; type: string }) => void;
  barcodeScannerSettings?: { barcodeTypes: BarcodeType[] };
};

/**
 * Wraps react-native-vision-camera's Camera behind the prop/ref shape the app previously used
 * for expo-camera, so SmartCameraModal/BarcodeCameraModal and useCameraCaptureFlow need minimal
 * changes.
 *
 * The shutter path is `takeSnapshot()`, not `takePhoto()`: on Android this reads the already-
 * composited preview `View`'s bitmap directly (no capture request, no HAL round-trip); on iOS
 * it reads the latest buffered video frame (`video={true}` below exists solely to keep that
 * buffer populated — we never call `startRecording`). Both are near-instant regardless of
 * camera-session "warmth", unlike `takePhoto()`, whose still-capture pipeline — even with
 * `photoQualityBalance="balanced"` (CameraX's Zero-Shutter-Lag capture mode, the native
 * fast-capture path a prior version of this codebase had to patch expo-camera's source to get,
 * see git history: patches/expo-camera+57.0.3.patch) — can take anywhere from a fraction of a
 * second to tens of seconds on a freshly bound session. `takePhoto` is kept only as (a) the
 * fallback if a snapshot ever fails and (b) the vehicle for the background focus/exposure
 * warm-up below.
 *
 * A snapshot is only as good as what the preview has already rendered — on Android,
 * `PreviewView.getBitmap()` returns null until the first frame is painted — so tapping the
 * shutter within the first moment of opening the camera can race that and throw. `takePictureAsync`
 * waits (bounded) for the `onPreviewStarted` signal before attempting the snapshot, specifically
 * so that race doesn't silently fall through to the slow `takePhoto()` path on every "first shot".
 *
 * Session-lifecycle concerns live here, next to the session they belong to: the silent warm-up
 * capture (see runCameraWarmUp) and the one-warm-up-per-session guard it needs.
 */
export const CameraView = forwardRef<CameraViewRef, CameraViewProps>(
  (
    {
      children,
      style,
      facing = 'back',
      active = true,
      enableTorch = false,
      onBarcodeScanned,
      barcodeScannerSettings,
    },
    ref
  ) => {
    const device = useCameraDevice(facing);
    const format = useCameraFormat(device, [{ photoResolution: PHOTO_RESOLUTION_TARGET }]);
    const cameraRef = useRef<Camera>(null);

    // Resolves once the preview View has painted its first frame (Android: `onPreviewStarted`,
    // tied to CameraX's `PreviewView.StreamState.STREAMING`; iOS's video pipeline fills up on a
    // comparable timescale). Built once per mounted session via useState's lazy initializer —
    // the object itself is never replaced, only its `resolve` is invoked, so this never triggers
    // a re-render.
    const [previewReady] = useState(() => {
      let resolve = () => {};
      const promise = new Promise<void>((res) => {
        resolve = res;
      });

      return { promise, resolve };
    });

    const handlePreviewStarted = useCallback(() => {
      previewReady.resolve();
    }, [previewReady]);

    const takePhoto = useCallback(async (options?: { shutterSound?: boolean }) => {
      if (!cameraRef.current) {
        throw new Error('Camera is not ready');
      }
      const photo = await cameraRef.current.takePhoto({
        enableShutterSound: options?.shutterSound ?? true,
      });
      return { uri: toFileUri(photo.path) };
    }, []);

    const handleInitialized = useCallback(() => {
      // Warm-up is disabled because takeSnapshot is used as the primary instant capture path.
      // Triggering takePhoto in the background causes severe contention/deadlocks on some Android drivers.
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        takePictureAsync: async () => {
          if (!cameraRef.current) {
            throw new Error('Camera is not ready');
          }
          // Snapshot reads whatever the preview has already rendered (Android:
          // `PreviewView.getBitmap()`, which is null until the first frame is painted); tapping
          // the shutter within the first moment or two of opening the camera can race that. Wait
          // for the real readiness signal (bounded, so a stalled preview can't hang the shutter
          // forever) rather than letting the snapshot fail and silently paying for a full
          // takePhoto() fallback on effectively every "first shot".
          await Promise.race([
            previewReady.promise,
            new Promise((resolve) => setTimeout(resolve, PREVIEW_READY_TIMEOUT_MS)),
          ]);

          if (!cameraRef.current) {
            throw new Error('Camera is not ready');
          }

          try {
            const snapshot = await cameraRef.current.takeSnapshot({ quality: 90 });
            return { uri: toFileUri(snapshot.path) };
          } catch (error) {
            // Snapshot needs a live, rendered preview surface; on the rare chance that isn't
            // available even after waiting for it, fall back to a real (slower) capture instead
            // of failing the shot. Logged to Sentry (not just __DEV__) since this path being hit
            // in production is itself the signal that the wait above isn't enough.
            Sentry.addBreadcrumb({
              category: 'camera.snapshot',
              message: 'takeSnapshot failed, falling back to takePhoto',
              level: 'warning',
              data: { error: error instanceof Error ? error.message : String(error) },
            });
            return takePhoto();
          }
        },
      }),
      [takePhoto, previewReady]
    );

    const codeTypes = (barcodeScannerSettings?.barcodeTypes ?? []).map(
      (type) => CODE_TYPE_MAP[type]
    );

    const codeScanner = useCodeScanner({
      codeTypes,
      onCodeScanned: (codes) => {
        const code = codes[0];
        if (code?.value) {
          onBarcodeScanned?.({ data: code.value, type: code.type });
        }
      },
    });

    if (!device) {
      return null;
    }

    return (
      <View style={[StyleSheet.absoluteFill, style]}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device={device}
          format={format}
          isActive={active}
          photo={true}
          // Only iOS's takeSnapshot() needs the video pipeline (it reads the latest buffered
          // video frame); Android's reads the preview View's bitmap directly and doesn't.
          video={Platform.OS === 'ios'}
          torch={enableTorch ? 'on' : 'off'}
          photoQualityBalance="balanced"
          onInitialized={handleInitialized}
          onPreviewStarted={handlePreviewStarted}
          codeScanner={onBarcodeScanned && codeTypes.length > 0 ? codeScanner : undefined}
          androidPreviewViewType="texture-view"
        />
        {children}
      </View>
    );
  }
);

const buildPermissionResponse = (
  granted: boolean,
  status: CameraPermissionStatus
): PermissionResponse => ({
  granted,
  status,
  canAskAgain: status !== 'restricted',
  expires: 'never',
});

/**
 * expo-camera-shaped permission hook over vision-camera. The response object and request
 * function keep stable identities across re-renders — consumers use them as effect deps
 * (see SmartCameraContext) — and the response is rebuilt only when vision-camera's own
 * permission state changes (request resolution, app returning from system Settings). The
 * underlying native check is synchronous, so `permission` is never null on native; the null
 * side of the tuple type exists for the web implementation (utils/webCameraPermissions.ts).
 */
export const useCameraPermissions = (): [
  null | PermissionResponse,
  () => Promise<PermissionResponse>,
] => {
  const { hasPermission, requestPermission } = useCameraPermission();

  const permission = useMemo(
    () => buildPermissionResponse(hasPermission, Camera.getCameraPermissionStatus()),
    [hasPermission]
  );

  const request = useCallback(async (): Promise<PermissionResponse> => {
    const granted = await requestPermission();
    return buildPermissionResponse(granted, Camera.getCameraPermissionStatus());
  }, [requestPermission]);

  return [permission, request];
};
