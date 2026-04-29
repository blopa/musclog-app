export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Fast check — iOS device supports Apple Intelligence (Foundation Models).
 * Always false on Android/web. Use this for UI visibility decisions.
 */
export async function isOnDeviceAiCapable(): Promise<boolean> {
  return false;
}

/**
 * True when Apple Foundation Models is ready for inference on this device.
 * Requires iPhone 15 Pro+ running iOS 26+ with Apple Intelligence enabled.
 */
export async function isOnDeviceAiAvailable(): Promise<boolean> {
  return false;
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  return '';
}

export async function sendOnDeviceStructured<T>(
  messages: OnDeviceMessage[],
  systemPrompt: string,
  schema: object
): Promise<T | null> {
  return null;
}
