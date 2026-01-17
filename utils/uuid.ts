/**
 * Generate a UUID v4 for use as sync identifiers
 * Uses native crypto.randomUUID() if available, falls back to polyfill
 */
export function generateUUID(): string {
  // Try native crypto.randomUUID() first (available in Expo 48+, React Native 0.73+)
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  // Fallback: Simple UUID v4 implementation
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // where x is any hexadecimal digit and y is one of 8, 9, A, or B
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
