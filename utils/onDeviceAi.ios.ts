import { apple } from '@react-native-ai/apple';
// Keep the AI SDK on v6: this provider still depends on the v3 provider stack,
// and letting `ai` float to v7 breaks the iOS build.
import { generateText, jsonSchema, Output, streamText } from 'ai';
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

/**
 * Same request as `sendOnDeviceMessage`, handing each piece of text to `onDelta` as the model
 * writes it. Resolves to the whole reply. `streamText` swallows failures into its `error` parts
 * rather than throwing from the text stream, so those are rethrown here.
 */
export async function streamOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt: string | undefined,
  onDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const result = streamText({
    model: apple(),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    abortSignal: signal,
  });

  let text = '';
  for await (const part of result.fullStream) {
    if (part.type === 'error') {
      throw part.error;
    }

    if (part.type === 'text-delta' && part.text) {
      text += part.text;
      onDelta(part.text);
    }
  }

  return text;
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
    output: Output.object({ schema: jsonSchema(schema) }),
  });

  return (result.output as T) ?? null;
}
