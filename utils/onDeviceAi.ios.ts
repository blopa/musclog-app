import { apple } from '@react-native-ai/apple';
// Keep the AI SDK on v6: this provider still depends on the v3 provider stack,
// and letting `ai` float to v7 breaks the iOS build.
import { generateText, jsonSchema, Output, streamText } from 'ai';
import { Platform } from 'react-native';

import { type AppleAvailability, onDeviceAiModule } from '@/modules/on-device-ai';
import { OnDeviceUnavailableError } from '@/utils/aiErrors';
import { handleError } from '@/utils/handleError';

export type OnDeviceMessage = { role: 'user' | 'assistant'; content: string };

/**
 * Why Apple Intelligence can or cannot answer. The native helper reads
 * `SystemLanguageModel.default.availability`; a build without it (or before iOS 26) only has
 * `apple.isAvailable()`, a yes/no that says nothing about why.
 */
export async function getAppleAvailability(): Promise<AppleAvailability> {
  if (Platform.OS !== 'ios') {
    return 'unsupportedOs';
  }

  if (onDeviceAiModule) {
    try {
      return onDeviceAiModule.appleAvailability();
    } catch (error) {
      void handleError(error, 'onDeviceAi.appleAvailability', { showSnackbar: false });
      return 'unknown';
    }
  }

  try {
    return apple.isAvailable() ? 'available' : 'unknown';
  } catch (error) {
    void handleError(error, 'onDeviceAi.appleAvailability', { showSnackbar: false });
    return 'unknown';
  }
}

/** Does Apple's model support this app language (a BCP 47 tag such as `pt-BR`)? */
export async function isAppleLocaleSupported(languageTag: string): Promise<boolean> {
  if (Platform.OS !== 'ios' || !onDeviceAiModule) {
    return false;
  }

  try {
    return onDeviceAiModule.appleSupportsLocale(languageTag);
  } catch (error) {
    void handleError(error, 'onDeviceAi.appleLocale', { showSnackbar: false });
    return false;
  }
}

/**
 * Fast check: this iPhone can use Apple Intelligence (eligible, with it switched off or still
 * downloading counting as capable). Always false on Android/web. Use this for UI visibility.
 */
export async function isOnDeviceAiCapable(): Promise<boolean> {
  const availability = await getAppleAvailability();

  return (
    availability === 'available' ||
    availability === 'appleIntelligenceNotEnabled' ||
    availability === 'modelNotReady'
  );
}

/**
 * True when Apple Foundation Models is ready for inference on this device.
 * Requires iPhone 15 Pro+ running iOS 26+ with Apple Intelligence enabled.
 */
export async function isOnDeviceAiAvailable(): Promise<boolean> {
  return (await getAppleAvailability()) === 'available';
}

/** Throws the typed "not ready" error instead of letting the native call fail with its own text. */
async function assertAppleReady(): Promise<void> {
  if (!(await isOnDeviceAiAvailable())) {
    throw new OnDeviceUnavailableError('notReady');
  }
}

export async function sendOnDeviceMessage(
  messages: OnDeviceMessage[],
  systemPrompt?: string
): Promise<string> {
  await assertAppleReady();
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
  await assertAppleReady();
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
  await assertAppleReady();
  const result = await generateText({
    model: apple(),
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    output: Output.object({ schema: jsonSchema(schema) }),
  });

  return (result.output as T) ?? null;
}
