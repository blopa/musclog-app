import { File } from 'expo-file-system';

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
 */
export async function runCameraWarmUp(
  takePhoto: (options: { shutterSound: boolean }) => Promise<{ uri: string }>
): Promise<void> {
  try {
    const photo = await takePhoto({ shutterSound: false });
    try {
      const file = new File(photo.uri);
      if (file.exists) {
        file.delete();
      }
    } catch {
      // Best-effort cleanup of the throwaway warm-up photo.
    }
  } catch (error) {
    if (__DEV__) {
      console.debug('[CameraView] warm-up capture failed (non-fatal):', error);
    }
  }
}
