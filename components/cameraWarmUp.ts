import { File } from 'expo-file-system';

/**
 * Fires one throwaway silent capture against a freshly initialized camera session and deletes
 * the resulting photo.
 *
 * Why: the first still capture of a freshly bound session can pay a one-off focus/exposure
 * convergence cost on Android (CameraX only fully converges 3A — autofocus/auto-exposure — on
 * the first still-capture request of a session); every capture after that in the same session
 * is near-instant. `photoQualityBalance="balanced"` (set in CameraView, mapping to CameraX's
 * Zero-Shutter-Lag mode on Android) already absorbs most of this, but the residual cost is
 * paid here once, silently, as soon as the session reports ready — before the user has framed
 * their shot and reached for the shutter — instead of making their first real tap absorb it.
 * The capture is silent on both platforms via `shutterSound: false`.
 *
 * Never rejects: a failed warm-up just means the user's first real capture pays the
 * convergence cost, as it would have anyway.
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
