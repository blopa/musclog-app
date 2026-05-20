import { Platform } from 'react-native';

export const EXPORT_PLATFORMS = ['android', 'ios', 'web'] as const;

export type ExportPlatform = (typeof EXPORT_PLATFORMS)[number];

export function getExportPlatform(): ExportPlatform {
  return Platform.OS as ExportPlatform;
}

export function isSameExportPlatform(
  exportPlatform: unknown,
  currentPlatform: ExportPlatform = getExportPlatform()
): boolean {
  return typeof exportPlatform === 'string' && exportPlatform === currentPlatform;
}

/**
 * Detects if the current environment is the static export phase of the web build.
 * During static export, Expo runs the code in a Node.js environment (often via JSDOM).
 * This check helps us skip side-effects like database initialization and observers
 * that are not needed for generating static HTML and would otherwise hang the build.
 */
export const isStaticExport =
  Platform.OS === 'web' &&
  (typeof window === 'undefined' ||
    (typeof navigator !== 'undefined' && navigator.userAgent?.includes('Node.js')) ||
    (typeof navigator !== 'undefined' && navigator.userAgent?.includes('jsdom')));
