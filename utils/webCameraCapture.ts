/** The slice of an HTMLVideoElement a still capture needs. */
export type CaptureSource = Pick<HTMLVideoElement, 'videoWidth' | 'videoHeight'> &
  CanvasImageSource;

export const WEB_CAPTURE_MIME_TYPE = 'image/jpeg';
export const WEB_CAPTURE_QUALITY = 0.92;

/**
 * Grabs the current frame of a live `<video>` as a JPEG and returns an object URL for it, the
 * same kind of URI the gallery picker hands the crop step on web. Native cameras take a real
 * photo; the browser has no shutter, so the preview frame at its own resolution is the photo.
 *
 * Throws when the stream has not produced a frame yet (no element, or a 0×0 video), so the
 * caller can say the camera failed instead of the shutter silently doing nothing.
 */
export async function captureFrameFromVideo(
  video: CaptureSource | null | undefined
): Promise<{ uri: string }> {
  if (!video || !video.videoWidth || !video.videoHeight) {
    throw new Error('Camera is not ready yet');
  }

  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not read the camera frame');
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, WEB_CAPTURE_MIME_TYPE, WEB_CAPTURE_QUALITY)
  );
  if (!blob) {
    throw new Error('Could not encode the camera frame');
  }

  return { uri: URL.createObjectURL(blob) };
}
