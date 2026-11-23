import type { AppleAvailability } from '@/modules/on-device-ai';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };

/** Apple Intelligence exists on iOS only; the Android and web builds never reach it. */
export async function getAppleAvailability(): Promise<AppleAvailability> {
  return 'unsupportedOs';
}

export async function isAppleLocaleSupported(_languageTag: string): Promise<boolean> {
  return false;
}

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
  _messages: OnDeviceMessage[],
  _systemPrompt?: string
): Promise<string> {
  return '';
}

export async function streamOnDeviceMessage(
  _messages: OnDeviceMessage[],
  _systemPrompt: string | undefined,
  _onDelta: (delta: string) => void,
  _signal?: AbortSignal
): Promise<string> {
  return '';
}

export async function sendOnDeviceStructured<T>(
  _messages: OnDeviceMessage[],
  _systemPrompt: string,
  _schema: object
): Promise<T | null> {
  return null;
}
