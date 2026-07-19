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

import { runCameraWarmUp } from '@/components/cameraWarmUp';

/**
 * Upper bound on how long `takePictureAsync` will wait for the preview to report its first
 * rendered frame (see `previewReady` below) before giving up and attempting the snapshot
 * anyway. Comfortably above the ~hundreds-of-ms this normally takes, while still far cheaper
 * than falling through to a full `takePhoto()` capture.
 */
const PREVIEW_READY_TIMEOUT_MS = 2000;

/**
 * Upper bound on the `takePhoto()` fallback. The underlying CameraX capture request cannot be
 * cancelled, but on devices where the still-capture pipeline stalls (a documented,
 * device-specific CameraX failure mode — captures that take tens of seconds or never invoke
 * their callback at all) this converts a silent multi-tens-of-seconds hang into a fast,
 * visible camera error the user can simply retry.
 */
const FALLBACK_PHOTO_TIMEOUT_MS = 10000;

/**
 * A shutter slower than this is a regression worth a Sentry event: the snapshot path is
 * normally near-instant, so anything above this means the preview wait or a fallback ate the
 * budget.
 */
const SLOW_SHUTTER_THRESHOLD_MS = 3000;

type ShutterOutcome = {
  /** Which capture path actually produced (or failed to produce) the photo. */
  path: 'snapshot' | 'takePhoto-fallback' | 'fallback-failed';
  /** How long the shutter waited for the preview's first-frame signal (or its timeout). */
  previewWaitMs: number;
  totalMs: number;
  snapshotError?: string;
  fallbackError?: string;
};

/**
 * Production-visible shutter telemetry. The console.log line shows up in `adb logcat`
 * (ReactNativeJS) on release builds — essential because the historical shutter slowness only
 * reproduces in release builds. The Sentry call is a real event, not a breadcrumb: this app's
 * Sentry config drops all breadcrumbs (`maxBreadcrumbs: 0` in sentry-init.ts), so a breadcrumb
 * here would never be seen.
 */
const reportShutterOutcome = (outcome: ShutterOutcome) => {
  console.log(`[CameraView] shutter outcome: ${JSON.stringify(outcome)}`);
  if (outcome.path !== 'snapshot' || outcome.totalMs >= SLOW_SHUTTER_THRESHOLD_MS) {
    Sentry.captureMessage('camera-shutter-slow-or-fallback', {
      level: 'warning',
      extra: { ...outcome },
    });
  }
};

/**
 * Bounds a native camera call that cannot be cancelled. If the timeout wins, the losing
 * promise is kept observed (no unhandled rejection) and its eventual settlement is logged —
 * on a stalled capture pipeline that late settlement time is exactly the diagnostic we need
 * from the field.
 */
const withTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
      const timedOutAt = Date.now();
      promise.then(
        () =>
          console.log(
            `[CameraView] ${label} settled ${Date.now() - timedOutAt}ms after timing out`
          ),
        () =>
          console.log(`[CameraView] ${label} failed ${Date.now() - timedOutAt}ms after timing out`)
      );
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

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
          const startedAt = Date.now();
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
          const previewWaitMs = Date.now() - startedAt;

          if (!cameraRef.current) {
            throw new Error('Camera is not ready');
          }

          let snapshotError: string | undefined;
          try {
            const snapshot = await cameraRef.current.takeSnapshot({ quality: 90 });
            reportShutterOutcome({
              path: 'snapshot',
              previewWaitMs,
              totalMs: Date.now() - startedAt,
            });
            return { uri: toFileUri(snapshot.path) };
          } catch (error) {
            snapshotError = error instanceof Error ? error.message : String(error);
          }

          // Snapshot needs a live, rendered preview surface; on the rare chance that isn't
          // available even after waiting for it, fall back to a real (slower) capture instead
          // of failing the shot — but bounded: an uncancellable capture stalling for tens of
          // seconds is worse than a fast, retryable error.
          try {
            const photo = await withTimeout(
              takePhoto(),
              FALLBACK_PHOTO_TIMEOUT_MS,
              'fallback takePhoto'
            );

            reportShutterOutcome({
              path: 'takePhoto-fallback',
              previewWaitMs,
              totalMs: Date.now() - startedAt,
              snapshotError,
            });

            return photo;
          } catch (fallbackError) {
            reportShutterOutcome({
              path: 'fallback-failed',
              previewWaitMs,
              totalMs: Date.now() - startedAt,
              snapshotError,
              fallbackError:
                fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
            });

            throw fallbackError;
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
