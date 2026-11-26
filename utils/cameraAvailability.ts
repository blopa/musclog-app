/** The parts of a vision-camera `CameraDevice` the rules below read. */
export type CameraDeviceShape = {
  position: string;
  formats?: readonly { photoWidth: number; photoHeight: number }[];
};

/**
 * A camera that offers no format cannot be started: vision-camera's `useCameraFormat` throws
 * `device/invalid-device` for it during render. Some ROMs list such cameras anyway (a Poco X3 on
 * LineageOS lists its 2 MP macro sensor with no formats, because it has no video profiles).
 * A device with no `formats` list at all is an unknown shape and counts as usable.
 */
export function isUsableCameraDevice(device: { formats?: readonly unknown[] }): boolean {
  return !Array.isArray(device.formats) || device.formats.length > 0;
}

/**
 * A camera whose largest photo is under this share of the best camera facing the same way is an
 * auxiliary sensor (macro, depth), never the one to open for a photo of food or a label.
 */
export const MIN_PHOTO_PIXEL_SHARE = 0.25;

function largestPhotoPixels(device: CameraDeviceShape): number {
  return (device.formats ?? []).reduce(
    (largest, format) => Math.max(largest, format.photoWidth * format.photoHeight),
    0
  );
}

/**
 * The cameras facing `position` that are worth opening, highest resolution first. Hand the result
 * to vision-camera's `getCameraDevice`, which scores lens types and keeps the FIRST device on a
 * tie. Its scoring alone picked the 2 MP macro camera on the Poco X3: that ROM reports the main
 * sensor's size wrong, so the 64 MP main camera read as "ultra-wide" and the macro as "wide".
 * Dropping unusable and auxiliary cameras, and putting the largest sensor first, makes every tie
 * land on the main camera.
 */
export function usableCameraDevices<T extends CameraDeviceShape>(
  devices: readonly T[],
  position: string
): T[] {
  const facing = devices.filter(
    (device) => device.position === position && isUsableCameraDevice(device)
  );
  const best = facing.reduce((largest, device) => Math.max(largest, largestPhotoPixels(device)), 0);

  return facing
    .filter((device) => largestPhotoPixels(device) >= best * MIN_PHOTO_PIXEL_SHARE)
    .map((device, index) => ({ device, index, pixels: largestPhotoPixels(device) }))
    .sort((a, b) => b.pixels - a.pixels || a.index - b.index)
    .map(({ device }) => device);
}

/**
 * Whether this device has a camera that can be opened (native). Pure decision over a reader so it
 * can be tested without the native module.
 *
 * Fails OPEN: if the list cannot be read (the native module is missing, a Jest environment without
 * a mock) the camera is assumed to exist. Hiding the scan button on a phone that does have a camera
 * is the worse mistake; a phone without one that still shows the button just lands on the camera
 * screen's "camera unavailable" state.
 */
export function readHasCamera(
  readDevices: () => readonly { formats?: readonly unknown[] }[] | null | undefined
): boolean {
  try {
    const devices = readDevices();

    return Array.isArray(devices) ? devices.some(isUsableCameraDevice) : true;
  } catch {
    return true;
  }
}
