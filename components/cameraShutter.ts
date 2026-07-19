import * as Sentry from '@sentry/react-native';

/**
 * Upper bound on how long the shutter waits for the preview to report its first rendered frame
 * before giving up and attempting the snapshot anyway. Comfortably above the ~hundreds-of-ms
 * this normally takes, while still far cheaper than falling through to a full `takePhoto()`
 * capture.
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
const withTimeout = <T>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
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

type SnapshotLadderPrimitives = {
  /**
   * Resolves once the preview View has painted its first frame. The ladder still bounds this
   * wait itself, so a preview that never signals can't hang the shutter.
   */
  previewReady: Promise<void>;
  /** The fast path: a screenshot of the already-rendered preview (Android) / buffered frame (iOS). */
  takeSnapshot: () => Promise<{ uri: string }>;
  /** The slow, real capture used only when a snapshot fails; bounded because it can't be cancelled. */
  takePhotoFallback: () => Promise<{ uri: string }>;
};

/**
 * The shutter capture ladder, extracted from CameraView so its incident-driven control flow can
 * be unit-tested in isolation: wait (bounded) for the preview's first-frame signal, take a
 * snapshot, and only if that fails fall back to a bounded real capture. Every press reports which
 * path it took and its phase timings via `reportShutterOutcome`. See the CameraView docstring for
 * why the shutter is a snapshot rather than a `takePhoto()`.
 */
export async function captureWithSnapshotLadder({
  previewReady,
  takeSnapshot,
  takePhotoFallback,
}: SnapshotLadderPrimitives): Promise<{ uri: string }> {
  const startedAt = Date.now();

  // Snapshot reads whatever the preview has already rendered (Android: `PreviewView.getBitmap()`,
  // which is null until the first frame is painted); tapping the shutter within the first moment
  // or two of opening the camera can race that. Wait for the real readiness signal (bounded, so a
  // stalled preview can't hang the shutter forever) rather than letting the snapshot fail and
  // silently paying for a full takePhoto() fallback on effectively every "first shot". The timer
  // is cleared once the preview signals, so the common (fast) path leaves no timer behind.
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, PREVIEW_READY_TIMEOUT_MS);
    const settle = () => {
      clearTimeout(timer);
      resolve();
    };
    previewReady.then(settle, settle);
  });
  const previewWaitMs = Date.now() - startedAt;

  let snapshotError: string | undefined;
  try {
    const snapshot = await takeSnapshot();
    reportShutterOutcome({ path: 'snapshot', previewWaitMs, totalMs: Date.now() - startedAt });
    return snapshot;
  } catch (error) {
    snapshotError = error instanceof Error ? error.message : String(error);
  }

  // Snapshot needs a live, rendered preview surface; on the rare chance that isn't available even
  // after waiting for it, fall back to a real (slower) capture instead of failing the shot — but
  // bounded: an uncancellable capture stalling for tens of seconds is worse than a fast, retryable
  // error.
  try {
    const photo = await withTimeout(
      takePhotoFallback(),
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
      fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
    });
    throw fallbackError;
  }
}
