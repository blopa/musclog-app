import * as Sentry from '@sentry/react-native';
import { File } from 'expo-file-system';

/**
 * A warm-up slower than this is a Sentry-worthy signal: a healthy first still capture
 * completes well under this, and a stalled one is the prime suspect for wedging the session
 * (and any takePhoto fallback queued behind it, since CameraX serializes capture requests).
 */
const WARM_UP_SLOW_THRESHOLD_MS = 5000;

/**
 * Fires one throwaway silent capture against a freshly initialized camera session and deletes
 * the resulting photo.
 *
 * Why: CameraView's shutter path is `takeSnapshot()` (a screenshot of whatever the live preview
 * currently shows — see CameraView.tsx), which is fast regardless of session "warmth", but it's
 * only as good as what's already on screen. A freshly bound session hasn't converged focus,
 * exposure, or white balance yet (CameraX only fully converges 3A on the first still-capture
 * request of a session), so a snapshot taken in that window can come out blurry or misexposed.
 * This warm-up forces that one-off convergence via a real `takePhoto()` call, silently, as soon
 * as the session reports ready — before the user has framed their shot and reached for the
 * shutter — so the live preview (and therefore their snapshot) already looks right by the time
 * they tap. It also keeps the `takePhoto()` path itself primed, for the rare case a snapshot
 * fails and CameraView falls back to it. The capture is silent on both platforms via
 * `shutterSound: false`.
 *
 * Never rejects, and is never awaited by the shutter path: a failed warm-up just means the
 * preview converges on its own, same as it always would have.
 *
 * Duration is always logged (visible in `adb logcat` on release builds), and a slow or failed
 * warm-up is reported as a Sentry event — not a breadcrumb, which this app's Sentry config
 * drops — because a stalled warm-up capture blocks any takePhoto fallback queued behind it.
 *
 * `isSessionAlive` (optional) lets the caller distinguish a genuine capture failure from expected
 * teardown: if the user opens then immediately dismisses the camera, the in-flight capture rejects
 * simply because the session was torn down. When that predicate reports the session is already
 * gone at failure time, the failure is logged but NOT sent to Sentry — otherwise that benign,
 * user-driven churn would be indistinguishable from a real warm-up stall.
 */
export async function runCameraWarmUp(
  takePhoto: (options: { shutterSound: boolean }) => Promise<{ uri: string }>,
  isSessionAlive: () => boolean = () => true
): Promise<void> {
  const startedAt = Date.now();
  try {
    const photo = await takePhoto({ shutterSound: false });
    const durationMs = Date.now() - startedAt;
    console.log(`[CameraView] warm-up capture took ${durationMs}ms`);
    if (durationMs >= WARM_UP_SLOW_THRESHOLD_MS) {
      Sentry.captureMessage('camera-warm-up-slow', {
        level: 'warning',
        extra: { durationMs },
      });
    }

    try {
      const file = new File(photo.uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best-effort cleanup of the throwaway warm-up photo.
    }
  } catch (error) {
    const durationMs = Date.now() - startedAt;

    // The session was torn down while this capture was in flight (camera opened then quickly
    // dismissed) — expected teardown, not a stall. Log it, but don't emit a Sentry event that
    // would masquerade as a real warm-up failure.
    if (!isSessionAlive()) {
      console.log(`[CameraView] warm-up capture aborted (camera closed) after ${durationMs}ms`);
      return;
    }

    console.log(`[CameraView] warm-up capture failed after ${durationMs}ms`);
    Sentry.captureMessage('camera-warm-up-failed', {
      level: 'warning',
      extra: {
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      },
    });
  }
}
