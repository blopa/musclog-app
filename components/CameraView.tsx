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

import { captureWithSnapshotLadder } from '@/components/cameraShutter';
import { runCameraWarmUp } from '@/components/cameraWarmUp';
import { toFileUri } from '@/utils/file';

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
 * camera-session "warmth", unlike `takePhoto()`, whose still-capture pipeline can take
 * anywhere from a fraction of a second to tens of seconds on a freshly bound session (this —
 * historically compounded by ZSL capture mode, see the `photoQualityBalance` comment on the
 * Camera element below — was the "25s shutter" production incident that spanned app versions
 * 2.9.13–2.9.18). `takePhoto` is kept only as (a) the bounded fallback if a snapshot ever
 * fails and (b) the vehicle for the background focus/exposure warm-up below. Every shutter
 * press reports which path it took and its phase timings via `reportShutterOutcome` —
 * `adb logcat` on a release build (`npm run build-android-apk-local`) shows them, and slow or
 * fallback shots surface as Sentry events.
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
    const hasWarmedUpRef = useRef(false);

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

    // Warm the session up once per mount, as soon as it reports ready. Callers deactivate the
    // camera by unmounting this component, so a remount — a new native session — re-arms the
    // warm-up naturally.
    //
    // Guard against a second, overlapping warm-up: `onInitialized` can re-fire when the session
    // is reconfigured in place (e.g. the code scanner toggling), and CameraX only supports one
    // in-flight photo-capture request at a time — firing a second warm-up while the first is
    // still resolving would contend with it natively. The check-then-assign below is safe
    // without a separate lock because it's synchronous end-to-end (no `await` between reading
    // and writing the ref) and React invokes `onInitialized` on the JS thread, so two calls can
    // never interleave.
    const handleInitialized = useCallback(() => {
      if (hasWarmedUpRef.current) {
        return;
      }

      hasWarmedUpRef.current = true;
      runCameraWarmUp(takePhoto);
    }, [takePhoto]);

    useImperativeHandle(
      ref,
      () => ({
        takePictureAsync: async () => {
          if (!cameraRef.current) {
            throw new Error('Camera is not ready');
          }
          // The snapshot ladder (preview wait → snapshot → bounded takePhoto fallback) and its
          // telemetry live in cameraShutter.ts; here we just wire in the session-bound
          // primitives. The snapshot primitive re-checks the ref because the camera can unmount
          // during the bounded preview wait.
          return captureWithSnapshotLadder({
            previewReady: previewReady.promise,
            takeSnapshot: async () => {
              if (!cameraRef.current) {
                throw new Error('Camera is not ready');
              }
              const snapshot = await cameraRef.current.takeSnapshot({ quality: 90 });
              return { uri: toFileUri(snapshot.path) };
            },
            takePhotoFallback: takePhoto,
          });
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
          // The snapshot shutter lives or dies on `previewView.getBitmap()`. On the default
          // "surface-view" preview CameraX reads that via PixelCopy, which has documented
          // null/partially-black failures on real devices (vision-camera #2297) — and every
          // such failure silently rerouted the shutter into the slow takePhoto fallback.
          // TextureView's getBitmap() is the plain, reliable path; its costs (slightly less
          // efficient compositing, no HDR preview) don't matter here. Do not switch this back
          // to "surface-view" for a perf win without re-verifying the shutter on a release
          // build.
          androidPreviewViewType="texture-view"
          // "speed" = CameraX CAPTURE_MODE_MINIMIZE_LATENCY. Deliberately NOT "balanced",
          // which vision-camera maps to CAPTURE_MODE_ZERO_SHUTTER_LAG: ZSL has device-specific
          // stalls (Samsung preview freezes, OnePlus captures whose callback never fires) and
          // silently downgrades to normal capture on unsupported devices — so it looks fine on
          // emulators/dev devices and stalls for tens of seconds in the field. ZSL's only
          // benefit (instant still capture) is irrelevant here: takePhoto is just the warm-up
          // vehicle and the rare snapshot fallback; the real shutter is takeSnapshot().
          photoQualityBalance="speed"
          onInitialized={handleInitialized}
          onPreviewStarted={handlePreviewStarted}
          codeScanner={onBarcodeScanned && codeTypes.length > 0 ? codeScanner : undefined}
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
