import { isAvailable, isPromptInferenceReady, sendMessage } from 'expo-ai-kit';
import { Platform } from 'react-native';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Fast check — iOS device supports Apple Intelligence (Foundation Models).
 * Always false on Android/web. Use this for UI visibility decisions.
 */
export async function isOnDeviceAiCapable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    return await isAvailable();
  } catch {
    return false;
  }
}

/**
 * True when Apple Foundation Models is ready for inference on this device.
 * Requires iPhone 15 Pro+ running iOS 26+ with Apple Intelligence enabled.
 */
export async function isOnDeviceAiAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') {
    return false;
  }
  try {
    const capable = await isAvailable();
    if (!capable) {
      return false;
    }
    return await isPromptInferenceReady();
  } catch {
    return false;
  }
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  const response = await sendMessage(messages, { systemPrompt });
  return response.text ?? '';
}
