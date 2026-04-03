/**
 * Must stay in sync with `@media (min-width: …)` in global.css (`.expo-web-root` desktop phone frame).
 * Web-specific hooks live in `webPhoneFrame.web.ts`.
 */
export const WEB_DESKTOP_PHONE_FRAME_MIN_WIDTH = 1024;

export type WebModalLayerVariant = 'fullscreen' | 'centered';

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
