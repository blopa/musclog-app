import { apple } from '@react-native-ai/apple';
import { generateText, jsonSchema, Output } from 'ai';
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
    return apple.isAvailable();
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
    return apple.isAvailable();
  } catch {
    return false;
  }
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  const result = await generateText({
    model: apple(),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return result.text ?? '';
}

export async function sendOnDeviceStructured<T>(
  messages: OnDeviceMessage[],
  systemPrompt: string,
  schema: object
): Promise<T | null> {
  const result = await generateText({
    model: apple(),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    experimental_output: Output.object({ schema: jsonSchema(schema) }),
  });
  return (result.experimental_output as T) ?? null;
}
