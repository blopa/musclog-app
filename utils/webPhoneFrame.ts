/**
 * Must stay in sync with `@media (min-width: …)` in global.css (`.expo-web-root` desktop phone frame).
 * Web-specific hooks live in `webPhoneFrame.web.ts`.
 */
export const WEB_DESKTOP_PHONE_FRAME_MIN_WIDTH = 1024;

/**
 * `fullscreen`: a layer filling the viewport. `centered`: the same, centering its direct child
 * (a root that is itself the backdrop of one dialog). `layer`: positioning only, for a root whose
 * own inner wrapper does the centering.
 */
export type WebModalLayerVariant = 'fullscreen' | 'centered' | 'layer';

/** Native / non-web: desktop phone frame is never active. */
export function useWebDesktopPhoneFrame(): boolean {
  return false;
}

/** Native / non-web: no extra web positioning styles. */
export function useWebModalLayerStyle(_options?: {
  variant?: WebModalLayerVariant;
}): Record<string, unknown> | undefined {
  return undefined;
}

/** Native / non-web: no extra web positioning styles. */
export function useWebBottomDockLayerStyle(): Record<string, unknown> | undefined {
  return undefined;
}
