/**
 * Whether this device has any camera at all (native). Pure decision over a reader so it can be
 * tested without the native module.
 *
 * Fails OPEN: if the list cannot be read (the native module is missing, a Jest environment without
 * a mock) the camera is assumed to exist. Hiding the scan button on a phone that does have a camera
 * is the worse mistake; a phone without one that still shows the button just lands on the camera
 * screen's existing "no camera" state.
 */
export function readHasCamera(readDevices: () => readonly unknown[] | null | undefined): boolean {
  try {
    const devices = readDevices();

    return Array.isArray(devices) ? devices.length > 0 : true;
  } catch {
    return true;
  }
}
