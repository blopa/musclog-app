/**
 * The browser only learns whether a camera exists once the page asks for one, so the web build
 * keeps every camera entry point and lets the camera screen explain a denial or a missing device.
 */
export function useHasCamera(): boolean {
  return true;
}
