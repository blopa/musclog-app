import { Platform } from 'react-native';

/**
 * Detects if the current environment is the static export phase of the web build.
 * During static export, Expo runs the code in a Node.js environment (often via JSDOM).
 * This check helps us skip side-effects like database initialization and observers
 * that are not needed for generating static HTML and would otherwise hang the build.
 */
export const isStaticExport =
  Platform.OS === 'web' &&
  (typeof window === 'undefined' ||
    navigator.userAgent?.includes('Node.js') ||
    navigator.userAgent?.includes('jsdom'));
